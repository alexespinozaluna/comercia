"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/stores/app-store";
import { useGuardar } from "@/hooks/use-guardar";
import { apiGet, apiPost } from "@/lib/api-client";
import type { Negocio } from "@/types/database";
import { simboloEfectivo } from "@/types/locale";
import type { AuthUser } from "@/lib/auth-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Selector de sucursal (negocio activo) en la barra superior. */
export function NegocioSelector() {
  const authUser = useAppStore((s) => s.authUser);
  const setAuthUser = useAppStore((s) => s.setAuthUser);
  const triggerRefresh = useAppStore((s) => s.triggerRefresh);
  const setFormato = useAppStore((s) => s.setFormato);
  const router = useRouter();

  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const { saving: switching, guardar } = useGuardar();
  const tenantId = authUser?.idTenant ?? null;
  const idNegocioActivo = authUser?.idNegocio ?? null;

  useEffect(() => {
    if (tenantId == null) return;
    apiGet<Negocio[]>("/api/negocio")
      .then(setNegocios)
      .catch(() => setNegocios([]));
  }, [tenantId]);

  // Aplica el formato regional (locale + decimales + símbolo) del negocio
  // activo al formateo global. Cubre también el cambio de sucursal:
  // setAuthUser actualiza idNegocio y re-dispara.
  useEffect(() => {
    if (!negocios.length) return;
    const activo = negocios.find((n) => n.id === idNegocioActivo) ?? negocios[0];
    if (activo?.Locale) {
      setFormato(
        activo.Locale,
        activo.Decimales ?? 0,
        simboloEfectivo(activo.SimboloMoneda, activo.Locale),
      );
    }
  }, [negocios, idNegocioActivo, setFormato]);

  if (!authUser) return null;

  const activo = negocios.find((n) => n.id === authUser.idNegocio) ?? negocios[0];
  if (!activo) return null; // aún no cargó la lista / sin sucursales

  // Solo ADMIN con más de una sucursal puede cambiar; el resto ve un badge fijo.
  const canSwitch = authUser.rol === "ADMIN" && negocios.length > 1;

  if (!canSwitch) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs max-w-[170px]"
        title={activo.Nombre ?? "Sucursal"}
        aria-label={`Sucursal: ${activo.Nombre ?? ""}`}
      >
        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{activo.Nombre ?? "Sucursal"}</span>
      </div>
    );
  }

  const cambiar = (n: Negocio) => guardar(async () => {
    if (n.id === authUser.idNegocio) return;
    try {
      const updated = await apiPost<AuthUser>("/api/sesion/negocio", { idNegocio: n.id });
      setAuthUser(updated);
      triggerRefresh();
      toast.success(`Sucursal: ${n.Nombre ?? `#${n.id}`}`);
      // Volver a la página principal y refrescar: los datos mostrados son por sucursal.
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar de sucursal");
    }
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs hover:bg-accent transition-colors cursor-pointer outline-none max-w-[170px] disabled:opacity-60"
        disabled={switching}
        aria-label="Cambiar de sucursal"
      >
        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium truncate">{activo.Nombre ?? "Sucursal"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-52">
        <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sucursal
        </div>
        {negocios.map((n) => (
          <DropdownMenuItem key={n.id} onClick={() => cambiar(n)} className="gap-2">
            <Check className={cn("h-4 w-4", n.id === activo.id ? "opacity-100" : "opacity-0")} />
            <span className="truncate">{n.Nombre ?? `Negocio #${n.id}`}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
