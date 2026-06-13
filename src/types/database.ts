// TypeScript types matching the Supabase database schema
// Column names are PascalCase to match the C# entities / Supabase table columns

import { labelFormaVenta } from "@/lib/terminologia";

export interface CreatableEnty {
  id: number;
  FechaCreacion: string;
  // Opcionales: los pone el backend (lib/audit.ts) y vienen de la DB; el
  // frontend no necesita construirlos al armar payloads de creación.
  IdUsuarioCreacion?: number | null;
}

export interface BaseEnty extends CreatableEnty {
  FechaModificacion?: string | null;
  IdUsuarioModificacion?: number | null;
}

export interface Producto extends BaseEnty {
  Nombre: string;
  PrecioCosto: number | null;
  PrecioVenta: number;
  Cantidad: number | null;
  FechaVencimiento: string | null;
  IdCategoria: number;
  bActivoVenta: boolean;
}

export interface Categoria {
  id: number;
  IdTenant: number;
  Nombre: string;
  Estado: number;
  FechaCreacion: string;
}

/** id de la categoría sentinel "Sin categoría". */
export const SIN_CATEGORIA_ID = 0;

export interface ClienteDireccion {
  id: number;
  Direccion: string;
  Telefono: string | null;
  Contacto: string;
  IdCliente: number;
  bPrincipal: boolean;
}

export interface Cliente extends BaseEnty {
  Nombre: string;
  NroTelefono: string | null;
  TipoDocumento: string | null;
  NroDocumento: string | null;
  Comentario: string | null;
  ClienteDireccion?: ClienteDireccion[];
}

export interface MetodoPago extends BaseEnty {
  Nombre: string;
  Simbolo: string;
  bEfectivo: boolean;
}

export interface TipoDocumento extends BaseEnty {
  Nombre: string;
  Codigo: string;
  bIngreso: boolean;
  bEgreso: boolean;
  bAfectaCaja: boolean;
  bAfectaKardex: boolean;
  bGeneraDeuda: boolean;
  bEsAbono: boolean;
  Signo: number;
}

export interface DocumentoItem {
  id: number;
  IdProducto: number;
  Descripcion: string;
  Cantidad: number;
  PrecioVenta: number;
  MontoAbono: number;
  Total: number;
  IdDocumento: number;
  IdDocumentoRef: number | null;
}

export interface Documento extends BaseEnty {
  Estado: number;
  IdTenant: number;
  FechaEmision: string;
  Descripcion: string | null;
  Concepto: string | null;
  Total: number;
  bCredito: boolean;
  IdCliente: number | null;
  IdClienteDireccion: number | null;
  DireccionEntrega: string | null;
  DocumentoItem?: DocumentoItem[];
  Cliente?: Cliente;
  TotalAbono: number;
  IdTipoDocumento: number;
  Saldo: number;
  IdMetodoPago: number | null;
  IdCaja: number | null;
  // Lo asigna el backend; opcional al construir payloads en el frontend.
  IdNegocio?: number | null;
  // Embeds PostgREST opcionales (los pobla el select del service).
  MetodoPago?: { Nombre: string } | null;
  UsuarioCreacion?: { Nombre: string } | null;
  UsuarioModificacion?: { Nombre: string } | null;
}

// Fila de saldo a favor (Documento tipo 4) para la lista / badges.
export interface SaldoFavorRow {
  id: number;
  IdCliente: number | null;
  Total: number;
  Saldo: number;
  FechaEmision: string;
  IdCaja: number | null;
  Cliente?: { Nombre: string } | null;
}

// Computed properties (not in DB, derived on client)
export interface DocumentoDisplay extends Documento {
  FormaVenta: string; // labelFormaVenta en mayúsculas ("DEUDA" | "PAGADO")
  NroVenta: string; // zero-padded id
}

// Helper to add display properties
export function toDisplayDocumento(doc: Documento): DocumentoDisplay {
  return {
    ...doc,
    FormaVenta: labelFormaVenta(doc.bCredito).toUpperCase(),
    NroVenta: doc.id.toString().padStart(5, "0"),
  };
}

// Resumen for debt grouping (client-side computed)
export interface ResumenAbono {
  IdCliente: number | null;
  NomCliente: string;
  Cantidad: number;
  SumTotal: number;
  FechaUltima: string;
}

// Fila de la vista v_deuda_detalle (documento con deuda activa + join cliente + creador)
export interface DeudaDetalle {
  id: number;
  IdTenant: number;
  Estado: number;
  IdCliente: number | null;
  Concepto: string | null;
  Descripcion: string | null;
  FechaEmision: string;
  FechaCreacion: string;
  // Derivado en la vista: FechaCreacion si es el mismo día que FechaEmision, si no FechaEmision.
  FechaHora: string;
  DireccionEntrega: string | null;
  Total: number;
  Saldo: number;
  TotalAbono: number;
  bCredito: boolean;
  IdTipoDocumento: number;
  IdUsuarioCreacion: number | null;
  NomCliente: string | null;
  NroTelefono: string | null;
  NomUsuarioCreacion: string | null;
}

// Resultado de fn_deuda_resumen(p_id_tenant) — agrupado por cliente
export interface DeudaResumen {
  IdCliente: number;
  NomCliente: string | null;
  NroTelefono: string | null;
  Cantidad: number;
  SumSaldo: number;
  // PostgREST devuelve la fecha como string ("YYYY-MM-DD" o ISO). Se parsea con
  // parseDateOnly (local) para evitar el corrimiento de día por UTC.
  MaxFechaEmision: string;
}

export interface Negocio extends BaseEnty {
  IdTenant: number;
  Nombre: string | null;
  Telefono: string | null;
  Direccion: string | null;
  Logo: string | null;
  // Formato regional de fechas/números (es-CL, es-PE, …). Ver src/types/locale.ts.
  Locale: string;
  // Decimales de los montos: 0 (enteros, CLP) o 2 (centavos, PEN).
  Decimales: number;
  // Símbolo de moneda; vacío = derivar del Locale (moneda nacional).
  SimboloMoneda: string;
  Estado: number;
}

export interface DocumentoAudit {
  id: number;
  IdDocumento: number;
  Operacion: string;
  FechaAudit: string;
  UsuarioAudit: string | null;
  DataOld: Record<string, unknown> | null;
  DataNew: Record<string, unknown> | null;
  // null solo en filas históricas sin backfill o DELETE en cascada
  IdTenant: number | null;
}

// Link público para compartir un recurso (deuda, venta, etc.) sin login.
export interface LinkPublico {
  id: number;
  Token: string;
  IdTenant: number;
  TipoRecurso: string; // 'deuda_cliente' | 'venta' | 'cotizacion'
  IdRecurso: number; // IdCliente, IdDocumento, etc.
  Metadata: Record<string, unknown> | null;
  FechaCreacion: string;
  FechaExpiracion: string | null;
  Estado: number; // 1=activo, 0=revocado
  FechaUltimoAcceso: string | null;
}

export interface DocumentoItemAudit {
  id: number;
  IdDocumentoItem: number;
  Operacion: string;
  FechaAudit: string;
  UsuarioAudit: string | null;
  DataOld: Record<string, unknown> | null;
  DataNew: Record<string, unknown> | null;
  // null solo en filas históricas sin backfill o DELETE en cascada
  IdTenant: number | null;
}

export interface SistemaTenant {
  id: number;
  Codigo: string;
  Nombre: string;
  Estado: number;
  FechaCreacion: string;
}

export interface SistemaUsuario {
  id: number;
  IdTenant: number;
  IdNegocio: number | null;
  Codigo: string;
  Nombre: string;
  PasswordHash: string;
  Rol: string;
  Estado: number;
  FechaCreacion: string;
}

/** Sesión respaldada en BD: refresh token opaco hasheado + cadena de rotación. */
export interface SistemaSesion {
  id: number;
  IdUsuario: number;
  IdTenant: number;
  TokenHash: string; // sha256 del refresh token opaco
  Familia: string; // uuid: cadena de rotación
  ExpiraEn: string;
  RevocadoEn: string | null; // null = activa
  UserAgent: string | null;
  Ip: string | null;
  FechaCreacion: string;
  UltimoUso: string | null;
}

export interface Caja {
  id: number;
  IdTenant: number;
  IdUsuarioApertura: number;
  FechaApertura: string;
  FechaCierre: string | null;
  MontoInicial: number;
  MontoFinal: number | null;
  MontoEsperado: number | null;
  Diferencia: number | null;
  Observacion: string | null;
  Estado: number;
  IdUsuarioCierre: number | null;
}

/** Desglose del arqueo de caja devuelto por fn_caja_arqueo. */
export interface CajaArqueo {
  IdCaja: number;
  MontoInicial: number;
  VentasEfectivo: number;
  AbonosEfectivo: number;
  GastosEfectivo: number;
  MontoEsperado: number;
  CntVentas: number;
  CntAbonos: number;
  CntGastos: number;
}

/** Fila del historial de caja con nombres de cajero ya resueltos. */
export interface CajaHistorialItem extends Caja {
  NomUsuarioApertura: string | null;
  NomUsuarioCierre: string | null;
}

export interface ProductoMovimiento {
  id: number;
  IdTenant: number;
  IdProducto: number;
  TipoMovimiento: number;
  Cantidad: number;
  StockAnterior: number;
  StockNuevo: number;
  IdDocumento: number | null;
  IdUsuarioCreacion: number | null;
  Observacion: string | null;
  Fecha: string;
}

// Movimiento de ajuste con el nombre del producto resuelto (kardexService.getAjustes).
export interface ProductoMovimientoAjuste extends ProductoMovimiento {
  ProductoNombre: string | null;
}

// TipoMovimiento — reference table (Supabase: "TipoMovimiento")
// Operacion: Ingreso (adds stock), Salida (removes stock), Ajuste (calculated difference)
// Efecto:   Suma (add), Resta (subtract), Suma o Resta (depends on sign)
export const TIPO_MOVIMIENTO = {
  VENTA: 1,
  COMPRA: 2,
  FABRICACION: 3,
  MERMA_DANO: 4,
  VENCIMIENTO: 5,
  INVENTARIO_FISICO: 6,
  ANULACION_VENTA: 7, // devolución a stock al borrar/anular una venta (INGRESO)
} as const;

export type TipoMovimientoKey = keyof typeof TIPO_MOVIMIENTO;
export type TipoMovimientoValue = (typeof TIPO_MOVIMIENTO)[TipoMovimientoKey];

export type OperacionTipo = "INGRESO" | "SALIDA" | "AJUSTE";
export type EfectoTipo = "Suma" | "Resta" | "Suma o Resta";

export interface TipoMovimiento {
  Id: number;
  Descripcion: string;
  Operacion: OperacionTipo;
  Efecto: EfectoTipo;
}

// History state for filter persistence (matches original sessionStorage pattern)
export interface HistoryState {
  Tipo: string;
  FechaInicio: string;
  FechaFin: string;
  Index: number;
}
