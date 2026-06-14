import { describe, it, expect } from "vitest";
import {
  esLocaleValido,
  esDecimalesValido,
  simboloEfectivo,
  DEFAULT_SIMBOLO,
  LOCALES_VALIDOS,
} from "./locale";

describe("esLocaleValido", () => {
  it("acepta los locales de la lista cerrada", () => {
    for (const l of LOCALES_VALIDOS) expect(esLocaleValido(l)).toBe(true);
  });
  it("rechaza locales fuera de la lista y no-strings", () => {
    expect(esLocaleValido("en-US")).toBe(false);
    expect(esLocaleValido("")).toBe(false);
    expect(esLocaleValido(null)).toBe(false);
    expect(esLocaleValido(123)).toBe(false);
  });
});

describe("esDecimalesValido", () => {
  it("solo 0 o 2 son válidos", () => {
    expect(esDecimalesValido(0)).toBe(true);
    expect(esDecimalesValido(2)).toBe(true);
    expect(esDecimalesValido(1)).toBe(false);
    expect(esDecimalesValido("2")).toBe(false);
  });
});

describe("simboloEfectivo", () => {
  it("usa el símbolo propio del negocio si no está vacío", () => {
    expect(simboloEfectivo("US$", "es-CL")).toBe("US$");
    expect(simboloEfectivo("  Gs ", "es-PE")).toBe("Gs");
  });
  it("si está vacío, cae en la moneda nacional del locale", () => {
    expect(simboloEfectivo("", "es-PE")).toBe("S/");
    expect(simboloEfectivo(null, "es-BO")).toBe("Bs");
    expect(simboloEfectivo(undefined, "es-CL")).toBe("$");
  });
  it("locale desconocido usa el símbolo por defecto", () => {
    expect(simboloEfectivo(null, "en-US")).toBe(DEFAULT_SIMBOLO);
  });
});
