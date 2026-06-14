import { describe, it, expect } from "vitest";
import {
  parseDateOnly,
  toInputDate,
  fechaString,
  extraerIniciales,
  sbsLeft,
  formatNumero,
  numToString,
} from "./format";

describe("parseDateOnly", () => {
  it("interpreta YYYY-MM-DD como fecha LOCAL (no UTC)", () => {
    const d = parseDateOnly("2026-06-01");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // junio (0-index)
    expect(d.getDate()).toBe(1); // no salta al 31/05 por UTC
  });

  it("ignora la parte de hora si viene un timestamp", () => {
    const d = parseDateOnly("2026-12-31T23:59:59Z");
    expect(d.getDate()).toBe(31);
    expect(d.getMonth()).toBe(11);
  });
});

describe("toInputDate", () => {
  it("formatea una fecha local como YYYY-MM-DD", () => {
    expect(toInputDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("es inverso de parseDateOnly", () => {
    expect(toInputDate(parseDateOnly("2026-07-09"))).toBe("2026-07-09");
  });
});

describe("fechaString", () => {
  it("formatea dd/MM/yy con padding", () => {
    expect(fechaString(new Date(2026, 2, 4))).toBe("04/03/26");
  });
});

describe("extraerIniciales", () => {
  it("toma la inicial de las primeras 2 palabras en mayúscula", () => {
    expect(extraerIniciales("juan perez")).toBe("JP");
  });
  it("una sola palabra → una inicial", () => {
    expect(extraerIniciales("Madonna")).toBe("M");
  });
  it("vacío o espacios → cadena vacía", () => {
    expect(extraerIniciales("")).toBe("");
    expect(extraerIniciales("   ")).toBe("");
  });
});

describe("sbsLeft", () => {
  it("trunca con puntos suspensivos cuando excede", () => {
    expect(sbsLeft("abcdefgh", 3)).toBe("abc...");
  });
  it("no toca cadenas dentro del límite", () => {
    expect(sbsLeft("abc", 3)).toBe("abc");
  });
});

describe("formato de montos (fmt explícito, determinista)", () => {
  it("formatNumero respeta locale y decimales del negocio", () => {
    expect(formatNumero(37500, undefined, { locale: "es-CL", decimales: 0 })).toBe("37.500");
    expect(formatNumero(1234.5, undefined, { locale: "es-CL", decimales: 2 })).toBe("1.234,50");
  });
  it("N0/N2 fuerzan los decimales por encima de la config", () => {
    expect(formatNumero(1000, "N2", { locale: "es-CL", decimales: 0 })).toBe("1.000,00");
  });
  it("null/undefined se tratan como 0", () => {
    expect(formatNumero(null, "N0", { locale: "es-CL" })).toBe("0");
  });
  it("numToString antepone el símbolo de moneda", () => {
    expect(numToString(37500, "N0", { locale: "es-CL", simbolo: "S/" })).toBe("S/ 37.500");
  });
});
