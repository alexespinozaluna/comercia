import { ROLES_VALIDOS, type Rol } from "@/types/usuario";

/**
 * Grupos de permisos por **capacidad**, no por rol. Las rutas API piden uno de
 * estos grupos a `requireRole(...)` en lugar de hardcodear arrays de roles, de
 * modo que un cambio de política (agregar un rol, mover una capacidad) se hace
 * en un solo lugar y queda consistente en toda la app.
 *
 * SUPERADMIN no aparece aquí: es el operador del SaaS y se valida por separado
 * (ver ROL_SUPERADMIN). La gestión de usuarios exige ADMIN exacto y tampoco usa
 * estos grupos.
 */
export const PERMISOS = {
  /** Operaciones administrativas/sensibles: borrados, auditoría, configuración
   *  del negocio, ajustes de inventario, historial de caja. */
  ADMINISTRACION: ["ADMIN", "SUPERVISOR"],

  /** Venta y gestión de catálogo: crear/editar ventas, productos y categorías. */
  VENTAS_Y_CATALOGO: ["ADMIN", "CAJERO", "VENDEDOR", "SUPERVISOR"],

  /** Cobranza: abonos y saldo a favor. */
  COBRANZA: ["ADMIN", "CAJERO", "COBRANZA", "SUPERVISOR"],

  /** Caja y gastos: apertura/cierre de caja y registro de gastos. */
  CAJA_Y_GASTOS: ["ADMIN", "CAJERO", "SUPERVISOR"],

  /** Cualquier operador del tenant (los 5 roles válidos). Ej.: alta/edición de
   *  clientes, que todos los perfiles necesitan durante la operación. */
  CUALQUIER_OPERADOR: [...ROLES_VALIDOS],
} as const satisfies Record<string, readonly Rol[]>;
