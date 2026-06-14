import { ROLES_VALIDOS, type Rol } from "@/types/usuario";

/**
 * Grupos de permisos por **capacidad**, no por rol. Las rutas API pasan uno de
 * estos grupos a `withAuth(handler, { roles })` en lugar de hardcodear arrays de
 * roles, de modo que un cambio de política (agregar un rol, mover una capacidad)
 * se hace en un solo lugar y queda consistente en toda la app.
 *
 * SUPERADMIN no aparece aquí: es el operador del SaaS y se valida por separado
 * (ver ROL_SUPERADMIN). La gestión de usuarios exige ADMIN exacto y tampoco usa
 * estos grupos.
 *
 * SUPERVISOR es de **solo lectura**: figura en los grupos para *ver* todo, pero
 * `withAuth` le bloquea cualquier mutación (POST/PUT/DELETE) salvo autoservicio
 * (`allowReadOnly`). Ver ROLES_SOLO_LECTURA.
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

/**
 * Roles de **solo lectura**: ven todo lo que su grupo permite, pero no pueden
 * crear/editar/eliminar. `withAuth` los rechaza en POST/PUT/DELETE (salvo rutas
 * marcadas `allowReadOnly`, p. ej. autoservicio de sesiones / cambio de sucursal).
 */
export const ROLES_SOLO_LECTURA: readonly string[] = ["SUPERVISOR"];

/** ¿El rol es de solo lectura (no puede mutar datos de negocio)? */
export const esSoloLectura = (rol?: string | null): boolean =>
  !!rol && ROLES_SOLO_LECTURA.includes(rol);

/**
 * ¿El rol accede a las secciones de gestión/administración (ve lo mismo que el
 * ADMIN)? Incluye al SUPERVISOR (solo lectura). Para la UI: visibilidad, no
 * permiso de escritura.
 */
export const puedeGestionar = (rol?: string | null): boolean =>
  rol === "ADMIN" || rol === "SUPERVISOR";
