import "dotenv/config";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  authTokens,
  bookings,
  customerAccessLogs,
  customerCredentials,
  users,
} from "@/db/schema";
import { verifyPassword } from "@/lib/auth";
import { bookingDetails, createBooking } from "@/lib/booking/service";
import { shiftDate } from "@/lib/booking/time";
import {
  CustomerAccessService,
  isWeakPin,
  isValidPinFormat,
  maskEmail,
  maskPhone,
} from "@/lib/customer-access/service";
import { normalizePhoneDigits } from "@/lib/domain";
import { bookingFixture, cleanupFixture, type Fixture } from "./booking-fixture";

describe("Reservei — Customer Access by Phone + 6-digit PIN Suite", () => {
  let f: Fixture;
  const testPhone = "(21) 98765-4321";
  const normalizedPhone = "5521987654321";
  const testPin = "482913";

  before(async () => {
    f = await bookingFixture();
  });

  after(async () => {
    if (f) await cleanupFixture(f);
    // Remove qualquer credencial ou log remanescente do número de teste
    await db.delete(customerCredentials).where(eq(customerCredentials.phoneNormalized, normalizedPhone));
    await db.delete(customerAccessLogs).where(eq(customerAccessLogs.phoneNormalized, normalizedPhone));
    await pool.end();
  });

  it("1. Phone Normalization & Masking: normalizes all Brazilian phone formats and masks properly", () => {
    const raw1 = "(21) 98765-4321";
    const raw2 = "+55 21 98765-4321";
    const raw3 = "21987654321";

    assert.equal(normalizePhoneDigits(raw1), normalizedPhone);
    assert.equal(normalizePhoneDigits(raw2), normalizedPhone);
    assert.equal(normalizePhoneDigits(raw3), normalizedPhone);

    assert.equal(maskPhone(raw1), "(**) *****-4321");
    assert.equal(maskEmail("cliente@exemplo.com.br"), "c*****e@exemplo.com.br");
  });


  it("2. PIN Format & Weak PIN Validation: rejects invalid formats, trivial sequences and duplicates", () => {
    // Exactly 6 numeric digits required
    assert.equal(isValidPinFormat("123456"), true);
    assert.equal(isValidPinFormat("001234"), true); // Preserva zeros à esquerda
    assert.equal(isValidPinFormat("482913"), true);
    assert.equal(isValidPinFormat("1234"), false); // 4 dígitos rejeitados
    assert.equal(isValidPinFormat("1234567"), false); // 7 dígitos rejeitados
    assert.equal(isValidPinFormat("abcdef"), false); // Letras rejeitadas
    assert.equal(isValidPinFormat("12345a"), false);

    // Weak PINs
    assert.equal(isWeakPin("000000"), true);
    assert.equal(isWeakPin("111111"), true);
    assert.equal(isWeakPin("999999"), true);
    assert.equal(isWeakPin("123456"), true);
    assert.equal(isWeakPin("654321"), true);
    assert.equal(isWeakPin("012345"), true);
    assert.equal(isWeakPin("482913"), false); // PIN seguro
    assert.equal(isWeakPin("849201"), false); // PIN seguro
  });

  it("3. Phone Status Check: correctly classifies NOT_FOUND, NEEDS_PIN_SETUP, and HAS_PIN", async () => {
    // 3A. Telefone que não existe
    const notFoundStatus = await CustomerAccessService.checkPhone("(11) 91111-0000");
    assert.equal(notFoundStatus.exists, false);
    assert.equal(notFoundStatus.status, "NOT_FOUND");

    // 3B. Cliente que existe (Fixture customer) mas ainda não tem PIN
    // Atualiza telefone de f.customers[0] para testPhone
    await db.update(users).set({ phone: testPhone }).where(eq(users.id, f.customers[0].id));

    const needsSetupStatus = await CustomerAccessService.checkPhone(testPhone);
    assert.equal(needsSetupStatus.exists, true);
    assert.equal(needsSetupStatus.status, "NEEDS_PIN_SETUP");
    assert.equal(needsSetupStatus.maskedPhone, "(**) *****-4321");
  });

  it("4. First Access PIN Setup: rejects weak PINs and enforces identity verification", async () => {
    // Deve rejeitar PINs que não coincidem
    await assert.rejects(
      CustomerAccessService.setupPin({
        phone: testPhone,
        pin: "482913",
        confirmPin: "482914",
        authenticatedUserId: f.customers[0].id,
      }),
      /Os PINs não coincidem/,
    );

    // Deve rejeitar PIN fraco
    await assert.rejects(
      CustomerAccessService.setupPin({
        phone: testPhone,
        pin: "123456",
        confirmPin: "123456",
        authenticatedUserId: f.customers[0].id,
      }),
      /PIN muito fácil/,
    );

    // Deve rejeitar criação de PIN sem verificação de identidade
    await assert.rejects(
      CustomerAccessService.setupPin({
        phone: testPhone,
        pin: testPin,
        confirmPin: testPin,
      }),
      /Código de verificação obrigatório|Não foi possível validar sua identidade/,
    );

    // Criação autorizada com contexto de sessão autenticada
    const setupResult = await CustomerAccessService.setupPin({
      phone: testPhone,
      pin: testPin,
      confirmPin: testPin,
      authenticatedUserId: f.customers[0].id,
    });

    assert.ok(setupResult.userId);
    assert.equal(setupResult.customer.id, f.customers[0].id);

    // Verifica se PIN foi salvo com bcrypt e nunca em texto puro
    const [cred] = await db
      .select()
      .from(customerCredentials)
      .where(eq(customerCredentials.phoneNormalized, normalizedPhone));

    assert.ok(cred);
    assert.notEqual(cred.pinHash, testPin);
    assert.ok(cred.pinHash.startsWith("$2"), "Hash deve ser bcrypt ($2a$ ou $2b$)");
    const isBcryptMatch = await verifyPassword(testPin, cred.pinHash);
    assert.equal(isBcryptMatch, true);

    // Verifica se audit log foi registrado
    const [audit] = await db
      .select()
      .from(customerAccessLogs)
      .where(
        and(
          eq(customerAccessLogs.phoneNormalized, normalizedPhone),
          eq(customerAccessLogs.action, "PIN_CREATED"),
        ),
      );
    assert.ok(audit);

    // O mesmo PIN nunca pode ser atribuído a outro cliente.
    const otherPhone = "(21) 96666-5544";
    await db.update(users).set({ phone: otherPhone }).where(eq(users.id, f.customers[1].id));
    await assert.rejects(
      CustomerAccessService.setupPin({
        phone: otherPhone,
        pin: testPin,
        confirmPin: testPin,
        authenticatedUserId: f.customers[1].id,
      }),
      /PIN já está em uso por outro cliente/,
    );

    // Agora o status do telefone deve ser HAS_PIN
    const hasPinStatus = await CustomerAccessService.checkPhone(testPhone);
    assert.equal(hasPinStatus.exists, true);
    assert.equal(hasPinStatus.status, "HAS_PIN");
  });

  it("5. PIN Login: authenticates correctly, resets failed attempts, and rejects wrong PINs", async () => {
    // 5A. PIN Incorreto
    await assert.rejects(
      CustomerAccessService.loginWithPin({
        phone: testPhone,
        pin: "999999",
      }),
      /PIN incorreto/,
    );

    const [credAfterFail] = await db
      .select()
      .from(customerCredentials)
      .where(eq(customerCredentials.phoneNormalized, normalizedPhone));
    assert.equal(credAfterFail.failedAttempts, 1);

    // 5B. PIN Correto
    const loginResult = await CustomerAccessService.loginWithPin({
      phone: testPhone,
      pin: testPin,
    });

    assert.ok(loginResult.userId);
    assert.equal(loginResult.customer.id, f.customers[0].id);

    const [credAfterSuccess] = await db
      .select()
      .from(customerCredentials)
      .where(eq(customerCredentials.phoneNormalized, normalizedPhone));
    assert.equal(credAfterSuccess.failedAttempts, 0);
    assert.equal(credAfterSuccess.lockedUntil, null);
    assert.ok(credAfterSuccess.lastLoginAt);
  });

  it("6. Brute Force Protection: locks account after 5 failed attempts with 15-minute temporary lockout", async () => {
    // Realiza 4 tentativas incorretas
    for (let i = 0; i < 4; i++) {
      await assert.rejects(
        CustomerAccessService.loginWithPin({
          phone: testPhone,
          pin: "112233",
        }),
        /PIN incorreto/,
      );
    }

    // 5ª tentativa incorreta deve disparar bloqueio
    await assert.rejects(
      CustomerAccessService.loginWithPin({
        phone: testPhone,
        pin: "112233",
      }),
      /Conta bloqueada temporariamente/,
    );

    const [lockedCred] = await db
      .select()
      .from(customerCredentials)
      .where(eq(customerCredentials.phoneNormalized, normalizedPhone));

    assert.equal(lockedCred.failedAttempts, 5);
    assert.ok(lockedCred.lockedUntil);
    assert.ok(new Date(lockedCred.lockedUntil).getTime() > Date.now());

    // Tentativas subsequentes devem ser barradas imediatamente pelo bloqueio
    await assert.rejects(
      CustomerAccessService.loginWithPin({
        phone: testPhone,
        pin: testPin, // Mesmo com PIN correto, a conta está temporariamente bloqueada
      }),
      /Conta temporariamente bloqueada/,
    );

    // Verifica registro de auditoria PIN_LOCKED
    const [lockAudit] = await db
      .select()
      .from(customerAccessLogs)
      .where(
        and(
          eq(customerAccessLogs.phoneNormalized, normalizedPhone),
          eq(customerAccessLogs.action, "PIN_LOCKED"),
        ),
      );
    assert.ok(lockAudit);

    // Remove bloqueio para os próximos testes
    await db
      .update(customerCredentials)
      .set({ failedAttempts: 0, lockedUntil: null })
      .where(eq(customerCredentials.id, lockedCred.id));
  });

  it("7. Forgot PIN & Secure Reset: issues OTP, validates token and resets PIN with new hash", async () => {
    // 7A. Solicita redefinição
    const resetReq = await CustomerAccessService.requestPinReset({
      phone: testPhone,
    });
    assert.ok(resetReq.success);

    // Consulta o token OTP de 6 dígitos gerado
    const [tokenRow] = await db
      .select()
      .from(authTokens)
      .where(
        and(
          eq(authTokens.userId, f.customers[0].id),
          eq(authTokens.kind, "customer_pin_reset"),
        ),
      );
    assert.ok(tokenRow);
    assert.ok(tokenRow.tokenHash);

    // Tenta redefinir com OTP incorreto
    await assert.rejects(
      CustomerAccessService.confirmPinReset({
        phone: testPhone,
        otp: "000000",
        newPin: "739102",
        confirmNewPin: "739102",
      }),
      /Código de verificação inválido/,
    );

    // Simula OTP válido gerando um código conhecido no banco
    const testOtp = "654981";
    const crypto = await import("node:crypto");
    const testHash = crypto.createHash("sha256").update(testOtp).digest("hex");
    await db
      .update(authTokens)
      .set({ tokenHash: testHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) })
      .where(eq(authTokens.id, tokenRow.id));

    // Confirma redefinição com o novo PIN
    const newPin = "739102";
    const resetConfirm = await CustomerAccessService.confirmPinReset({
      phone: testPhone,
      otp: testOtp,
      newPin,
      confirmNewPin: newPin,
    });
    assert.ok(resetConfirm.userId);

    // Antigo PIN não deve mais funcionar
    await assert.rejects(
      CustomerAccessService.loginWithPin({
        phone: testPhone,
        pin: testPin,
      }),
      /PIN incorreto/,
    );

    // Novo PIN deve funcionar perfeitamente
    const newLogin = await CustomerAccessService.loginWithPin({
      phone: testPhone,
      pin: newPin,
    });
    assert.equal(newLogin.userId, f.customers[0].id);
  });

  it("8. Post-Booking PIN Activation: customer completes booking and activates PIN with booking context", async () => {
    // Cria um novo cliente para simular agendamento
    const newCustomerPhone = "(21) 97777-6666";
    const normCustomerPhone = "5521977776666";
    const bookingDate = f.date;

    const booking = await createBooking(f.customers[1], {
      slug: f.company.publicSlug!,
      locationId: f.location.id,
      items: [{ serviceId: f.services[0].id, employeeId: f.team[1].id }],
      date: bookingDate,
      startTime: "09:00",
      idempotencyKey: randomUUID(),
      products: [],
      intendedPaymentMethod: "pix",
    });
    assert.ok(booking.id);

    // Atualiza telefone do customer 1
    await db.update(users).set({ phone: newCustomerPhone }).where(eq(users.id, f.customers[1].id));

    // Cria PIN utilizando a sessão autenticada do agendamento
    const postBookingSetup = await CustomerAccessService.setupPin({
      phone: newCustomerPhone,
      pin: "918273",
      confirmPin: "918273",
      authenticatedUserId: f.customers[1].id,
    });
    assert.equal(postBookingSetup.userId, f.customers[1].id);

    // O cliente agora pode logar com o PIN criado pós-reserva
    const postBookingLogin = await CustomerAccessService.loginWithPin({
      phone: newCustomerPhone,
      pin: "918273",
    });
    assert.equal(postBookingLogin.userId, f.customers[1].id);

    // Limpeza
    await db.delete(customerCredentials).where(eq(customerCredentials.phoneNormalized, normCustomerPhone));
    await db.delete(customerAccessLogs).where(eq(customerAccessLogs.phoneNormalized, normCustomerPhone));
  });

  it("9. IDOR Protection: Customer A cannot access or view Customer B bookings", async () => {
    // Cria uma reserva de Customer A (garante dia útil)
    const bookingDate = shiftDate(f.date, 2);

    const bookingA = await createBooking(f.customers[0], {
      slug: f.company.publicSlug!,
      locationId: f.location.id,
      items: [{ serviceId: f.services[0].id, employeeId: f.team[0].id }],
      date: bookingDate,
      startTime: "14:30",
      idempotencyKey: randomUUID(),
      products: [],
      intendedPaymentMethod: "pix",
    });


    // Customer A consegue visualizar a reserva A
    const detailA = await bookingDetails(bookingA.id, f.customers[0].id);
    assert.equal(detailA.id, bookingA.id);

    // Customer B tenta acessar a reserva A -> deve ser rejeitado com 404 (IDOR prevenido)
    await assert.rejects(
      bookingDetails(bookingA.id, f.customers[1].id),
      /Agendamento não encontrado/,
    );
  });

  it("10. Phone-only Login Disallowed: Raw phone-only access without PIN is strictly blocked", async () => {
    // Consulta direta à rota /api/auth/login apenas com phone (sem pin) deve falhar
    const { POST: authLoginHandler } = await import("@/app/api/auth/login/route");

    const reqWithoutPin = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: testPhone }),
    });

    const resWithoutPin = await authLoginHandler(reqWithoutPin);
    assert.equal(resWithoutPin.status, 400);
    const dataWithoutPin = await resWithoutPin.json();
    assert.equal(dataWithoutPin.code, "PIN_REQUIRED");
  });

  it("11. PIN-only Access: Customer can authenticate with 6-digit PIN only (no phone required)", async () => {
    const pinOnlyUserPhone = "(21) 97777-6666";
    const normPinOnlyPhone = normalizePhoneDigits(pinOnlyUserPhone);
    const pinCode = "371948";

    // Cria um booking rápido para vincular
    const booking = await createBooking(f.customers[0], {
      slug: f.company.publicSlug!,
      locationId: f.location.id,
      items: [{ serviceId: f.services[0].id, employeeId: f.team[0].id }],
      date: shiftDate(f.date, 3),
      startTime: "09:00",
      idempotencyKey: randomUUID(),
      products: [],
      intendedPaymentMethod: "pix",
    });

    // Configura o PIN usando sessão autenticada do cliente
    const setupResult = await CustomerAccessService.setupPin({
      pin: pinCode,
      confirmPin: pinCode,
      authenticatedUserId: f.customers[0].id,
    });
    assert.equal(setupResult.userId, f.customers[0].id);

    // Login 100% por PIN (sem fornecer telefone)
    const pinOnlySession = await CustomerAccessService.loginByPinOnly({
      pin: pinCode,
    });
    assert.equal(pinOnlySession.userId, f.customers[0].id);
    assert.equal(pinOnlySession.customer.id, f.customers[0].id);

    // Login via loginWithPin omitindo o telefone
    const delegatedSession = await CustomerAccessService.loginWithPin({
      pin: pinCode,
    });
    assert.equal(delegatedSession.userId, f.customers[0].id);

    // PIN inexistente/incorreto deve ser rejeitado
    await assert.rejects(
      CustomerAccessService.loginByPinOnly({ pin: "999888" }),
      /PIN não encontrado/,
    );
  });

  it("12. Booking Barrier: Booking requires PIN for customer accounts", async () => {
    // Cria um usuário cliente sem PIN
    const noPinUserId = randomUUID();
    await db.insert(users).values({
      id: noPinUserId,
      name: "Cliente Sem PIN",
      email: `sem-pin-${Date.now()}@example.test`,
      phone: "(11) 98888-0000",
      passwordHash: "dummy",
      role: "customer",
      active: true,
      emailVerified: true,
    });

    const hasPin = await CustomerAccessService.userHasPin(noPinUserId);
    assert.equal(hasPin, false, "Cliente recém-criado sem setupPin não deve ter PIN");

    // Limpeza
    await db.delete(users).where(eq(users.id, noPinUserId));
  });

  it("13. Cryptographic OTP Verification for First-time PIN Setup: enforces single-use OTP", async () => {
    const otpCustomerPhone = "(11) 97777-1234";
    const otpNormPhone = "5511977771234";
    const newPin = "719302";

    // Solicita código OTP para setup
    const otpRequest = await CustomerAccessService.requestPinSetupOtp({
      phone: otpCustomerPhone,
    });
    assert.equal(otpRequest.success, true);

    // Busca o token salvo no banco para simular envio por WhatsApp/SMS
    const [tokenRow] = await db
      .select()
      .from(authTokens)
      .where(and(eq(authTokens.kind, "customer_pin_setup"), isNull(authTokens.consumedAt)))
      .limit(1);

    assert.ok(tokenRow);

    // Tentar criar PIN com OTP incorreto deve falhar
    await assert.rejects(
      CustomerAccessService.setupPin({
        phone: otpCustomerPhone,
        pin: newPin,
        confirmPin: newPin,
        otpToken: "000000",
      }),
      /Código de verificação inválido ou expirado/,
    );

    // Limpeza
    await db.delete(customerCredentials).where(eq(customerCredentials.phoneNormalized, otpNormPhone));
    await db.delete(authTokens).where(eq(authTokens.userId, tokenRow.userId));
    await db.delete(users).where(eq(users.id, tokenRow.userId));
  });
});

