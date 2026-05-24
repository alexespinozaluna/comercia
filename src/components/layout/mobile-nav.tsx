"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CreditCard,
  Package,
  Users,
  Landmark,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthUser } from "@/lib/auth-client";
import { motion } from "framer-motion";

const ALL_MOBILE = [
  { href: "/", label: "Ventas", icon: LayoutDashboard, roles: ["ADMIN", "CAJERO", "VENDEDOR", "COBRANZA", "SUPERVISOR"] },
  { href: "/deuda", label: "Deudas", icon: CreditCard, roles: ["ADMIN", "CAJERO", "COBRANZA", "SUPERVISOR"] },
  { href: "/producto", label: "Stock", icon: Package, roles: ["ADMIN", "CAJERO", "VENDEDOR", "SUPERVISOR"] },
  { href: "/cliente", label: "Clientes", icon: Users, roles: ["ADMIN", "CAJERO", "VENDEDOR", "COBRANZA", "SUPERVISOR"] },
  { href: "/caja", label: "Caja", icon: Landmark, roles: ["ADMIN", "CAJERO", "SUPERVISOR"] },
  { href: "/configuracion", label: "Ajustes", icon: Settings, roles: ["ADMIN", "SUPERVISOR"] },
];

export function MobileNav({ user }: { user?: AuthUser | null }) {
  const pathname = usePathname();
  const userRole = user?.rol ?? "";

  const navItems = ALL_MOBILE.filter((item) => item.roles.includes(userRole)).slice(0, 5);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white dark:bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex justify-around items-stretch h-14">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 px-1 py-1 min-w-0"
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-tab-indicator"
                  className="absolute top-0 left-0 right-0 h-[2px] bg-brand"
                  style={{ borderRadius: "0 0 2px 2px" }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors duration-200",
                  isActive ? "text-brand" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium leading-none truncate max-w-full transition-colors duration-200",
                  isActive ? "text-brand" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
