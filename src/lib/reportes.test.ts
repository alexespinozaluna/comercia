import { describe, it, expect } from "vitest";
import { agruparIngresosPorMetodo, agruparIngresosPorUsuario, SIN_METODO, SIN_USUARIO } from "./reportes";
import { TipoDoc } from "./tipo-documento";
import type { Documento } from "@/types/database";

// Factory mínima: solo los campos que leen las funciones de reporte.
function doc(
  tipo: number,
  total: number,
  opts: { metodo?: string; bCredito?: boolean; idUsuario?: number; usuario?: string } = {},
): Documento {
  return {
    IdTipoDocumento: tipo,
    Total: total,
    bCredito: opts.bCredito ?? false,
    MetodoPago: opts.metodo ? { Nombre: opts.metodo } : null,
    IdUsuarioCreacion: opts.idUsuario ?? null,
    UsuarioCreacion: opts.usuario ? { Nombre: opts.usuario } : null,
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

  it("captura de saldo a favor se EXCLUYE (no es venta ni ingreso del reporte)", () => {
    const { grupos, totales } = agruparIngresosPorMetodo([
      doc(TipoDoc.SALDO_FAVOR, 400),
    ]);
    expect(totales.efectivo).toBe(0);
    expect(totales.ventas).toBe(0);
    expect(totales.balance).toBe(0);
    expect(grupos).toHaveLength(0);
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

  it("expone gastos en los totales", () => {
    const { totales } = agruparIngresosPorMetodo([
      doc(TipoDoc.VENTA, 1000, { metodo: "Efectivo" }),
      doc(TipoDoc.GASTO, 300, { metodo: "Efectivo" }),
    ]);
    expect(totales.gastos).toBe(300);
  });
});

describe("agruparIngresosPorUsuario", () => {
  it("agrupa ventas/abonos/gastos por usuario y calcula el balance", () => {
    const { grupos, totales } = agruparIngresosPorUsuario([
      doc(TipoDoc.VENTA, 1000, { idUsuario: 1, usuario: "Ana" }),
      doc(TipoDoc.ABONO, 200, { idUsuario: 1, usuario: "Ana" }),
      doc(TipoDoc.GASTO, 300, { idUsuario: 1, usuario: "Ana" }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toMatchObject({
      idUsuario: 1,
      usuario: "Ana",
      countVentas: 1,
      ventas: 1000,
      efectivo: 1000,
      abonos: 200,
      gastos: 300,
      balance: 900, // 1000 + 200 - 300
    });
    expect(totales.balance).toBe(900);
    expect(totales.gastos).toBe(300);
  });

  it("venta a crédito suma a ventas pero no a efectivo del usuario", () => {
    const { grupos } = agruparIngresosPorUsuario([
      doc(TipoDoc.VENTA, 500, { idUsuario: 2, usuario: "Beto", bCredito: true }),
    ]);
    expect(grupos[0].ventas).toBe(500);
    expect(grupos[0].efectivo).toBe(0);
    expect(grupos[0].balance).toBe(0);
  });

  it("separa por usuario y ordena por balance desc", () => {
    const { grupos } = agruparIngresosPorUsuario([
      doc(TipoDoc.VENTA, 100, { idUsuario: 1, usuario: "Ana" }),
      doc(TipoDoc.VENTA, 900, { idUsuario: 2, usuario: "Beto" }),
    ]);
    expect(grupos.map((g) => g.usuario)).toEqual(["Beto", "Ana"]);
  });

  it("excluye el saldo a favor del efectivo/balance del usuario", () => {
    const { grupos } = agruparIngresosPorUsuario([
      doc(TipoDoc.VENTA, 100, { idUsuario: 1, usuario: "Ana" }),
      doc(TipoDoc.SALDO_FAVOR, 400, { idUsuario: 1, usuario: "Ana" }),
    ]);
    expect(grupos[0].efectivo).toBe(100);
    expect(grupos[0].balance).toBe(100);
  });

  it("documentos sin usuario van al grupo 'Sin usuario' y al final", () => {
    const { grupos } = agruparIngresosPorUsuario([
      doc(TipoDoc.VENTA, 100), // sin usuario
      doc(TipoDoc.VENTA, 50, { idUsuario: 3, usuario: "Caro" }),
    ]);
    expect(grupos[grupos.length - 1].usuario).toBe(SIN_USUARIO);
  });
});
