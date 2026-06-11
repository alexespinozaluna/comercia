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

// Decimales de montos por negocio: 0 (enteros, estilo CLP) o 2 (centavos).
export const DECIMALES_VALIDOS = [0, 2] as const;
export type DecimalesValidos = (typeof DECIMALES_VALIDOS)[number];

export const DECIMALES_LABELS: Record<DecimalesValidos, string> = {
  0: "Sin decimales — $ 37.500",
  2: "Con decimales — $ 37.500,00",
};

export const DEFAULT_DECIMALES: DecimalesValidos = 0;

export function esDecimalesValido(d: unknown): d is DecimalesValidos {
  return d === 0 || d === 2;
}

// Símbolo de la moneda nacional por locale. Se usa cuando
// Negocio.SimboloMoneda está vacío (default).
export const SIMBOLO_POR_LOCALE: Record<LocaleValido, string> = {
  "es-CL": "$",
  "es-PE": "S/",
  "es-AR": "$",
  "es-BO": "Bs",
  "es-CO": "$",
  "es-MX": "$",
};

export const DEFAULT_SIMBOLO = "$";
export const SIMBOLO_MAX_LEN = 8;

/** Símbolo efectivo: el configurado en el negocio si no está vacío;
 * si no, el de la moneda nacional del locale. */
export function simboloEfectivo(
  simboloMoneda: string | null | undefined,
  locale: string,
): string {
  const propio = simboloMoneda?.trim();
  if (propio) return propio;
  return esLocaleValido(locale) ? SIMBOLO_POR_LOCALE[locale] : DEFAULT_SIMBOLO;
}
