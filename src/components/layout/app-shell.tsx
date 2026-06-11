"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu, LogOut, ChevronDown, Landmark, Settings, ClipboardList, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { NavMenu } from "./nav-menu";
import { MobileNav } from "./mobile-nav";
import { NegocioSelector } from "./negocio-selector";
import { ThemeToggle } from "./theme-toggle";
import { getCurrentUser, logout, type AuthUser } from "@/lib/auth-client";
import { useAppStore } from "@/stores/app-store";
import { extraerIniciales, numToString } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Caja } from "@/types/database";

/* ── Hook compartido: estado de caja ───────────────────────── */
// Lo levantamos al AppShell para que el header (badge + user menu) lean
// el mismo state y solo se haga un fetch a /api/caja.
function useCajaAbierta(authUserId: number | null) {
  const [caja, setCaja] = useState<Caja | null | undefined>(undefined);

  useEffect(() => {
    if (authUserId == null) {
      setCaja(null);
      return;
    }
    setCaja(undefined);
    fetch("/api/caja")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCaja(d ?? null))
      .catch(() => setCaja(null));
  }, [authUserId]);

  return caja;
}


/* ── User dropdown menu ────────────────────────────────────── */
function UserMenu({
  authUser,
  caja,
  onLogout,
}: {
  authUser: AuthUser;
  caja: Caja | null | undefined;
  onLogout: () => void;
}) {
  const router = useRouter();
  const isAdmin = authUser.rol === "ADMIN";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent transition-colors cursor-pointer outline-none">
        <div className="h-7 w-7 rounded-full bg-brand flex items-center justify-center shrink-0">
          <span className="text-white text-[11px] font-semibold">
            {extraerIniciales(authUser.nombre)}
          </span>
        </div>
        <span className="text-[13px] font-semibold hidden sm:block text-foreground">
          {authUser.nombre}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        {/* Header: nombre + rol (informativo, no clickeable) */}
        <div className="px-2 py-2">
          <p className="text-sm font-semibold truncate text-foreground">{authUser.nombre}</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-0.5">
            {authUser.rol}
          </p>
        </div>

        <DropdownMenuSeparator />

        {/* Info de caja (informativo) */}
        {caja === undefined ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Cargando caja…</div>
        ) : caja ? (
          <div className="px-2 py-1.5 text-xs flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
            <span className="text-success font-medium">Caja abierta</span>
            <span className="text-success font-bold ml-auto">
              {numToString(caja.MontoInicial)}
            </span>
          </div>
        ) : (
          <div className="px-2 py-1.5 text-xs flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
            <span className="text-destructive font-medium">Sin caja abierta</span>
          </div>
        )}

        <DropdownMenuSeparator />

        {/* Acciones */}
        <DropdownMenuItem onClick={() => router.push("/caja")}>
          <Landmark className="h-4 w-4" />
          Ir a Caja
        </DropdownMenuItem>

        {isAdmin && (
          <DropdownMenuItem onClick={() => router.push("/configuracion")}>
            <Settings className="h-4 w-4" />
            Configuración
          </DropdownMenuItem>
        )}

        {isAdmin && (
          <DropdownMenuItem onClick={() => router.push("/configuracion/usuarios")}>
            <Users className="h-4 w-4" />
            Usuarios
          </DropdownMenuItem>
        )}

        {isAdmin && (
          <DropdownMenuItem onClick={() => router.push("/auditoria")}>
            <ClipboardList className="h-4 w-4" />
            Auditoría
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem variant="destructive" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Sidebar brand header ──────────────────────────────────── */
function SidebarBrand() {
  return (
    <div className="flex h-[52px] items-center border-b border-border px-4 shrink-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-[22px] font-extrabold leading-none text-brand">Comercia</span>
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground leading-none">
          Sistema POS
        </span>
      </div>
    </div>
  );
}

/* ── Sidebar user footer ───────────────────────────────────── */
function SidebarUserFooter({ onLogout }: { onLogout: () => void }) {
  const authUser = useAppStore((s) => s.authUser);
  const router = useRouter();

  if (!authUser) return null;

  return (
    <div className="border-t border-border p-3">
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors",
          authUser.rol === "ADMIN" && "cursor-pointer hover:bg-page-bg"
        )}
        onClick={() => authUser.rol === "ADMIN" && router.push("/configuracion")}
      >
        <div className="h-9 w-9 rounded-full bg-brand flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-semibold">
            {extraerIniciales(authUser.nombre)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold truncate leading-tight">{authUser.nombre}</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider leading-tight mt-0.5">
            {authUser.rol}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onLogout();
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ── Page title helper ─────────────────────────────────────── */
function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Ventas";
  if (pathname.startsWith("/venta/nueva")) return "Nueva Venta";
  if (pathname.startsWith("/venta-form")) return "Editar Venta";
  if (pathname.startsWith("/venta-detalle")) return "Detalle";
  if (pathname.startsWith("/venta-abono")) return "Abono";
  if (pathname.startsWith("/venta-gasto")) return "Gasto";
  if (pathname.startsWith("/venta")) return "Ventas";
  if (pathname.startsWith("/deuda")) return "Deudas";
  if (pathname.startsWith("/saldo-favor")) return "Saldo a favor";
  if (pathname.startsWith("/cliente/datos")) return "Cliente";
  if (pathname.startsWith("/cliente")) return "Clientes";
  if (pathname.startsWith("/producto/datos")) return "Producto";
  if (pathname.startsWith("/producto/ajustes")) return "Ajustes";
  if (pathname.startsWith("/producto/kardex")) return "Kardex";
  if (pathname.startsWith("/producto")) return "Inventario";
  if (pathname.startsWith("/bluetoothprinter")) return "Impresora";
  if (pathname.startsWith("/configuracion")) return "Configuración";
  if (pathname.startsWith("/auditoria")) return "Auditoría";
  if (pathname.startsWith("/caja")) return "Caja";
  return pathname.slice(1).charAt(0).toUpperCase() + pathname.slice(2);
}

/* ── AppShell ──────────────────────────────────────────────── */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { authUser, setAuthUser } = useAppStore();
  const locale = useAppStore((s) => s.locale);
  const caja = useCajaAbierta(authUser?.id ?? null);

  useEffect(() => {
    // If store has no user yet, fetch it (covers initial mount and post-login navigation
    // when login page didn't set the user directly).
    if (!authUser) {
      getCurrentUser().then((u) => setAuthUser(u));
    }
  }, [pathname, authUser, setAuthUser]);

  const handleLogout = async () => {
    await logout();
    setAuthUser(null);
    toast.success("Sesión cerrada");
    router.push("/login");
    router.refresh();
  };

  // Login y páginas públicas (/p/*) son standalone — sin sidebar/header/nav.
  if (pathname === "/login" || pathname.startsWith("/p/")) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-[220px] md:flex-col border-r border-border bg-white dark:bg-card shrink-0">
        <SidebarBrand />
        <div className="flex-1 overflow-auto py-2">
          <NavMenu user={authUser} />
        </div>
        <SidebarUserFooter onLogout={handleLogout} />
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex h-[52px] items-center border-b border-border px-4 gap-3 bg-white dark:bg-card sticky top-0 z-30 shrink-0">
          {/* Mobile drawer */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger
              className="md:hidden inline-flex items-center justify-center rounded-md h-9 w-9 hover:bg-accent transition-colors"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[220px] p-0 flex flex-col"
              showCloseButton={false}
            >
              <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
              <SidebarBrand />
              <div className="flex-1 overflow-auto py-2">
                <NavMenu user={authUser} onNavigate={() => setSheetOpen(false)} />
              </div>
              <SidebarUserFooter onLogout={handleLogout} />
            </SheetContent>
          </Sheet>

          {/* Page title */}
          <h1 className="text-[15px] font-bold tracking-tight truncate text-foreground">
            {getPageTitle(pathname)}
          </h1>

          <div className="flex-1" />

          {/* Selector de sucursal */}
          <NegocioSelector />

          {/* Modo claro / oscuro */}
          <ThemeToggle />

          {/* User dropdown */}
          {authUser && <UserMenu authUser={authUser} caja={caja} onLogout={handleLogout} />}
        </header>

        {/* Content — keyed por locale: si el negocio activo trae otro formato
            (es-PE vs es-CL), remonta la página para re-formatear montos/fechas. */}
        <main className="flex-1 overflow-auto p-4 pb-20 md:pb-4 bg-page-bg">
          <div key={locale} className="contents">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav user={authUser} />
    </div>
  );
}
