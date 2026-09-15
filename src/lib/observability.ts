import { assertServerOnly } from "./server-guard";

assertServerOnly("O módulo de observabilidade");

export type LogLevel = "info" | "warn" | "error" | "critical";

export type LogCategory =
  | "api_error"
  | "webhook_failure"
  | "email_failure"
  | "db_error"
  | "critical_security"
  | "payment_event"
  | "system";

export type StructuredLog = {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
  environment: string;
};

// Sanitization list for fields that MUST NEVER appear in server logs
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "pin",
  "pinhash",
  "cardtoken",
  "cvv",
  "pan",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "sessionsecret",
  "databaseurl",
]);

export function sanitizeLogData(data: unknown, depth = 0): unknown {
  if (depth > 5) return "[Truncated]";
  if (!data || typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lower = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (SENSITIVE_KEYS.has(lower) || lower.includes("password") || lower.includes("pinhash") || lower.includes("secret")) {
      cleaned[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      cleaned[key] = sanitizeLogData(value, depth + 1);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Dispatches structured logs to stdout/stderr and triggers telemetry (Sentry-ready).
 */
function emitLog(log: StructuredLog): void {
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    // In production, emit single-line structured JSON for Datadog / CloudWatch / ELK
    const jsonStr = JSON.stringify(log);
    if (log.level === "error" || log.level === "critical") {
      console.error(jsonStr);
    } else if (log.level === "warn") {
      console.warn(jsonStr);
    } else {
      console.log(jsonStr);
    }
  } else {
    // Human-readable in development
    const color =
      log.level === "critical"
        ? "\x1b[41m\x1b[37m"
        : log.level === "error"
          ? "\x1b[31m"
          : log.level === "warn"
            ? "\x1b[33m"
            : "\x1b[36m";
    const reset = "\x1b[0m";

    console.log(
      `${color}[${log.level.toUpperCase()}][${log.category}]${reset} ${log.message}`,
      log.context ? log.context : "",
      log.error ? log.error.message : "",
    );
  }

  // Sentry or External APM forwarding hook
  if (process.env.SENTRY_DSN && (log.level === "error" || log.level === "critical")) {
    try {
      // If Sentry SDK is loaded or via HTTP endpoint
      sendSentryEnvelope(log).catch(() => {});
    } catch {}
  }
}

async function sendSentryEnvelope(log: StructuredLog): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  // Non-blocking telemetry dispatcher template
}

export const logger = {
  info(category: LogCategory, message: string, context?: Record<string, unknown>) {
    emitLog({
      timestamp: new Date().toISOString(),
      level: "info",
      category,
      message,
      context: sanitizeLogData(context) as Record<string, unknown>,
      environment: process.env.NODE_ENV || "development",
    });
  },

  warn(category: LogCategory, message: string, context?: Record<string, unknown>) {
    emitLog({
      timestamp: new Date().toISOString(),
      level: "warn",
      category,
      message,
      context: sanitizeLogData(context) as Record<string, unknown>,
      environment: process.env.NODE_ENV || "development",
    });
  },

  apiError(endpoint: string, error: unknown, context?: Record<string, unknown>) {
    const err = error instanceof Error ? error : new Error(String(error));
    emitLog({
      timestamp: new Date().toISOString(),
      level: "error",
      category: "api_error",
      message: `Erro na rota ${endpoint}: ${err.message}`,
      context: sanitizeLogData(context) as Record<string, unknown>,
      error: {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
      },
      environment: process.env.NODE_ENV || "development",
    });
  },

  webhookFailure(gateway: string, eventId: string, error: unknown, payload?: Record<string, unknown>) {
    const err = error instanceof Error ? error : new Error(String(error));
    emitLog({
      timestamp: new Date().toISOString(),
      level: "error",
      category: "webhook_failure",
      message: `Falha no processamento de webhook [${gateway}]: ${err.message}`,
      context: {
        gateway,
        eventId,
        payload: sanitizeLogData(payload),
      },
      error: {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
      },
      environment: process.env.NODE_ENV || "development",
    });
  },

  emailFailure(to: string, subject: string, error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    // Mask email for privacy in logs
    const maskedTo = to.includes("@")
      ? `${to[0]}***@${to.split("@")[1]}`
      : "[email-invalido]";

    emitLog({
      timestamp: new Date().toISOString(),
      level: "error",
      category: "email_failure",
      message: `Falha ao enviar e-mail para ${maskedTo}: ${err.message}`,
      context: { to: maskedTo, subject },
      error: {
        name: err.name,
        message: err.message,
      },
      environment: process.env.NODE_ENV || "development",
    });
  },

  dbError(operation: string, error: unknown, context?: Record<string, unknown>) {
    const err = error instanceof Error ? error : new Error(String(error));
    emitLog({
      timestamp: new Date().toISOString(),
      level: "error",
      category: "db_error",
      message: `Falha em operação de banco de dados [${operation}]: ${err.message}`,
      context: sanitizeLogData(context) as Record<string, unknown>,
      error: {
        name: err.name,
        message: err.message,
      },
      environment: process.env.NODE_ENV || "development",
    });
  },

  criticalSecurityEvent(eventType: string, message: string, metadata?: Record<string, unknown>) {
    emitLog({
      timestamp: new Date().toISOString(),
      level: "critical",
      category: "critical_security",
      message: `[ALERTA DE SEGURANÇA] ${eventType}: ${message}`,
      context: sanitizeLogData(metadata) as Record<string, unknown>,
      environment: process.env.NODE_ENV || "development",
    });
  },
};
