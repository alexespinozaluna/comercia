import { Documento } from "@/types/database";
import { TipoDoc, esEgreso } from "@/lib/tipo-documento";

/** Grupo del reporte de ingresos por método de pago (o "NINGUNO"). */
export interface GrupoMetodo {
  metodo: string;
  /** Cantidad de ventas (tipo 1). */
  countVentas: number;
  /** Total de ventas (tipo 1): crédito + contado. */
  venta: number;
  /** Total de abonos (tipo 2). */
  abonos: number;
}

/** Totales generales del rango, estilo "lista Venta" de la home. */
export interface TotalesIngresos {
  /** Efectivo + abonos − gastos. */
  balance: number;
  /** Total de ventas (tipo 1): crédito + contado. */
  ventas: number;
  /** Ingresos en efectivo: ventas de contado (no crédito). Excluye saldo a favor. */
  efectivo: number;
  /** Total de abonos (tipo 2). */
  abono: number;
  /** Total de gastos (tipo 3). */
  gastos: number;
}

export interface ReporteIngresos {
  grupos: GrupoMetodo[];
  totales: TotalesIngresos;
}

export const SIN_METODO = "NINGUNO";

function nuevoGrupo(metodo: string): GrupoMetodo {
  return { metodo, countVentas: 0, venta: 0, abonos: 0 };
}

/**
 * Construye el reporte de ingresos de un rango en una sola pasada:
 * - `grupos`: ventas (tipo 1) y abonos (tipo 2) agrupados por método de pago
 *   (null → "NINGUNO"; las ventas a crédito llevan el método "Deuda").
 * - `totales`: balance/ventas/efectivo/abono, espejo del cálculo de la home.
 * Excluye ajustes (tipo 5) — ya filtrados por getVentas.
 */
export function agruparIngresosPorMetodo(docs: Documento[]): ReporteIngresos {
  const map = new Map<string, GrupoMetodo>();
  const totales: TotalesIngresos = { balance: 0, ventas: 0, efectivo: 0, abono: 0, gastos: 0 };
  let gastos = 0;

  for (const d of docs) {
    const esVenta = d.IdTipoDocumento === TipoDoc.VENTA;
    const esAbono = d.IdTipoDocumento === TipoDoc.ABONO;

    // Totales: efectivo = ventas de contado; abono = tipo 2; gastos = egresos;
    // ventas = tipo 1. El saldo a favor (tipo 4) NO es venta ni ingreso del
    // reporte → se excluye.
    if (esEgreso(d.IdTipoDocumento)) {
      gastos += d.Total;
    } else if (esVenta) {
      totales.ventas += d.Total;
      if (!d.bCredito) totales.efectivo += d.Total;
    } else if (esAbono) {
      totales.abono += d.Total;
    }

    // Grupos por método: solo ventas y abonos.
    if (esVenta || esAbono) {
      const metodo = d.MetodoPago?.Nombre?.trim() || SIN_METODO;
      const g = map.get(metodo) ?? nuevoGrupo(metodo);
      if (esVenta) {
        g.venta += d.Total;
        g.countVentas += 1;
      } else {
        g.abonos += d.Total;
      }
      map.set(metodo, g);
    }
  }

  totales.gastos = gastos;
  totales.balance = totales.efectivo + totales.abono - gastos;

  // Orden: por total (venta + abonos) desc, "NINGUNO" siempre al final.
  const grupos = Array.from(map.values()).sort((a, b) => {
    if (a.metodo === SIN_METODO) return 1;
    if (b.metodo === SIN_METODO) return -1;
    return b.venta + b.abonos - (a.venta + a.abonos);
  });

  return { grupos, totales };
}

/** Grupo del reporte de ventas por usuario (quien registró el documento). */
export interface GrupoUsuario {
  idUsuario: number | null;
  usuario: string;
  /** Cantidad de ventas (tipo 1). */
  countVentas: number;
  /** Total de ventas (tipo 1): crédito + contado. */
  ventas: number;
  /** Ingresos en efectivo: ventas de contado (no crédito). Excluye saldo a favor. */
  efectivo: number;
  /** Total de abonos (tipo 2). */
  abonos: number;
  /** Total de gastos (tipo 3). */
  gastos: number;
  /** efectivo + abonos − gastos. */
  balance: number;
}

export interface ReporteVentasUsuario {
  grupos: GrupoUsuario[];
  totales: TotalesIngresos;
}

export const SIN_USUARIO = "Sin usuario";

function nuevoGrupoUsuario(idUsuario: number | null, usuario: string): GrupoUsuario {
  return { idUsuario, usuario, countVentas: 0, ventas: 0, efectivo: 0, abonos: 0, gastos: 0, balance: 0 };
}

/**
 * Reporte de ventas por usuario en una sola pasada, misma clasificación que
 * `agruparIngresosPorMetodo` (por flags de tipo-documento, no por texto) pero
 * agrupando por `IdUsuarioCreacion` — quien registró el movimiento. Cada grupo
 * lleva ventas/efectivo/abonos/gastos/balance; `totales` es el global del rango.
 * Excluye ajustes (tipo 5) — ya filtrados por getVentas.
 */
export function agruparIngresosPorUsuario(docs: Documento[]): ReporteVentasUsuario {
  const map = new Map<number | string, GrupoUsuario>();
  const totales: TotalesIngresos = { balance: 0, ventas: 0, efectivo: 0, abono: 0, gastos: 0 };

  for (const d of docs) {
    const esVenta = d.IdTipoDocumento === TipoDoc.VENTA;
    const esAbonoDoc = d.IdTipoDocumento === TipoDoc.ABONO;

    const key = d.IdUsuarioCreacion ?? SIN_USUARIO;
    const nombre = d.UsuarioCreacion?.Nombre?.trim() || SIN_USUARIO;
    const g = map.get(key) ?? nuevoGrupoUsuario(d.IdUsuarioCreacion ?? null, nombre);

    if (esEgreso(d.IdTipoDocumento)) {
      g.gastos += d.Total;
      totales.gastos += d.Total;
    } else if (esVenta) {
      g.ventas += d.Total;
      g.countVentas += 1;
      totales.ventas += d.Total;
      if (!d.bCredito) {
        g.efectivo += d.Total;
        totales.efectivo += d.Total;
      }
    } else if (esAbonoDoc) {
      g.abonos += d.Total;
      totales.abono += d.Total;
    }

    map.set(key, g);
  }

  for (const g of map.values()) {
    g.balance = g.efectivo + g.abonos - g.gastos;
  }
  totales.balance = totales.efectivo + totales.abono - totales.gastos;

  // Orden: por balance desc; "Sin usuario" siempre al final.
  const grupos = Array.from(map.values()).sort((a, b) => {
    if (a.usuario === SIN_USUARIO) return 1;
    if (b.usuario === SIN_USUARIO) return -1;
    return b.balance - a.balance;
  });

  return { grupos, totales };
}
