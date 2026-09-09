import type { BookingDetails } from "./service";
function escape(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
const stamp = (date: Date | string) =>
  new Date(date)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
export function calendarIcs(b: BookingDetails) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Reservei//Agendamentos//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.id}@reservei`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(b.startsAt)}`,
    `DTEND:${stamp(b.endsAt)}`,
    `SUMMARY:${escape(b.items.map((i) => i.name).join(" + "))}`,
    `LOCATION:${escape(b.company.address ?? b.company.name)}`,
    `DESCRIPTION:${escape(`${b.company.name}\n${b.items.map((i) => i.employeeName).join(", ")}`)}`,
    `STATUS:${b.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    `SEQUENCE:${b.revision}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // Fold by UTF-8 bytes, preserving multibyte characters (RFC 5545).
  return (
    lines
      .map((line) => {
        let result = "",
          column = 0;
        for (const char of line) {
          const size = Buffer.byteLength(char);
          if (column + size > 73) {
            result += "\r\n ";
            column = 1;
          }
          result += char;
          column += size;
        }
        return result;
      })
      .join("\r\n") + "\r\n"
  );
}
