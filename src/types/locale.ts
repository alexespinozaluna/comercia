// Locales soportados para el formato de fechas y números por Negocio.
// Lista cerrada compartida cliente/servidor: la UI de configuración la
// muestra y el API la valida (patrón ROLES_VALIDOS).

export const LOCALES_VALIDOS = [
  "es-CL",
  "es-PE",
  "es-AR",
  "es-BO",
  "es-CO",
  "es-MX",
] as const;

export type LocaleValido = (typeof LOCALES_VALIDOS)[number];

export const LOCALE_LABELS: Record<LocaleValido, string> = {
  "es-CL": "Chile (es-CL)",
  "es-PE": "Perú (es-PE)",
  "es-AR": "Argentina (es-AR)",
  "es-BO": "Bolivia (es-BO)",
  "es-CO": "Colombia (es-CO)",
  "es-MX": "México (es-MX)",
};

export const DEFAULT_LOCALE: LocaleValido = "es-CL";

export function esLocaleValido(l: unknown): l is LocaleValido {
  return typeof l === "string" && (LOCALES_VALIDOS as readonly string[]).includes(l);
}
