import { Documento } from "@/types/database";
import { TipoDoc, esEgreso, NOMBRE_TIPO_DOC } from "@/lib/tipo-documento";

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

export const SIN_METODO = "NINGUNO";
export const SIN_USUARIO = "Sin usuario";

function totalesVacios(): TotalesIngresos {
  return { balance: 0, ventas: 0, efectivo: 0, abono: 0, gastos: 0 };
}

/**
 * Acumula un documento en los totales globales del reporte — mismo criterio en
 * todas las vistas: efectivo = ventas de contado; abono = tipo 2; gastos =
 * egresos; ventas = tipo 1. El saldo a favor (tipo 4) se EXCLUYE (no es venta
 * ni ingreso del reporte). Clasifica por flags de tipo-documento, no por texto.
 */
function acumularTotales(t: TotalesIngresos, d: Documento): void {
  if (esEgreso(d.IdTipoDocumento)) {
    t.gastos += d.Total;
  } else if (d.IdTipoDocumento === TipoDoc.VENTA) {
    t.ventas += d.Total;
    if (!d.bCredito) t.efectivo += d.Total;
  } else if (d.IdTipoDocumento === TipoDoc.ABONO) {
    t.abono += d.Total;
  }
}

function finalizarBalance(t: TotalesIngresos): void {
  t.balance = t.efectivo + t.abono - t.gastos;
}

// =====================================================================
// Agrupación TipoDocumento → método (base de "Por tipo" y del desglose
// anidado de "Por usuario")
// =====================================================================

/** Grupo de método dentro de un TipoDocumento (nivel hoja). */
export interface GrupoMetodoDeTipo {
  metodo: string;
  count: number;
  total: number;
}

/** Grupo por TipoDocumento con desglose por método. */
export interface GrupoTipoDoc {
  idTipo: number;
  tipo: string;
  count: number;
  total: number;
  metodos: GrupoMetodoDeTipo[];
}

export interface ReporteTipoDoc {
  grupos: GrupoTipoDoc[];
  totales: TotalesIngresos;
}

/**
 * Tipos que se listan (con movimiento de caja/anticipo). El array define el
 * orden de presentación. Ajuste (5) ya lo filtra getVentas; Abono con saldo a
 * favor (6) no es ingreso → fuera.
 */
const TIPOS_REPORTE: number[] = [
  TipoDoc.VENTA,
  TipoDoc.ABONO,
  TipoDoc.GASTO,
  TipoDoc.SALDO_FAVOR,
];

/**
 * Agrupa una lista de documentos por TipoDocumento y, dentro, por método de
 * pago. Nivel 1 en orden fijo (Venta, Abono, Gasto, Saldo a favor); nivel 2
 * (métodos) por total desc, "NINGUNO" al final. Las ventas a crédito caen bajo
 * su método "Deuda". Reutilizado por "Por tipo" (global) y por el desglose de
 * cada usuario en "Por usuario".
 */
function construirTipos(docs: Documento[]): GrupoTipoDoc[] {
  const tipoMap = new Map<number, { grupo: GrupoTipoDoc; metodos: Map<string, GrupoMetodoDeTipo> }>();

  for (const d of docs) {
    if (!TIPOS_REPORTE.includes(d.IdTipoDocumento)) continue;

    let entry = tipoMap.get(d.IdTipoDocumento);
    if (!entry) {
      entry = {
        grupo: {
          idTipo: d.IdTipoDocumento,
          tipo: NOMBRE_TIPO_DOC[d.IdTipoDocumento] ?? "—",
          count: 0,
          total: 0,
          metodos: [],
        },
        metodos: new Map(),
      };
      tipoMap.set(d.IdTipoDocumento, entry);
    }
    entry.grupo.count += 1;
    entry.grupo.total += d.Total;

    const metodo = d.MetodoPago?.Nombre?.trim() || SIN_METODO;
    const m = entry.metodos.get(metodo) ?? { metodo, count: 0, total: 0 };
    m.count += 1;
    m.total += d.Total;
    entry.metodos.set(metodo, m);
  }

  return Array.from(tipoMap.values())
    .map(({ grupo, metodos }) => ({
      ...grupo,
      metodos: Array.from(metodos.values()).sort((a, b) => {
        if (a.metodo === SIN_METODO) return 1;
        if (b.metodo === SIN_METODO) return -1;
        return b.total - a.total;
      }),
    }))
    .sort((a, b) => TIPOS_REPORTE.indexOf(a.idTipo) - TIPOS_REPORTE.indexOf(b.idTipo));
}

/**
 * Reporte "Por tipo": grupos = TipoDocumento → método; `totales` global del
 * rango (saldo a favor excluido de efectivo/balance).
 */
export function agruparPorTipoDocumento(docs: Documento[]): ReporteTipoDoc {
  const totales = totalesVacios();
  for (const d of docs) acumularTotales(totales, d);
  finalizarBalance(totales);
  return { grupos: construirTipos(docs), totales };
}

// =====================================================================
// Vista "Por usuario": usuario → tipo → método (doble desglose)
// =====================================================================

/**
 * Grupo por usuario (quien registró el documento). Colapsable: el header
 * muestra `count` (total de documentos) + `balance`; al expandir se ven los
 * `tipos` (cada uno expandible a su desglose por método).
 */
export interface GrupoUsuario {
  idUsuario: number | null;
  usuario: string;
  /** Total de documentos del usuario (de los tipos del reporte). */
  count: number;
  /** efectivo (ventas de contado) + abonos − gastos. Excluye saldo a favor. */
  balance: number;
  /** Desglose por TipoDocumento (cada tipo con sus métodos). */
  tipos: GrupoTipoDoc[];
}

export interface ReporteVentasUsuario {
  grupos: GrupoUsuario[];
  totales: TotalesIngresos;
}

/**
 * Reporte de ventas por usuario. Agrupa por `IdUsuarioCreacion`; cada usuario
 * lleva su `balance`, el `count` total de documentos y el desglose `tipos`
 * (tipo → método, vía `construirTipos`). `totales` es el global del rango.
 * Solo cuentan los tipos del reporte (Venta/Abono/Gasto/Saldo a favor); el
 * saldo a favor aparece en el desglose pero NO cuenta en el balance.
 */
export function agruparIngresosPorUsuario(docs: Documento[]): ReporteVentasUsuario {
  const totales = totalesVacios();
  const map = new Map<
    number | string,
    {
      idUsuario: number | null;
      usuario: string;
      count: number;
      efectivo: number;
      abonos: number;
      gastos: number;
      docs: Documento[];
    }
  >();

  for (const d of docs) {
    acumularTotales(totales, d);
    if (!TIPOS_REPORTE.includes(d.IdTipoDocumento)) continue;

    const key = d.IdUsuarioCreacion ?? SIN_USUARIO;
    let e = map.get(key);
    if (!e) {
      e = {
        idUsuario: d.IdUsuarioCreacion ?? null,
        usuario: d.UsuarioCreacion?.Nombre?.trim() || SIN_USUARIO,
        count: 0,
        efectivo: 0,
        abonos: 0,
        gastos: 0,
        docs: [],
      };
      map.set(key, e);
    }
    e.count += 1;
    e.docs.push(d);
    // Métricas del balance (saldo a favor NO cuenta).
    if (esEgreso(d.IdTipoDocumento)) e.gastos += d.Total;
    else if (d.IdTipoDocumento === TipoDoc.VENTA) {
      if (!d.bCredito) e.efectivo += d.Total;
    } else if (d.IdTipoDocumento === TipoDoc.ABONO) e.abonos += d.Total;
  }
  finalizarBalance(totales);

  const grupos: GrupoUsuario[] = Array.from(map.values())
    .map((e) => ({
      idUsuario: e.idUsuario,
      usuario: e.usuario,
      count: e.count,
      balance: e.efectivo + e.abonos - e.gastos,
      tipos: construirTipos(e.docs),
    }))
    // Orden: por balance desc; "Sin usuario" siempre al final.
    .sort((a, b) => {
      if (a.usuario === SIN_USUARIO) return 1;
      if (b.usuario === SIN_USUARIO) return -1;
      return b.balance - a.balance;
    });

  return { grupos, totales };
}
