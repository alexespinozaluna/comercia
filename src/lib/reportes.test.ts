import { describe, it, expect } from "vitest";
import { agruparIngresosPorMetodo, SIN_METODO } from "./reportes";
import { TipoDoc } from "./tipo-documento";
import type { Documento } from "@/types/database";

// Factory mínima: solo los campos que lee agruparIngresosPorMetodo.
function doc(
  tipo: number,
  total: number,
  opts: { metodo?: string; bCredito?: boolean } = {},
): Documento {
  return {
    IdTipoDocumento: tipo,
    Total: total,
    bCredito: opts.bCredito ?? false,
    MetodoPago: opts.metodo ? { Nombre: opts.metodo } : null,
  } as unknown as Documento;
}

describe("agruparIngresosPorMetodo", () => {
  it("venta de contado: cuenta como venta y efectivo, y arma el grupo", () => {
    const { grupos, totales } = agruparIngresosPorMetodo([
      doc(TipoDoc.VENTA, 1000, { metodo: "Efectivo" }),
    ]);
    expect(totales.ventas).toBe(1000);
    expect(totales.efectivo).toBe(1000);
    expect(totales.balance).toBe(1000);
    expect(grupos).toEqual([
      { metodo: "Efectivo", countVentas: 1, venta: 1000, abonos: 0 },
    ]);
  });

  it("venta a crédito: suma a ventas pero NO a efectivo", () => {
    const { totales } = agruparIngresosPorMetodo([
      doc(TipoDoc.VENTA, 500, { metodo: "Deuda", bCredito: true }),
    ]);
    expect(totales.ventas).toBe(500);
    expect(totales.efectivo).toBe(0);
    expect(totales.balance).toBe(0);
  });

  it("gasto resta del balance y no aparece en grupos", () => {
    const { grupos, totales } = agruparIngresosPorMetodo([
      doc(TipoDoc.VENTA, 1000, { metodo: "Efectivo" }),
      doc(TipoDoc.GASTO, 300, { metodo: "Efectivo" }),
    ]);
    expect(totales.balance).toBe(700); // 1000 efectivo - 300 gasto
    expect(grupos).toHaveLength(1);
    expect(grupos[0].metodo).toBe("Efectivo");
    expect(grupos[0].venta).toBe(1000);
  });

  it("abono cuenta en totales.abono y en el grupo, y suma al balance", () => {
    const { grupos, totales } = agruparIngresosPorMetodo([
      doc(TipoDoc.ABONO, 250, { metodo: "Efectivo" }),
    ]);
    expect(totales.abono).toBe(250);
    expect(totales.balance).toBe(250);
    expect(grupos[0]).toEqual({ metodo: "Efectivo", countVentas: 0, venta: 0, abonos: 250 });
  });

  it("captura de saldo a favor (no crédito) cuenta como efectivo, no como venta ni grupo", () => {
    const { grupos, totales } = agruparIngresosPorMetodo([
      doc(TipoDoc.SALDO_FAVOR, 400),
    ]);
    expect(totales.efectivo).toBe(400);
    expect(totales.ventas).toBe(0);
    expect(totales.balance).toBe(400);
    expect(grupos).toHaveLength(0); // solo ventas/abonos forman grupos
  });

  it("sin método de pago → grupo NINGUNO y siempre al final", () => {
    const { grupos } = agruparIngresosPorMetodo([
      doc(TipoDoc.VENTA, 100), // sin método → NINGUNO
      doc(TipoDoc.VENTA, 50, { metodo: "Tarjeta" }),
    ]);
    expect(grupos[grupos.length - 1].metodo).toBe(SIN_METODO);
  });

  it("ordena los grupos por (venta+abonos) descendente", () => {
    const { grupos } = agruparIngresosPorMetodo([
      doc(TipoDoc.VENTA, 100, { metodo: "Tarjeta" }),
      doc(TipoDoc.VENTA, 900, { metodo: "Efectivo" }),
      doc(TipoDoc.VENTA, 500, { metodo: "Transferencia" }),
    ]);
    expect(grupos.map((g) => g.metodo)).toEqual([
      "Efectivo",
      "Transferencia",
      "Tarjeta",
    ]);
  });

  it("agrupa varias ventas del mismo método sumando count y total", () => {
    const { grupos } = agruparIngresosPorMetodo([
      doc(TipoDoc.VENTA, 100, { metodo: "Efectivo" }),
      doc(TipoDoc.VENTA, 200, { metodo: "Efectivo" }),
    ]);
    expect(grupos[0]).toEqual({ metodo: "Efectivo", countVentas: 2, venta: 300, abonos: 0 });
  });
});
