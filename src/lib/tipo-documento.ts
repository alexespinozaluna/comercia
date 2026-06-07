// Catálogo de tipos de Documento.
// Los IDs son FIJOS y espejan la tabla `TipoDocumento` (ver
// supabase/migrations/20260607000000_tipo_documento_catalogo.sql) y los valores
// cableados en RPCs/vistas/triggers. NO renumerar.

export const TipoDoc = {
  /** 1 — Venta (bCredito=true + Saldo>0 ⇒ deuda) */
  VENTA: 1,
  /** 2 — Abono (pago a una deuda; baja el Saldo de la venta referenciada) */
  ABONO: 2,
  /** 3 — Gasto (egreso) */
  GASTO: 3,
  /** 4 — Saldo a favor (captura de anticipo/crédito del cliente) */
  SALDO_FAVOR: 4,
  /** 5 — Ajuste/Baja (kardex; no toca caja) */
  AJUSTE: 5,
  /** 6 — Abono con saldo a favor (consume crédito; sin efectivo, no es ingreso) */
  ABONO_FAVOR: 6,
} as const;

export type TipoDocId = (typeof TipoDoc)[keyof typeof TipoDoc];

/** Nombre legible por id (fallback de display si no se trae de la BD). */
export const NOMBRE_TIPO_DOC: Record<number, string> = {
  [TipoDoc.VENTA]: "Venta",
  [TipoDoc.ABONO]: "Abono",
  [TipoDoc.GASTO]: "Gasto",
  [TipoDoc.SALDO_FAVOR]: "Saldo a favor",
  [TipoDoc.AJUSTE]: "Ajuste/Baja",
  [TipoDoc.ABONO_FAVOR]: "Abono con saldo a favor",
};

// ---------------------------------------------------------------------
// Flags de comportamiento (Fase 3)
// Espejo de la semilla de la tabla `TipoDocumento` en BD.
// ⚠️ Mantener en sync con
//    supabase/migrations/20260607000000_tipo_documento_catalogo.sql
// ---------------------------------------------------------------------
export interface TipoDocFlags {
  /** Cuenta como ingreso del balance. */
  ingreso: boolean;
  /** Cuenta como egreso (gasto). */
  egreso: boolean;
  /** Mueve efectivo en caja (la venta, solo si es de contado). */
  afectaCaja: boolean;
  /** Mueve stock (kardex). */
  afectaKardex: boolean;
  /** Puede dejar Saldo pendiente (deuda). */
  generaDeuda: boolean;
  /** Pago que reduce el Saldo de otra venta (abono o abono con saldo a favor). */
  esAbono: boolean;
  /** +1 ingreso / −1 egreso / 0 neutro. */
  signo: number;
}

const FLAGS: Record<TipoDocId, TipoDocFlags> = {
  [TipoDoc.VENTA]:       { ingreso: true,  egreso: false, afectaCaja: true,  afectaKardex: true,  generaDeuda: true,  esAbono: false, signo: 1 },
  [TipoDoc.ABONO]:       { ingreso: true,  egreso: false, afectaCaja: true,  afectaKardex: false, generaDeuda: false, esAbono: true,  signo: 1 },
  [TipoDoc.GASTO]:       { ingreso: false, egreso: true,  afectaCaja: true,  afectaKardex: false, generaDeuda: false, esAbono: false, signo: -1 },
  [TipoDoc.SALDO_FAVOR]: { ingreso: true,  egreso: false, afectaCaja: true,  afectaKardex: false, generaDeuda: false, esAbono: false, signo: 1 },
  [TipoDoc.AJUSTE]:      { ingreso: false, egreso: false, afectaCaja: false, afectaKardex: true,  generaDeuda: false, esAbono: false, signo: 0 },
  [TipoDoc.ABONO_FAVOR]: { ingreso: false, egreso: false, afectaCaja: false, afectaKardex: false, generaDeuda: false, esAbono: true,  signo: 0 },
};

/** Flags de un tipo de documento (undefined si el id no está en el catálogo). */
export function flagsTipoDoc(id: number): TipoDocFlags | undefined {
  return FLAGS[id as TipoDocId];
}

export const esIngreso = (id: number): boolean => flagsTipoDoc(id)?.ingreso ?? false;
export const esEgreso = (id: number): boolean => flagsTipoDoc(id)?.egreso ?? false;
export const esAbono = (id: number): boolean => flagsTipoDoc(id)?.esAbono ?? false;
export const afectaCaja = (id: number): boolean => flagsTipoDoc(id)?.afectaCaja ?? false;
export const afectaKardex = (id: number): boolean => flagsTipoDoc(id)?.afectaKardex ?? false;
export const generaDeuda = (id: number): boolean => flagsTipoDoc(id)?.generaDeuda ?? false;
export const signoTipoDoc = (id: number): number => flagsTipoDoc(id)?.signo ?? 0;
