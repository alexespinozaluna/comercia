import { describe, it, expect } from "vitest";
import { datosTransferencia, mostrarDatosTransferencia } from "./datos-transferencia";

describe("datosTransferencia", () => {
  it("devuelve el texto recortado", () => {
    expect(datosTransferencia({ DatosTransferencia: "  Banco X\nCta 1  " })).toBe("Banco X\nCta 1");
  });
  it("vacío si no hay negocio o campo", () => {
    expect(datosTransferencia(null)).toBe("");
    expect(datosTransferencia({ DatosTransferencia: "" })).toBe("");
  });
});

describe("mostrarDatosTransferencia", () => {
  it("solo crédito con saldo pendiente", () => {
    expect(mostrarDatosTransferencia({ bCredito: true, Saldo: 100 })).toBe(true);
    expect(mostrarDatosTransferencia({ bCredito: true, Saldo: 0 })).toBe(false);
    expect(mostrarDatosTransferencia({ bCredito: false, Saldo: 100 })).toBe(false);
  });
});
