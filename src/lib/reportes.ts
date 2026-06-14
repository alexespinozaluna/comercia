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
  /** Ingresos en efectivo: ventas pagadas (no crédito) + captura de saldo a favor. */
  efectivo: number;
  /** Total de abonos (tipo 2). */
  abono: number;
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
  const totales: TotalesIngresos = { balance: 0, ventas: 0, efectivo: 0, abono: 0 };
  let gastos = 0;

  for (const d of docs) {
    const esVenta = d.IdTipoDocumento === TipoDoc.VENTA;
    const esAbono = d.IdTipoDocumento === TipoDoc.ABONO;

    // Totales (estilo home): efectivo = ventas/saldo-favor no crédito;
    // abono = tipo 2; gastos = egresos; ventas = tipo 1.
    if (esEgreso(d.IdTipoDocumento)) {
      gastos += d.Total;
    } else if (esVenta) {
      totales.ventas += d.Total;
      if (!d.bCredito) totales.efectivo += d.Total;
    } else if (d.IdTipoDocumento === TipoDoc.SALDO_FAVOR && !d.bCredito) {
      totales.efectivo += d.Total;
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

  totales.balance = totales.efectivo + totales.abono - gastos;

  // Orden: por total (venta + abonos) desc, "NINGUNO" siempre al final.
  const grupos = Array.from(map.values()).sort((a, b) => {
    if (a.metodo === SIN_METODO) return 1;
    if (b.metodo === SIN_METODO) return -1;
    return b.venta + b.abonos - (a.venta + a.abonos);
  });

  return { grupos, totales };
}
