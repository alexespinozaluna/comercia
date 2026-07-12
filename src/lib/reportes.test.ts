import { describe, it, expect } from "vitest";
import { agruparPorTipoDocumento, agruparIngresosPorUsuario, SIN_METODO, SIN_USUARIO } from "./reportes";
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

describe("agruparPorTipoDocumento", () => {
  it("agrupa por tipo con count/total y desglosa por método (desc, NINGUNO al final)", () => {
    const { grupos } = agruparPorTipoDocumento([
      doc(TipoDoc.VENTA, 200, { metodo: "Efectivo" }),
      doc(TipoDoc.VENTA, 100, { metodo: "Efectivo" }),
      doc(TipoDoc.VENTA, 500, { metodo: "Transferencia" }),
      doc(TipoDoc.VENTA, 50), // sin método → NINGUNO
    ]);
    const venta = grupos.find((g) => g.idTipo === TipoDoc.VENTA)!;
    expect(venta.count).toBe(4);
    expect(venta.total).toBe(850);
    expect(venta.metodos.map((m) => m.metodo)).toEqual(["Transferencia", "Efectivo", SIN_METODO]);
    expect(venta.metodos[1]).toEqual({ metodo: "Efectivo", count: 2, total: 300 });
    expect(venta.metodos[2].metodo).toBe(SIN_METODO);
  });

  it("orden fijo de grupos: Venta, Abono, Gasto, Saldo a favor", () => {
    const { grupos } = agruparPorTipoDocumento([
      doc(TipoDoc.GASTO, 300, { metodo: "Efectivo" }),
      doc(TipoDoc.SALDO_FAVOR, 400, { metodo: "Efectivo" }),
      doc(TipoDoc.ABONO, 100, { metodo: "Efectivo" }),
      doc(TipoDoc.VENTA, 1000, { metodo: "Efectivo" }),
    ]);
    expect(grupos.map((g) => g.idTipo)).toEqual([
      TipoDoc.VENTA,
      TipoDoc.ABONO,
      TipoDoc.GASTO,
      TipoDoc.SALDO_FAVOR,
    ]);
  });

  it("crédito también es venta: aparece bajo su método Deuda", () => {
    const { grupos } = agruparPorTipoDocumento([
      doc(TipoDoc.VENTA, 500, { metodo: "Deuda", bCredito: true }),
      doc(TipoDoc.VENTA, 200, { metodo: "Efectivo" }),
    ]);
    const venta = grupos.find((g) => g.idTipo === TipoDoc.VENTA)!;
    expect(venta.total).toBe(700);
    expect(venta.metodos.find((m) => m.metodo === "Deuda")).toEqual({ metodo: "Deuda", count: 1, total: 500 });
  });

  it("Saldo a favor se muestra como grupo pero se EXCLUYE de efectivo/balance", () => {
    const { grupos, totales } = agruparPorTipoDocumento([
      doc(TipoDoc.SALDO_FAVOR, 400, { metodo: "Efectivo" }),
    ]);
    expect(grupos.find((g) => g.idTipo === TipoDoc.SALDO_FAVOR)?.total).toBe(400);
    expect(totales.efectivo).toBe(0);
    expect(totales.balance).toBe(0);
  });

  it("totales: efectivo (contado), abono, gastos y balance", () => {
    const { totales } = agruparPorTipoDocumento([
      doc(TipoDoc.VENTA, 1000, { metodo: "Efectivo" }),
      doc(TipoDoc.VENTA, 500, { metodo: "Deuda", bCredito: true }),
      doc(TipoDoc.ABONO, 200, { metodo: "Efectivo" }),
      doc(TipoDoc.GASTO, 300, { metodo: "Efectivo" }),
    ]);
    expect(totales.ventas).toBe(1500);
    expect(totales.efectivo).toBe(1000); // solo la venta de contado
    expect(totales.abono).toBe(200);
    expect(totales.gastos).toBe(300);
    expect(totales.balance).toBe(900); // 1000 + 200 - 300
  });

  it("ignora tipos fuera del reporte (p. ej. abono con saldo a favor, tipo 6)", () => {
    const { grupos } = agruparPorTipoDocumento([
      doc(6, 100, { metodo: "Efectivo" }),
    ]);
    expect(grupos).toHaveLength(0);
  });
});

describe("agruparIngresosPorUsuario", () => {
  it("agrupa por usuario: count total, balance y desglose por tipo con métodos anidados", () => {
    const { grupos, totales } = agruparIngresosPorUsuario([
      doc(TipoDoc.VENTA, 700, { idUsuario: 1, usuario: "Ana", metodo: "Efectivo" }),
      doc(TipoDoc.VENTA, 300, { idUsuario: 1, usuario: "Ana", metodo: "Transferencia" }),
      doc(TipoDoc.ABONO, 200, { idUsuario: 1, usuario: "Ana", metodo: "Efectivo" }),
      doc(TipoDoc.GASTO, 300, { idUsuario: 1, usuario: "Ana", metodo: "Efectivo" }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toMatchObject({ idUsuario: 1, usuario: "Ana", count: 4, balance: 900 });
    expect(grupos[0].tipos.map((t) => [t.idTipo, t.count, t.total])).toEqual([
      [TipoDoc.VENTA, 2, 1000],
      [TipoDoc.ABONO, 1, 200],
      [TipoDoc.GASTO, 1, 300],
    ]);
    // Nivel 3: desglose por método dentro del tipo Venta (por total desc).
    const venta = grupos[0].tipos.find((t) => t.idTipo === TipoDoc.VENTA)!;
    expect(venta.metodos).toEqual([
      { metodo: "Efectivo", count: 1, total: 700 },
      { metodo: "Transferencia", count: 1, total: 300 },
    ]);
    expect(totales.balance).toBe(900);
    expect(totales.gastos).toBe(300);
  });

  it("crédito no suma al balance, pero la fila Venta y su método Deuda sí incluyen el total", () => {
    const { grupos } = agruparIngresosPorUsuario([
      doc(TipoDoc.VENTA, 500, { idUsuario: 2, usuario: "Beto", bCredito: true, metodo: "Deuda" }),
    ]);
    expect(grupos[0].balance).toBe(0);
    const venta = grupos[0].tipos.find((t) => t.idTipo === TipoDoc.VENTA)!;
    expect(venta.total).toBe(500);
    expect(venta.metodos).toEqual([{ metodo: "Deuda", count: 1, total: 500 }]);
  });

  it("ordena por balance desc", () => {
    const { grupos } = agruparIngresosPorUsuario([
      doc(TipoDoc.VENTA, 100, { idUsuario: 1, usuario: "Ana" }),
      doc(TipoDoc.VENTA, 900, { idUsuario: 2, usuario: "Beto" }),
    ]);
    expect(grupos.map((g) => g.usuario)).toEqual(["Beto", "Ana"]);
  });

  it("saldo a favor: aparece en el desglose pero no en el balance; sí cuenta en count", () => {
    const { grupos } = agruparIngresosPorUsuario([
      doc(TipoDoc.VENTA, 100, { idUsuario: 1, usuario: "Ana" }),
      doc(TipoDoc.SALDO_FAVOR, 400, { idUsuario: 1, usuario: "Ana" }),
    ]);
    expect(grupos[0].balance).toBe(100);
    expect(grupos[0].count).toBe(2);
    expect(grupos[0].tipos.find((t) => t.idTipo === TipoDoc.SALDO_FAVOR)?.total).toBe(400);
  });

  it("documentos sin usuario van al grupo 'Sin usuario' y al final", () => {
    const { grupos } = agruparIngresosPorUsuario([
      doc(TipoDoc.VENTA, 100), // sin usuario
      doc(TipoDoc.VENTA, 50, { idUsuario: 3, usuario: "Caro" }),
    ]);
    expect(grupos[grupos.length - 1].usuario).toBe(SIN_USUARIO);
  });

  it("ignora tipos fuera del reporte (tipo 6) en el conteo por usuario", () => {
    const { grupos } = agruparIngresosPorUsuario([
      doc(6, 100, { idUsuario: 1, usuario: "Ana" }),
    ]);
    expect(grupos).toHaveLength(0);
  });
});
