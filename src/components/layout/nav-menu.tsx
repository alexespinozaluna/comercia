"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  Package,
  Users,
  Settings,
  ClipboardList,
  Landmark,
  Trash2,
  ArrowDownRight,
  PiggyBank,
  BarChart3,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthUser } from "@/lib/auth-client";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  group: "principal" | "gestion";
}

const ALL_NAV: NavItem[] = [
  { href: "/", label: "Ventas", icon: LayoutDashboard, roles: ["ADMIN", "CAJERO", "VENDEDOR", "COBRANZA", "SUPERVISOR"], group: "principal" },
  { href: "/deuda", label: "Deudas", icon: CreditCard, roles: ["ADMIN", "CAJERO", "COBRANZA", "SUPERVISOR"], group: "principal" },
  { href: "/saldo-favor", label: "Saldo a favor", icon: PiggyBank, roles: ["ADMIN", "CAJERO", "COBRANZA", "SUPERVISOR"], group: "principal" },
  { href: "/cliente", label: "Clientes", icon: Users, roles: ["ADMIN", "CAJERO", "VENDEDOR", "COBRANZA", "SUPERVISOR"], group: "gestion" },
  { href: "/producto", label: "Inventario", icon: Package, roles: ["ADMIN", "CAJERO", "VENDEDOR", "SUPERVISOR"], group: "gestion" },
  { href: "/producto/ajustes", label: "Ajustes", icon: ArrowDownRight, roles: ["ADMIN", "SUPERVISOR"], group: "gestion" },
  { href: "/caja", label: "Caja", icon: Landmark, roles: ["ADMIN", "CAJERO", "SUPERVISOR"], group: "gestion" },
  { href: "/reporte-ingresos", label: "Reporte ingresos", icon: BarChart3, roles: ["ADMIN", "CAJERO", "SUPERVISOR"], group: "gestion" },
  { href: "/venta-eliminadas", label: "Papelera", icon: Trash2, roles: ["ADMIN", "SUPERVISOR"], group: "gestion" },
  { href: "/auditoria", label: "Auditoría", icon: ClipboardList, roles: ["ADMIN", "SUPERVISOR"], group: "gestion" },
  { href: "/configuracion", label: "Configuración", icon: Settings, roles: ["ADMIN", "SUPERVISOR"], group: "gestion" },
  { href: "/superadmin", label: "Tenants", icon: Building2, roles: ["SUPERADMIN"], group: "gestion" },
];

function NavItemLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-[9px] text-[13.5px] transition-colors",
        isActive
          ? "bg-brand-surface text-brand-dark font-semibold"
          : "font-medium text-muted-foreground hover:bg-page-bg hover:text-foreground"
      )}
    >
      <item.icon
        className={cn(
          "h-[17px] w-[17px] shrink-0 transition-colors",
          isActive ? "text-brand-dark" : "text-muted-foreground"
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function NavMenu({
  onNavigate,
  user,
}: {
  onNavigate?: () => void;
  user?: AuthUser | null;
}) {
  const pathname = usePathname();
  const userRole = user?.rol ?? "";

  const principal = ALL_NAV.filter(
    (item) => item.group === "principal" && item.roles.includes(userRole)
  );
  const gestion = ALL_NAV.filter(
    (item) => item.group === "gestion" && item.roles.includes(userRole)
  );

  return (
    <nav className="flex flex-col gap-5 px-3">
      {principal.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-muted-foreground/60 px-3 pb-1 pt-2">
            Principal
          </div>
          {principal.map((item) => (
            <NavItemLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      )}

      {gestion.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-muted-foreground/60 px-3 pb-1 pt-2">
            Gestión
          </div>
          {gestion.map((item) => (
            <NavItemLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </nav>
  );
}
