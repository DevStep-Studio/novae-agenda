export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message = body?.error ?? "Não foi possível concluir a operação. Tente novamente.";
    throw new ApiError(message, res.status);
  }

  return (body !== null && typeof body === "object" && "data" in body
    ? body.data
    : body) as T;
}

export function formatPhoneForWhatsApp(phone: string | null | undefined): string {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.length === 0) return "";

  // Remove duplicate 55 prefixes (e.g. 5555...)
  while (digits.startsWith("5555")) {
    digits = digits.slice(2);
  }

  // Remove leading 0 (e.g. 021 99678-9171 -> length >= 11)
  if (digits.startsWith("0") && digits.length >= 11) {
    digits = digits.slice(1);
  }

  // If already starts with 55
  if (digits.startsWith("55")) {
    let national = digits.slice(2);
    if (national.startsWith("0")) {
      national = national.slice(1);
    }
    // In Brazil, national number is at most 11 digits (2 DDD + 9 mobile or 8 landline)
    if (national.length > 11) {
      national = national.slice(0, 11);
    }
    return `55${national}`;
  }

  // If does not start with 55: cap to max 11 digits
  if (digits.length > 11) {
    digits = digits.slice(0, 11);
  }

  return `55${digits}`;
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  while (digits.startsWith("5555")) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0") && digits.length >= 11) {
    digits = digits.slice(1);
  }
  // Cap at 11 digits for national number
  digits = digits.slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function maskPhoneInput(value: string | null | undefined): string {
  return formatPhoneDisplay(value);
}

export function isValidPhone(value: string | null | undefined): boolean {
  if (!value) return false;
  let digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0") && digits.length >= 11) {
    digits = digits.slice(1);
  }
  return digits.length >= 10 && digits.length <= 11;
}

