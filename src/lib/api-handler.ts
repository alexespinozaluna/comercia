import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest, type APIUser } from "@/lib/api-auth";
import { esSoloLectura } from "@/lib/permisos";

/**
 * Error con código HTTP explícito. Lánzalo desde un handler (o servicio) cuando
 * quieras devolver un status y mensaje concretos al cliente:
 *   throw new ApiError(409, "Ya existe una caja abierta");
 * `withAuth` lo traduce a `{ error: message }` con ese status.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface AuthOptions {
  /** Roles permitidos. Si se omite, basta con estar autenticado. */
  roles?: readonly string[];
  /**
   * Si es `true`, un `Error` no controlado se devuelve como 400 con su mensaje
   * (validación por excepción: preserva el comportamiento de las rutas que
   * exponían el mensaje del servicio/RPC). Por defecto, los `Error` genéricos
   * se ocultan como 500 "Error interno" para no filtrar detalles internos.
   * `ApiError` siempre respeta su propio status/mensaje, independientemente de esto.
   */
  exposeErrors?: boolean;
  /**
   * Permite la mutación (POST/PUT/DELETE) a roles de **solo lectura**
   * (`ROLES_SOLO_LECTURA`, p. ej. SUPERVISOR). Úsalo solo en acciones de
   * autoservicio que NO son datos de negocio: gestionar las propias sesiones,
   * cambiar la sucursal activa, etc. Por defecto los roles de solo lectura son
   * rechazados en cualquier mutación.
   */
  allowReadOnly?: boolean;
}

const METODOS_MUTACION = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type RouteContext<P> = { params: Promise<P> };
type HandlerContext<P> = { user: APIUser; params: P };
type Handler<P> = (
  req: NextRequest,
  ctx: HandlerContext<P>,
) => Promise<NextResponse> | NextResponse;

/**
 * Envuelve un handler de ruta API con: autenticación (401), control de rol
 * (403), resolución de `params` dinámicos y manejo uniforme de errores. El
 * handler recibe el `user` ya validado y los `params` ya resueltos, y solo se
 * ocupa de la lógica de negocio.
 *
 *   export const GET = withAuth(async (req, { user }) => { ... });
 *   export const POST = withAuth(handler, { roles: PERMISOS.VENTAS_Y_CATALOGO });
 *   export const PUT = withAuth(async (req, { user, params }) => {
 *     const { id } = params; ...
 *   });
 */
export function withAuth<P = Record<string, never>>(
  handler: Handler<P>,
  options: AuthOptions = {},
) {
  return async (
    req: NextRequest,
    routeCtx: RouteContext<P>,
  ): Promise<NextResponse> => {
    try {
      const user = await getCurrentUserFromRequest(req);
      if (!user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
      }
      if (options.roles && !options.roles.includes(user.rol)) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      // Rol de solo lectura: bloquear mutaciones de negocio (salvo autoservicio).
      if (
        !options.allowReadOnly &&
        METODOS_MUTACION.has(req.method) &&
        esSoloLectura(user.rol)
      ) {
        return NextResponse.json(
          { error: "Tu rol es de solo lectura" },
          { status: 403 },
        );
      }
      // En rutas estáticas Next puede no pasar contexto; en dinámicas trae params.
      const params = (routeCtx ? await routeCtx.params : ({} as P)) as P;
      return await handler(req, { user, params });
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof Error && err.message === "Forbidden") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      console.error(`${req.method} ${req.nextUrl.pathname} error:`, err);
      if (options.exposeErrors && err instanceof Error) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
  };
}
