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
