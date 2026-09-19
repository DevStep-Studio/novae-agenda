/**
 * Pure formatters for currency, phone and strings used across mobile screens and tests.
 */

export function formatBRL(value: number | string | null | undefined): string {
  const num = typeof value === "number" ? value : Number(value);
  if (isNaN(num) || !isFinite(num)) {
    return "R$\u00a00,00";
  }
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPhoneForWhatsApp(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 0) return "";
  return digits.length <= 11 ? `55${digits}` : digits;
}

export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

