import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
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
  const { pathname } = req.nextUrl;

  // Public paths skip auth
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("token")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await verifyToken(token);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Token invalido" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: [
    // Excluye assets de Next, iconos, y los recursos PWA (service worker + manifest)
    // para que el middleware de auth no los redirija a /login.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.png$|.*\\.svg$).*)",
  ],
};
