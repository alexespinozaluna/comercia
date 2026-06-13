import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { ACCESS_COOKIE } from "@/lib/auth-cookies";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  // Renovación del access token contra la BD: pública para no recursar (entra
  // sin access token válido y valida el refresh por su cuenta).
  "/api/auth/refresh",
  // Links públicos (compartir sin login): páginas /p/* y sus APIs.
  // OJO: "/p/" con barra final para no abarcar /producto, /perdidas, etc.
  // Solo /api/link-publico/validar es pública; el POST /api/link-publico exige auth.
  "/p/",
  "/api/deudas/publica",
  "/api/link-publico/validar",
  // Harness de tests E2E — solo expuesto en desarrollo (la ruta hace 404 en prod).
  ...(process.env.NODE_ENV !== "production" ? ["/dev-harness"] : []),
];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Public paths skip auth
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith("/api/");

  // Access token ausente o inválido/expirado:
  // - API → 401 (el api-client refresca contra /api/auth/refresh y reintenta).
  // - Navegación de página (GET) → redirige al refresh, que valida el refresh
  //   token en BD y devuelve aquí (o manda a /login si la sesión murió).
  const rechazar = () => {
    if (isApi) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (req.method === "GET") {
      const url = new URL("/api/auth/refresh", req.url);
      url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
    return NextResponse.redirect(new URL("/login", req.url));
  };

  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return rechazar();

  try {
    await verifyToken(token);
    return NextResponse.next();
  } catch {
    return rechazar();
  }
}

export const config = {
  matcher: [
    // Excluye assets de Next, iconos, y los recursos PWA (service worker + manifest)
    // para que el middleware de auth no los redirija a /login.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.png$|.*\\.svg$).*)",
  ],
};
