import { describe, it, expect } from "vitest";
import { datosTransferencia, mostrarDatosTransferencia, cuentasPorSucursal } from "./datos-transferencia";

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

describe("cuentasPorSucursal", () => {
  const sucursales = [
    { id: 1, Nombre: "Centro", DatosTransferencia: "Banco A" },
    { id: 2, Nombre: "Norte", DatosTransferencia: "Banco B" },
    { id: 3, Nombre: "Sur", DatosTransferencia: "" },
  ];

  it("una sola sucursal → solo sus cuentas", () => {
    const r = cuentasPorSucursal([{ IdNegocio: 2, Saldo: 100 }, { IdNegocio: 2, Saldo: 50 }], sucursales);
    expect(r).toEqual([{ idNegocio: 2, nombre: "Norte", texto: "Banco B", saldo: 150 }]);
  });

  it("varias sucursales → una entrada por sucursal con su saldo", () => {
    const r = cuentasPorSucursal([{ IdNegocio: 1, Saldo: 10 }, { IdNegocio: 2, Saldo: 20 }], sucursales);
    expect(r.map((c) => [c.idNegocio, c.saldo])).toEqual([[1, 10], [2, 20]]);
  });

  it("sin IdNegocio o sucursal desconocida → principal", () => {
    const r = cuentasPorSucursal([{ IdNegocio: null, Saldo: 10 }, { IdNegocio: 99, Saldo: 5 }], sucursales);
    expect(r).toEqual([{ idNegocio: 1, nombre: "Centro", texto: "Banco A", saldo: 15 }]);
  });

  it("omite sucursales sin datos cargados", () => {
    expect(cuentasPorSucursal([{ IdNegocio: 3, Saldo: 10 }], sucursales)).toEqual([]);
  });
});
