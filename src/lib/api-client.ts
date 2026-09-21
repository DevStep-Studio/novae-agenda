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
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  if (digits.length <= 11) {
    return `55${digits}`;
  }
  if (digits.length === 12 && !digits.startsWith("55")) {
    return `55${digits}`;
  }
  return digits;
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}
