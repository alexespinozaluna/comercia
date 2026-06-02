const localInfo = process.env.NEXT_PUBLIC_LOCALE ?? "es-CL";

/** Formato de moneda chilena: $ 37.500 */
export function numToString(
  value: number | null | undefined,
  format: "N0" | "N2" = "N0",
): string {
  const safe = value ?? 0;
  const decimals = format === "N2" ? 2 : 0;
  return `$ ${safe.toLocaleString(localInfo, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

const formatDatePart = (date: Date) =>
  date.toLocaleDateString(localInfo, { day: "2-digit", month: "short" });

const formatTimePart = (date: Date) =>
  date.toLocaleTimeString(localInfo, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

/** Parsea "YYYY-MM-DD" (Postgres DATE) como fecha LOCAL, no UTC.
 * `new Date("2026-06-01")` interpreta UTC y en zonas negativas (Chile) salta
 * al día anterior. Este helper evita ese bug. */
export function parseDateOnly(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Formato fecha corta con hora: dd/MMM | h:mm tt si la fecha de emisión y la
 * de creación caen el mismo día calendario local; si difieren, solo dd/MMM.
 *
 * @param fechaEmisionStr — string de columna DATE (ej. "2026-06-01")
 * @param fechaCreacionIso — string de columna TIMESTAMPTZ (ej. "2026-06-02T05:30:00Z")
 */
export function fechaCortaHora(fechaEmisionStr: string, fechaCreacionIso: string): string {
  const fechaEmision = parseDateOnly(fechaEmisionStr);
  const fechaCreacion = new Date(fechaCreacionIso);
  if (fechaEmision.toDateString() === fechaCreacion.toDateString()) {
    return `${formatDatePart(fechaCreacion)} | ${formatTimePart(fechaCreacion)}`;
  }
  return formatDatePart(fechaEmision);
}

/** Formato fecha corta: dd/MM/yy */
export function fechaString(fechaHora: Date): string {
  const d = fechaHora.getDate().toString().padStart(2, "0");
  const m = (fechaHora.getMonth() + 1).toString().padStart(2, "0");
  const y = fechaHora.getFullYear().toString().slice(-2);
  return `${d}/${m}/${y}`;
}

/**
 * Fecha local en formato YYYY-MM-DD para `<input type="date">`.
 * Usa la fecha local del sistema (NO toISOString, que da UTC y puede
 * adelantar/atrasar un día en zonas como es-CL).
 */
export function toInputDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Extrae iniciales de las primeras 2 palabras del nombre */
export function extraerIniciales(nombre: string): string {
  if (!nombre?.trim()) return "";
  const palabras = nombre.trim().split(" ").slice(0, 2);
  return palabras.map((p) => p[0]).join("").toUpperCase();
}

/** Trunca string con ... si excede la cantidad */
export function sbsLeft(value: string, cant: number): string {
  return value.length > cant ? `${value.substring(0, cant)}...` : value;
}

/** Format a number for an editable text input (es-CL: "1.234,56"). No currency prefix. */
export function formatN2(value: number): string {
  return value.toLocaleString(localInfo, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Parse a user-typed es-CL formatted string back to a number ("1.234,56" → 1234.56). */
export function parseFormatted(raw: string): number {
  const cleaned = raw.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** ISO 8601 UTC para columnas TIMESTAMPTZ. Único punto de creación de timestamps en la app. */
export function nowIso(): string {
  return new Date().toISOString();
}
