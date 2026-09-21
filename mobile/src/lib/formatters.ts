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
  let digits = String(phone).replace(/\D/g, "");
  if (digits.length === 0) return "";

  while (digits.startsWith("5555")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0") && digits.length >= 11) {
    digits = digits.slice(1);
  }

  if (digits.startsWith("55")) {
    let national = digits.slice(2);
    if (national.startsWith("0")) {
      national = national.slice(1);
    }
    if (national.length > 11) {
      national = national.slice(0, 11);
    }
    return `55${national}`;
  }

  if (digits.length > 11) {
    digits = digits.slice(0, 11);
  }

  return `55${digits}`;
}

export function formatPhoneInput(value: string | null | undefined): string {
  if (!value) return "";
  let digits = String(value).replace(/\D/g, "");
  while (digits.startsWith("5555")) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0") && digits.length >= 11) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

