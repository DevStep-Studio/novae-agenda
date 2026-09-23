import { createHash, createHmac } from "node:crypto";
import { and, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authTokens, bookings, clients, customerAccessLogs, customerCredentials, users } from "@/db/schema";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { normalizePhoneDigits } from "@/lib/domain";
import { sendMail } from "@/lib/mailer";
import { saveClientImage } from "@/lib/storage";

export type CustomerPhoneStatus = "HAS_PIN" | "NEEDS_PIN_SETUP" | "NOT_FOUND";

export type CustomerAccessAuditAction =
  | "PIN_CREATED"
  | "PIN_CHANGED"
  | "PIN_RESET_REQUESTED"
  | "PIN_LOGIN_FAILED"
  | "PIN_LOGIN_SUCCESS"
  | "PIN_LOCKED";

const WEAK_PINS = new Set([
  "000000",
  "111111",
  "222222",
  "333333",
  "444444",
  "555555",
  "666666",
  "777777",
  "888888",
  "999999",
  "123456",
  "654321",
  "012345",
  "543210",
  "121212",
  "696969",
]);

export function isWeakPin(pin: string): boolean {
  if (WEAK_PINS.has(pin)) return true;
  if (/^(\d)\1{5}$/.test(pin)) return true;
  return false;
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export function hashPinLookup(pin: string): string {
  const pepper = process.env.AUTH_SECRET || "reservei-secure-customer-pin-pepper";
  return createHmac("sha256", pepper).update(pin.trim()).digest("hex");
}

export function generateRandomPin(): string {
  let pin = "";
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (isWeakPin(pin));
  return pin;
}

type CustomerAccessIdentity = {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  hasPin: boolean;
};

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "(**) *****-****";
  const last4 = digits.slice(-4);
  return `(**) *****-${last4}`;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***@***";
  if (user.length <= 2) return `${user[0]}*@${domain}`;
  return `${user[0]}${"*".repeat(user.length - 2)}${user[user.length - 1]}@${domain}`;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export class CustomerAccessService {
  private static async findCredentialByPin(pin: string) {
    const lookupHash = hashPinLookup(pin);
    const [indexedCredential] = await db
      .select()
      .from(customerCredentials)
      .where(eq(customerCredentials.pinLookupHash, lookupHash))
      .limit(1);

    if (indexedCredential) return indexedCredential;

    // Fallback de segurança universal: se o hash indexado não encontrar (por exemplo, se o AUTH_SECRET
    // foi redefinido ou se a credencial foi criada sem o hash), verifica todas as credenciais via bcrypt.
    // Ao encontrar uma correspondência, auto-cura o pinLookupHash no banco.
    const allCredentials = await db.select().from(customerCredentials);

    for (const credential of allCredentials) {
      if (await verifyPassword(pin, credential.pinHash)) {
        try {
          await db
            .update(customerCredentials)
            .set({ pinLookupHash: lookupHash, updatedAt: new Date() })
            .where(eq(customerCredentials.id, credential.id));
        } catch (updateErr) {
          console.error("[CustomerAccessService] Erro ao auto-curar pinLookupHash:", updateErr);
        }
        return credential;
      }
    }

    return null;
  }

  static async userHasPin(userId: string): Promise<boolean> {
    const [credential] = await db
      .select({ id: customerCredentials.id })
      .from(customerCredentials)
      .where(eq(customerCredentials.userId, userId))
      .limit(1);
    return Boolean(credential);
  }

  static async generateAvailablePin(): Promise<string> {
    return generateRandomPin();
  }

  /**
   * Grava auditoria de ações de acesso do cliente sem nunca salvar PIN em texto puro.
   */
  static async logAudit(params: {
    userId?: string | null;
    phoneNormalized: string;
    action: CustomerAccessAuditAction;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await db.insert(customerAccessLogs).values({
        id: crypto.randomUUID(),
        userId: params.userId ?? null,
        phoneNormalized: params.phoneNormalized,
        action: params.action,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        metadata: params.metadata ?? null,
      });
    } catch (err) {
      console.error("[CustomerAccessService] Erro ao gravar audit log:", err);
    }
  }

  /**
   * Localiza ou unifica o usuário cliente associado ao telefone normalizado.
   * IMPORTANTE: Nunca vincula nem retorna usuários com role 'owner', 'admin' ou 'employee'.
   */
  static async resolveCustomerUser(phoneNormalized: string): Promise<{
    user: typeof users.$inferSelect | null;
    credential: typeof customerCredentials.$inferSelect | null;
  }> {
    // 1. Procura primeiro na tabela de credenciais de PIN
    const [credential] = await db
      .select()
      .from(customerCredentials)
      .where(eq(customerCredentials.phoneNormalized, phoneNormalized))
      .limit(1);

    if (credential) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, credential.userId))
        .limit(1);

      if (user && (user.role === "customer" || user.role === "client")) {
        return { user, credential };
      }
    }

    // 2. Procura em users por telefone normalizado APENAS clientes (nunca proprietários/staff)
    const allCustomerUsers = await db
      .select()
      .from(users)
      .where(and(isNotNull(users.phone), eq(users.role, "customer")));

    const matchedUser = allCustomerUsers.find((u) => {
      if (!u.phone) return false;
      return normalizePhoneDigits(u.phone) === phoneNormalized;
    });

    if (matchedUser) {
      return { user: matchedUser, credential: null };
    }

    // 3. Procura na tabela de clientes do CRM
    const allClients = await db
      .select()
      .from(clients)
      .where(isNotNull(clients.phone));

    const matchedClient = allClients.find((c) => {
      if (!c.phone) return false;
      return normalizePhoneDigits(c.phone) === phoneNormalized;
    });

    if (matchedClient?.userId) {
      const [linkedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, matchedClient.userId))
        .limit(1);

      if (linkedUser && (linkedUser.role === "customer" || linkedUser.role === "client")) {
        return { user: linkedUser, credential: null };
      }
    }

    // 4. Se cliente existe no CRM mas ainda não tem userId de cliente, cria o User correspondente
    if (matchedClient) {
      const newUserId = crypto.randomUUID();
      const defaultEmail = matchedClient.email
        ? matchedClient.email.trim().toLowerCase()
        : `cliente-${phoneNormalized}@novae.local`;
      const fallbackPassword = await hashPassword(crypto.randomUUID());

      await db.insert(users).values({
        id: newUserId,
        name: matchedClient.name || "Cliente",
        email: defaultEmail,
        phone: matchedClient.phone,
        passwordHash: fallbackPassword,
        role: "customer",
        active: true,
        emailVerified: Boolean(matchedClient.email),
      });

      // Vincula ao client no CRM
      await db
        .update(clients)
        .set({ userId: newUserId, updatedAt: new Date() })
        .where(eq(clients.id, matchedClient.id));

      const [createdUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, newUserId))
        .limit(1);

      return { user: createdUser ?? null, credential: null };
    }

    return { user: null, credential: null };
  }

  /**
   * Consulta o estado do telefone para determinar o próximo passo do fluxo progressivo.
   */
  static async checkPhone(phone: string): Promise<{
    exists: boolean;
    status: CustomerPhoneStatus;
    maskedPhone: string;
    hasEmail: boolean;
    emailHint?: string;
  }> {
    const normalized = normalizePhoneDigits(phone);
    if (!normalized || normalized.length < 8) {
      throw new Error("Informe um número de celular válido com DDD.");
    }

    const { user, credential } = await this.resolveCustomerUser(normalized);

    if (!user) {
      return {
        exists: false,
        status: "NOT_FOUND",
        maskedPhone: maskPhone(phone),
        hasEmail: false,
      };
    }

    if (credential?.pinHash) {
      return {
        exists: true,
        status: "HAS_PIN",
        maskedPhone: maskPhone(phone),
        hasEmail: Boolean(user.email && !user.email.endsWith("@novae.local")),
        emailHint:
          user.email && !user.email.endsWith("@novae.local")
            ? maskEmail(user.email)
            : undefined,
      };
    }

    return {
      exists: true,
      status: "NEEDS_PIN_SETUP",
      maskedPhone: maskPhone(phone),
      hasEmail: Boolean(user.email && !user.email.endsWith("@novae.local")),
      emailHint:
        user.email && !user.email.endsWith("@novae.local")
          ? maskEmail(user.email)
          : undefined,
    };
  }

  /**
   * Autenticação direta do cliente utilizando SOMENTE o PIN de 6 dígitos.
   * Não requer e-mail, senha ou celular para consulta de reservas.
   */
  static async loginByPinOnly(params: {
    pin: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    userId: string;
    customer: CustomerAccessIdentity;
  }> {
    const rawPin = params.pin.trim();
    if (!isValidPinFormat(rawPin)) {
      throw new Error("O PIN deve conter exatamente 6 números.");
    }

    const lookupHash = hashPinLookup(rawPin);
    const credential = await this.findCredentialByPin(rawPin);

    if (!credential) {
      throw new Error("PIN não encontrado. Verifique os 6 números digitados.");
    }

    // Verifica bloqueio por tentativas excessivas
    if (credential.lockedUntil && credential.lockedUntil > new Date()) {
      const remainingMs = credential.lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new Error(
        `Muitas tentativas. Conta temporariamente bloqueada. Tente novamente em ${remainingMin} minuto${remainingMin > 1 ? "s" : ""}.`,
      );
    }

    const isMatch = await verifyPassword(rawPin, credential.pinHash);

    if (!isMatch) {
      const newAttempts = (credential.failedAttempts || 0) + 1;
      const isLocked = newAttempts >= 5;
      const lockedUntil = isLocked
        ? new Date(Date.now() + 15 * 60 * 1000)
        : null;

      await db
        .update(customerCredentials)
        .set({
          failedAttempts: newAttempts,
          lockedUntil,
          updatedAt: new Date(),
        })
        .where(eq(customerCredentials.id, credential.id));

      if (isLocked) {
        await this.logAudit({
          userId: credential.userId,
          phoneNormalized: credential.phoneNormalized,
          action: "PIN_LOCKED",
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          metadata: { attempts: newAttempts },
        });
        throw new Error(
          "Muitas tentativas incorretas. Conta bloqueada temporariamente por 15 minutos.",
        );
      }

      await this.logAudit({
        userId: credential.userId,
        phoneNormalized: credential.phoneNormalized,
        action: "PIN_LOGIN_FAILED",
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: { attempts: newAttempts },
      });

      const remainingAttempts = Math.max(0, 5 - newAttempts);
      throw new Error(
        `PIN incorreto. Você tem mais ${remainingAttempts} tentativa${remainingAttempts !== 1 ? "s" : ""} antes do bloqueio temporário.`,
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, credential.userId))
      .limit(1);

    if (!user || !user.active) {
      throw new Error("Conta de cliente inativa ou não encontrada.");
    }

    let userToAuth = user;
    if (user.role !== "customer" && user.role !== "client") {
      const customerEmail = credential.phoneNormalized
        ? `cliente-${credential.phoneNormalized}@novae.local`
        : `cliente-${user.id.slice(0, 8)}@novae.local`;

      const [existingCust] = await db
        .select()
        .from(users)
        .where(and(eq(users.role, "customer"), eq(users.email, customerEmail)))
        .limit(1);

      if (existingCust) {
        userToAuth = existingCust;
      } else {
        const newCustId = crypto.randomUUID();
        const fallbackPassword = await hashPassword(crypto.randomUUID());
        await db.insert(users).values({
          id: newCustId,
          name: user.name || "Cliente",
          email: customerEmail,
          phone: user.phone || null,
          passwordHash: fallbackPassword,
          role: "customer",
          active: true,
          emailVerified: true,
        });
        const [createdCust] = await db
          .select()
          .from(users)
          .where(eq(users.id, newCustId))
          .limit(1);
        userToAuth = createdCust || user;
      }

      await db
        .update(customerCredentials)
        .set({ userId: userToAuth.id })
        .where(eq(customerCredentials.id, credential.id));
    }

    // Sucesso no login: zera tentativas e atualiza timestamp de login
    await db
      .update(customerCredentials)
      .set({
        pinLookupHash: credential.pinLookupHash || lookupHash,
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customerCredentials.id, credential.id));

    await this.logAudit({
      userId: userToAuth.id,
      phoneNormalized: credential.phoneNormalized,
      action: "PIN_LOGIN_SUCCESS",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // Emite o cookie de sessão seguro do Reservei para o cliente
    await createSession(userToAuth.id);

    return {
      userId: userToAuth.id,
      customer: {
        id: userToAuth.id,
        name: userToAuth.name,
        phone: userToAuth.phone,
        role: "customer",
        hasPin: true,
      },
    };
  }

  /**
   * Autenticação segura por PIN (com ou sem telefone).
   */
  static async loginWithPin(params: {
    phone?: string;
    pin: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    userId: string;
    customer: CustomerAccessIdentity;
  }> {
    if (!params.phone || params.phone.trim().length === 0) {
      return this.loginByPinOnly({
        pin: params.pin,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
    }

    const normalized = normalizePhoneDigits(params.phone);
    if (!normalized || normalized.length < 8) {
      return this.loginByPinOnly({
        pin: params.pin,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
    }

    if (!isValidPinFormat(params.pin)) {
      throw new Error("O PIN deve conter exatamente 6 números.");
    }

    const { user, credential } = await this.resolveCustomerUser(normalized);

    if (!user) {
      // Se não encontrou pelo telefone, tenta buscar pelo PIN diretamente
      return this.loginByPinOnly({
        pin: params.pin,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
    }

    if (!credential || !credential.pinHash) {
      const err = new Error(
        "Este cadastro ainda não possui um PIN configurado. Conclua a criação do seu PIN.",
      );
      (err as any).needsSetup = true;
      throw err;
    }

    // Verifica bloqueio por tentativas excessivas
    if (credential.lockedUntil && credential.lockedUntil > new Date()) {
      const remainingMs = credential.lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new Error(
        `Muitas tentativas. Conta temporariamente bloqueada. Tente novamente em ${remainingMin} minuto${remainingMin > 1 ? "s" : ""}.`,
      );
    }

    const isMatch = await verifyPassword(params.pin, credential.pinHash);

    if (!isMatch) {
      const newAttempts = (credential.failedAttempts || 0) + 1;
      const isLocked = newAttempts >= 5;
      const lockedUntil = isLocked
        ? new Date(Date.now() + 15 * 60 * 1000)
        : null;

      await db
        .update(customerCredentials)
        .set({
          failedAttempts: newAttempts,
          lockedUntil,
          updatedAt: new Date(),
        })
        .where(eq(customerCredentials.id, credential.id));

      if (isLocked) {
        await this.logAudit({
          userId: user.id,
          phoneNormalized: normalized,
          action: "PIN_LOCKED",
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          metadata: { attempts: newAttempts },
        });
        throw new Error(
          "Muitas tentativas incorretas. Conta bloqueada temporariamente por 15 minutos.",
        );
      }

      await this.logAudit({
        userId: user.id,
        phoneNormalized: normalized,
        action: "PIN_LOGIN_FAILED",
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        metadata: { attempts: newAttempts },
      });

      const remainingAttempts = Math.max(0, 5 - newAttempts);
      throw new Error(
        `PIN incorreto. Você tem mais ${remainingAttempts} tentativa${remainingAttempts !== 1 ? "s" : ""} antes do bloqueio temporário.`,
      );
    }

    let userToAuth = user;
    if (user.role !== "customer" && user.role !== "client") {
      const customerEmail = normalized
        ? `cliente-${normalized}@novae.local`
        : `cliente-${user.id.slice(0, 8)}@novae.local`;

      const [existingCust] = await db
        .select()
        .from(users)
        .where(and(eq(users.role, "customer"), eq(users.email, customerEmail)))
        .limit(1);

      if (existingCust) {
        userToAuth = existingCust;
      } else {
        const newCustId = crypto.randomUUID();
        const fallbackPassword = await hashPassword(crypto.randomUUID());
        await db.insert(users).values({
          id: newCustId,
          name: user.name || "Cliente",
          email: customerEmail,
          phone: user.phone || null,
          passwordHash: fallbackPassword,
          role: "customer",
          active: true,
          emailVerified: true,
        });
        const [createdCust] = await db
          .select()
          .from(users)
          .where(eq(users.id, newCustId))
          .limit(1);
        userToAuth = createdCust || user;
      }

      await db
        .update(customerCredentials)
        .set({ userId: userToAuth.id })
        .where(eq(customerCredentials.id, credential.id));
    }

    // Sucesso no login: zera tentativas, atualiza hash indexado se nulo e salva data
    const lookupHash = hashPinLookup(params.pin);
    await db
      .update(customerCredentials)
      .set({
        pinLookupHash: credential.pinLookupHash || lookupHash,
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customerCredentials.id, credential.id));

    await this.logAudit({
      userId: userToAuth.id,
      phoneNormalized: normalized,
      action: "PIN_LOGIN_SUCCESS",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // Emite o cookie de sessão seguro do Reservei para o cliente
    await createSession(userToAuth.id);

    return {
      userId: userToAuth.id,
      customer: {
        id: userToAuth.id,
        name: userToAuth.name,
        phone: userToAuth.phone,
        role: "customer",
        hasPin: true,
      },
    };
  }

  /**
   * Configuração de PIN de primeiro acesso ou pós-reserva.
   */
  static async setupPin(params: {
    phone?: string;
    pin: string;
    confirmPin: string;
    bookingId?: string;
    otpToken?: string;
    customerId?: string;
    authenticatedUserId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    userId: string;
    customer: CustomerAccessIdentity;
  }> {
    if (!isValidPinFormat(params.pin)) {
      throw new Error("O PIN deve conter exatamente 6 dígitos numéricos.");
    }

    if (params.pin !== params.confirmPin) {
      throw new Error("Os PINs não coincidem.");
    }

    if (isWeakPin(params.pin)) {
      throw new Error(
        "PIN muito fácil. Escolha um PIN mais seguro, evitando repetições ou sequências como 123456.",
      );
    }

    const lookupHash = hashPinLookup(params.pin);

    // Validação de identidade segura e estrita
    let identityVerified = false;
    let user: typeof users.$inferSelect | null = null;
    let credential: typeof customerCredentials.$inferSelect | null = null;
    const normalized = params.phone ? normalizePhoneDigits(params.phone) : "";

    // 1. Verificação via sessão autenticada ativa
    const targetUserId = params.authenticatedUserId;
    if (targetUserId) {
      const [sessionUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);
      if (sessionUser && sessionUser.active) {
        user = sessionUser;
        identityVerified = true;
      }
    }

    // 2. Se não estiver autenticado em sessão, exige telefone e validação de OTP obrigatória
    if (!identityVerified) {
      if (!normalized || normalized.length < 8) {
        throw new Error("Informe seu número de celular com DDD para validar a criação do PIN.");
      }

      const resolved = await this.resolveCustomerUser(normalized);
      user = resolved.user;
      credential = resolved.credential;

      if (!params.otpToken || !params.otpToken.trim()) {
        throw new Error(
          "Código de verificação obrigatório. Solicite um código de verificação para comprovar a titularidade do número.",
        );
      }

      if (!user) {
        throw new Error("Não foi possível localizar o cadastro para este número.");
      }

      const tokenHash = sha256(params.otpToken.trim());
      const [validToken] = await db
        .select()
        .from(authTokens)
        .where(
          and(
            eq(authTokens.userId, user.id),
            eq(authTokens.kind, "customer_pin_setup"),
            eq(authTokens.tokenHash, tokenHash),
            isNull(authTokens.consumedAt),
            gt(authTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!validToken) {
        throw new Error("Código de verificação inválido ou expirado.");
      }

      // Consome o token imediatamente para garantir uso único (single-use)
      await db
        .update(authTokens)
        .set({ consumedAt: new Date() })
        .where(eq(authTokens.id, validToken.id));

      identityVerified = true;
    }

    if (!identityVerified || !user) {
      throw new Error(
        "Não foi possível validar sua identidade. Solicite um código de verificação para prosseguir.",
      );
    }

    if (!user) {
      // Provisiona usuário cliente se ainda não existir
      const newUserId = crypto.randomUUID();
      const defaultEmail = normalized ? `cliente-${normalized}@novae.local` : `cliente-${Date.now()}@novae.local`;
      const fallbackPassword = await hashPassword(crypto.randomUUID());

      await db.insert(users).values({
        id: newUserId,
        name: "Cliente",
        email: defaultEmail,
        phone: params.phone || null,
        passwordHash: fallbackPassword,
        role: "customer",
        active: true,
        emailVerified: true,
      });

      const [created] = await db
        .select()
        .from(users)
        .where(eq(users.id, newUserId))
        .limit(1);

      user = created!;
    }

    // Verifica se já existe credencial vinculada a este user
    if (!credential) {
      const [existingCred] = await db
        .select()
        .from(customerCredentials)
        .where(eq(customerCredentials.userId, user.id))
        .limit(1);
      if (existingCred) credential = existingCred;
    }

    const pinHash = await hashPassword(params.pin);
    const phoneNorm = normalized || (user.phone ? normalizePhoneDigits(user.phone) : "");

    if (params.phone && params.phone.trim()) {
      await db
        .update(users)
        .set({ phone: params.phone.trim(), updatedAt: new Date() })
        .where(eq(users.id, user.id));
      await db
        .update(clients)
        .set({ phone: params.phone.trim(), updatedAt: new Date() })
        .where(eq(clients.userId, user.id));
      user.phone = params.phone.trim();
    }

    if (credential) {
      await db
        .update(customerCredentials)
        .set({
          pinHash,
          pinLookupHash: lookupHash,
          phoneNormalized: phoneNorm || credential.phoneNormalized,
          pinUpdatedAt: new Date(),
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(customerCredentials.id, credential.id));
    } else {
      await db.insert(customerCredentials).values({
        id: crypto.randomUUID(),
        userId: user.id,
        phoneNormalized: phoneNorm,
        pinHash,
        pinLookupHash: lookupHash,
        pinCreatedAt: new Date(),
        pinUpdatedAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
      });
    }

    await this.logAudit({
      userId: user.id,
      phoneNormalized: phoneNorm,
      action: credential ? "PIN_CHANGED" : "PIN_CREATED",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // Cria sessão do cliente automaticamente
    await createSession(user.id);

    return {
      userId: user.id,
      customer: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: "customer",
        hasPin: true,
      },
    };
  }

  /**
   * Solicita código OTP para primeiro cadastro de PIN de cliente.
   */
  static async requestPinSetupOtp(params: {
    phone: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    success: boolean;
    message: string;
    channel: "email" | "whatsapp" | "console";
    destination: string;
  }> {
    const normalized = normalizePhoneDigits(params.phone);
    if (!normalized || normalized.length < 8) {
      throw new Error("Informe um número de celular válido com DDD.");
    }

    const { user, credential } = await this.resolveCustomerUser(normalized);

    if (credential?.pinHash) {
      throw new Error("Este número já possui um PIN cadastrado. Acesse digitando seu PIN ou solicite a recuperação.");
    }

    let targetUser = user;
    if (!targetUser) {
      const newUserId = crypto.randomUUID();
      const defaultEmail = `cliente-${normalized}@novae.local`;
      const fallbackPassword = await hashPassword(crypto.randomUUID());

      await db.insert(users).values({
        id: newUserId,
        name: "Cliente",
        email: defaultEmail,
        phone: params.phone.trim(),
        role: "customer",
        active: true,
        passwordHash: fallbackPassword,
      });

      const [created] = await db.select().from(users).where(eq(users.id, newUserId)).limit(1);
      targetUser = created;
    }

    if (!targetUser) {
      throw new Error("Erro ao preparar validação de identidade.");
    }

    // Gera OTP numérico de 6 dígitos
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = sha256(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    // Invalida tokens anteriores
    await db
      .update(authTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(authTokens.userId, targetUser.id),
          eq(authTokens.kind, "customer_pin_setup"),
          isNull(authTokens.consumedAt),
        ),
      );

    await db.insert(authTokens).values({
      id: crypto.randomUUID(),
      userId: targetUser.id,
      kind: "customer_pin_setup",
      tokenHash,
      expiresAt,
    });

    await this.logAudit({
      userId: targetUser.id,
      phoneNormalized: normalized,
      action: "PIN_RESET_REQUESTED",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    const hasRealEmail = targetUser.email && !targetUser.email.endsWith("@novae.local");
    if (hasRealEmail) {
      await sendMail({
        to: targetUser.email,
        subject: "Código de Verificação — Reservei",
        text: `Olá!\n\nSeu código de verificação para criar seu PIN no Reservei é: ${otp}\n\nEste código expira em 10 minutos.`,
        html: `<p>Olá!</p><p>Seu código de verificação para criar seu PIN no Reservei é:</p><h2 style="letter-spacing: 4px; font-size: 28px;">${otp}</h2><p>Este código expira em 10 minutos.</p>`,
      });

      return {
        success: true,
        message: `Enviamos um código de verificação para ${maskEmail(targetUser.email)}.`,
        channel: "email",
        destination: maskEmail(targetUser.email),
      };
    }

    console.info(`\n[CustomerPinService] OTP Setup para ${normalized}: ${otp}\n`);

    return {
      success: true,
      message: `Código de verificação enviado para o seu número ${maskPhone(params.phone)}.`,
      channel: "whatsapp",
      destination: maskPhone(params.phone),
    };
  }

  /**
   * Solicita redefinição de PIN (Esqueci meu PIN) emitindo código OTP de 6 dígitos.
   */
  static async requestPinReset(params: {
    phone: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    success: boolean;
    message: string;
    channel: "email" | "whatsapp" | "console";
    destination: string;
  }> {
    const normalized = normalizePhoneDigits(params.phone);
    if (!normalized || normalized.length < 8) {
      throw new Error("Informe um número de celular válido com DDD.");
    }

    const { user } = await this.resolveCustomerUser(normalized);

    if (!user) {
      throw new Error("Não encontramos reservas vinculadas a este número.");
    }

    // Gera OTP numérico de 6 dígitos
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = sha256(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    // Invalida tokens anteriores de reset para o usuário
    await db
      .update(authTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(authTokens.userId, user.id),
          eq(authTokens.kind, "customer_pin_reset"),
          isNull(authTokens.consumedAt),
        ),
      );

    await db.insert(authTokens).values({
      id: crypto.randomUUID(),
      userId: user.id,
      kind: "customer_pin_reset",
      tokenHash,
      expiresAt,
    });

    await this.logAudit({
      userId: user.id,
      phoneNormalized: normalized,
      action: "PIN_RESET_REQUESTED",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // Envia por e-mail se o cliente possuir e-mail real
    const hasRealEmail = user.email && !user.email.endsWith("@novae.local");
    if (hasRealEmail) {
      await sendMail({
        to: user.email,
        subject: "Código para redefinir seu PIN — Reservei",
        text: `Olá, ${user.name}.\n\nSeu código de verificação para redefinir seu PIN de acesso às reservas é: ${otp}\n\nEste código expira em 10 minutos. Se você não solicitou, ignore este e-mail.`,
        html: `<p>Olá, <strong>${user.name}</strong>.</p><p>Seu código de verificação para redefinir seu PIN de acesso às reservas é:</p><h2 style="letter-spacing: 4px; font-size: 28px;">${otp}</h2><p>Este código expira em 10 minutos.</p>`,
      });

      return {
        success: true,
        message: `Enviamos um código de verificação de 6 dígitos para ${maskEmail(user.email)}.`,
        channel: "email",
        destination: maskEmail(user.email),
      };
    }

    // Em ambiente de desenvolvimento/console
    console.info(`\n[CustomerPinService] OTP para ${normalized}: ${otp}\n`);

    return {
      success: true,
      message: `Código de verificação enviado para o seu número ${maskPhone(params.phone)}.`,
      channel: "whatsapp",
      destination: maskPhone(params.phone),
    };
  }

  /**
   * Confirma a redefinição de PIN validando o código OTP de 6 dígitos.
   */
  static async confirmPinReset(params: {
    phone: string;
    otp: string;
    newPin: string;
    confirmNewPin: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    userId: string;
    customer: CustomerAccessIdentity;
  }> {
    if (!isValidPinFormat(params.newPin)) {
      throw new Error("O novo PIN deve conter exatamente 6 dígitos numéricos.");
    }

    if (params.newPin !== params.confirmNewPin) {
      throw new Error("Os PINs não coincidem.");
    }

    if (isWeakPin(params.newPin)) {
      throw new Error(
        "PIN muito fraco. Evite repetições ou sequências numéricas óbvias.",
      );
    }

    const normalized = normalizePhoneDigits(params.phone);
    if (!normalized || normalized.length < 8) {
      throw new Error("Informe um número de celular válido com DDD.");
    }

    const { user, credential } = await this.resolveCustomerUser(normalized);

    if (!user) {
      throw new Error("Cliente não encontrado.");
    }

    const cleanOtp = params.otp.trim();
    const tokenHash = sha256(cleanOtp);

    const [validToken] = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.userId, user.id),
          eq(authTokens.kind, "customer_pin_reset"),
          eq(authTokens.tokenHash, tokenHash),
          isNull(authTokens.consumedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!validToken) {
      throw new Error("Código de verificação inválido ou expirado.");
    }

    // Marca token como consumido ao aplicar o novo PIN
    await db
      .update(authTokens)
      .set({ consumedAt: new Date() })
      .where(eq(authTokens.id, validToken.id));

    const pinHash = await hashPassword(params.newPin);
    const pinLookupHash = hashPinLookup(params.newPin);

    if (credential) {
      await db
        .update(customerCredentials)
        .set({
          pinHash,
          pinLookupHash,
          pinUpdatedAt: new Date(),
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(customerCredentials.id, credential.id));
    } else {
      await db.insert(customerCredentials).values({
        id: crypto.randomUUID(),
        userId: user.id,
        phoneNormalized: normalized,
        pinHash,
        pinLookupHash,
        pinCreatedAt: new Date(),
        pinUpdatedAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
      });
    }

    await this.logAudit({
      userId: user.id,
      phoneNormalized: normalized,
      action: "PIN_CHANGED",
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    // Cria sessão do cliente automaticamente
    await createSession(user.id);

    return {
      userId: user.id,
      customer: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: "customer",
        hasPin: true,
      },
    };
  }

  /**
   * Identificação rápida e sem fricção do cliente para agendamento.
   * Não requer senha nem e-mail de ativação.
   */
  static async quickIdentifyCustomer(params: {
    name: string;
    phone: string;
    email?: string;
    photoUrl?: string;
  }): Promise<{
    userId: string | null;
    customer: CustomerAccessIdentity | null;
    hasPin: boolean;
  }> {
    const rawName = params.name.trim();
    if (rawName.length < 2) {
      throw new Error("Informe seu nome completo.");
    }

    const normalized = normalizePhoneDigits(params.phone);
    if (!normalized || normalized.length < 8) {
      throw new Error("Informe um número de celular/WhatsApp válido com DDD.");
    }

    let { user, credential } = await this.resolveCustomerUser(normalized);

    // Um telefone que já possui PIN nunca pode ganhar uma sessão apenas por
    // informar nome e celular. O cliente precisa autenticar com o PIN existente.
    if (user && credential?.pinHash) {
      return { userId: null, customer: null, hasPin: true };
    }

    if (!user) {
      const email = params.email?.trim().toLowerCase() && params.email.includes("@")
        ? params.email.trim().toLowerCase()
        : `${normalized}@cliente.reservei.com.br`;
      const newUserId = crypto.randomUUID();
      const fallbackPassword = await hashPassword(crypto.randomUUID());
      const avatarUrl = params.photoUrl ? await saveClientImage(params.photoUrl) : null;

      await db.insert(users).values({
        id: newUserId,
        name: rawName,
        email,
        phone: params.phone.trim(),
        passwordHash: fallbackPassword,
        role: "customer",
        active: true,
        emailVerified: true,
        avatarUrl,
      });

      const [created] = await db
        .select()
        .from(users)
        .where(eq(users.id, newUserId))
        .limit(1);

      user = created!;
    } else {
      const updates: { name?: string; phone?: string; updatedAt: Date } = { updatedAt: new Date() };
      if (rawName && (!user.name || user.name === "Cliente")) {
        updates.name = rawName;
        user.name = rawName;
      }
      if (params.phone && params.phone.trim() && (!user.phone || user.phone !== params.phone.trim())) {
        updates.phone = params.phone.trim();
        user.phone = params.phone.trim();
        await db
          .update(clients)
          .set({ phone: params.phone.trim(), updatedAt: new Date() })
          .where(eq(clients.userId, user.id));
      }
      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, user.id));
    }

    await createSession(user.id);

    return {
      userId: user.id,
      customer: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        hasPin: false,
      },
      hasPin: false,
    };
  }
}
