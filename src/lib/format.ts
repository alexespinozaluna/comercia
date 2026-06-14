const FALLBACK_LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? "es-CL";
const LOCALE_STORAGE_KEY = "app-locale";
const DECIMALES_STORAGE_KEY = "app-decimales";
const SIMBOLO_STORAGE_KEY = "app-simbolo";

// Formato regional activo (locale + decimales de montos). En el cliente lo
// fija el Negocio activo de la sesión (negocio-selector / configuración); se
// cachea en localStorage para evitar el flash con el fallback en recargas.
// En el servidor NUNCA se llaman los setters (estado de módulo compartido
// entre requests): los server components pasan el formato explícito (`fmt`).
let currentLocale =
  (typeof window !== "undefined" && window.localStorage.getItem(LOCALE_STORAGE_KEY)) ||
  FALLBACK_LOCALE;

let currentDecimales =
  typeof window !== "undefined" && window.localStorage.getItem(DECIMALES_STORAGE_KEY) === "2"
    ? 2
    : 0;

// Símbolo de moneda ya resuelto (la resolución vacío→moneda nacional del
// locale ocurre al aplicar la config del negocio, en el store).
let currentSimbolo =
  (typeof window !== "undefined" && window.localStorage.getItem(SIMBOLO_STORAGE_KEY)) || "$";

export function setLocale(locale: string): void {
  currentLocale = locale;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

export function getLocale(): string {
  return currentLocale;
}

export function setDecimales(decimales: number): void {
  currentDecimales = decimales === 2 ? 2 : 0;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DECIMALES_STORAGE_KEY, String(currentDecimales));
  }
}

export function getDecimales(): number {
  return currentDecimales;
}

export function setSimbolo(simbolo: string): void {
  currentSimbolo = simbolo;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SIMBOLO_STORAGE_KEY, simbolo);
  }
}

export function getSimbolo(): string {
  return currentSimbolo;
}

/** Override explícito de formato para server components (link público). */
export interface FormatoNegocio {
  locale?: string;
  decimales?: number;
  simbolo?: string;
}

/** Número formateado SIN símbolo de moneda: 37.500 / 37.500,00.
 * Sin `format` explícito, los decimales salen de la configuración del
 * negocio (Negocio.Decimales); "N0"/"N2" fuerzan 0/2. */
export function formatNumero(
  value: number | null | undefined,
  format?: "N0" | "N2",
  fmt?: FormatoNegocio,
): string {
  const safe = value ?? 0;
  const decimals =
    format === "N2" ? 2 : format === "N0" ? 0 : fmt?.decimales ?? currentDecimales;
  return safe.toLocaleString(fmt?.locale ?? currentLocale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Formato de moneda: "$ 37.500" / "S/ 1,234.56" — símbolo, separadores y
 * decimales según la configuración del negocio. */
export function numToString(
  value: number | null | undefined,
  format?: "N0" | "N2",
  fmt?: FormatoNegocio,
): string {
  return `${fmt?.simbolo ?? currentSimbolo} ${formatNumero(value, format, fmt)}`;
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

/** Monto para input editable, según los decimales del negocio (Negocio.Decimales):
 * 0 → "1.500", 2 → "1.500,00". Sin símbolo de moneda (el prefijo lo pone el
 * input). Inverso de `parseFormatted`. */
export function formatMontoInput(value: number | null | undefined): string {
  return formatNumero(value);
}

/** Cantidad: hasta 3 decimales, sin ceros sobrantes ("5", "5,5", "5,567").
 * Sin `fmt` usa el locale activo; los renders server-side (ticket) lo pasan
 * explícito desde el negocio. */
export function cantidadString(
  value: number | null | undefined,
  fmt?: FormatoNegocio,
): string {
  const safe = value ?? 0;
  return safe.toLocaleString(fmt?.locale ?? currentLocale, {
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
