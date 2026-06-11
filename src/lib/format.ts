const FALLBACK_LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? "es-CL";
const LOCALE_STORAGE_KEY = "app-locale";

// Locale activo del formateo. En el cliente lo fija el Negocio activo de la
// sesión (setLocale desde negocio-selector / configuración); se cachea en
// localStorage para evitar el flash con el fallback en recargas. En el
// servidor NUNCA se llama setLocale (estado de módulo compartido entre
// requests): los server components pasan el locale explícito como argumento.
let currentLocale =
  (typeof window !== "undefined" && window.localStorage.getItem(LOCALE_STORAGE_KEY)) ||
  FALLBACK_LOCALE;

export function setLocale(locale: string): void {
  currentLocale = locale;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

export function getLocale(): string {
  return currentLocale;
}

/** Número formateado SIN símbolo de moneda: 37.500 (N0) / 37.500,00 (N2). */
export function formatNumero(
  value: number | null | undefined,
  format: "N0" | "N2" = "N0",
  locale?: string,
): string {
  const safe = value ?? 0;
  const decimals = format === "N2" ? 2 : 0;
  return safe.toLocaleString(locale ?? currentLocale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Formato de moneda: $ 37.500 (separadores según el locale del negocio). */
export function numToString(
  value: number | null | undefined,
  format: "N0" | "N2" = "N0",
  locale?: string,
): string {
  return `$ ${formatNumero(value, format, locale)}`;
}

const formatDatePart = (date: Date) =>
  date.toLocaleDateString(currentLocale, { day: "2-digit", month: "short" });

const formatTimePart = (date: Date) =>
  date.toLocaleTimeString(currentLocale, {
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
  return value.toLocaleString(currentLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Cantidad: hasta 3 decimales, sin ceros sobrantes ("5", "5,5", "5,567"). */
export function cantidadString(value: number | null | undefined): string {
  const safe = value ?? 0;
  return safe.toLocaleString(currentLocale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

/** Parse a user-typed formatted string back to a number, según el locale
 * activo: "1.234,56" (es-CL) o "1,234.56" (es-PE/es-MX) → 1234.56. */
export function parseFormatted(raw: string): number {
  const parts = new Intl.NumberFormat(currentLocale).formatToParts(1234.5);
  const group = parts.find((p) => p.type === "group")?.value ?? ".";
  const decimal = parts.find((p) => p.type === "decimal")?.value ?? ",";
  const cleaned = raw.split(group).join("").replace(decimal, ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** ISO 8601 UTC para columnas TIMESTAMPTZ. Único punto de creación de timestamps en la app. */
export function nowIso(): string {
  return new Date().toISOString();
}
