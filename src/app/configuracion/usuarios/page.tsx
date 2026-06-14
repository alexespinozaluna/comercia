"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Negocio } from "@/types/database";
import { apiGet, apiDelete } from "@/lib/api-client";
import type { UsuarioSinPassword } from "@/types/usuario";
import { useAppStore } from "@/stores/app-store";
import { puedeGestionar, esSoloLectura } from "@/lib/permisos";
import { useResource } from "@/hooks/use-resource";
import { extraerIniciales } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Power, Users, Building2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function UsuariosPage() {
  const router = useRouter();
  const authUser = useAppStore((s) => s.authUser);
  const [toDesactivar, setToDesactivar] = useState<UsuarioSinPassword | null>(
    null,
  );
  const [working, setWorking] = useState(false);

  // Guard: ADMIN gestiona; SUPERVISOR solo ve.
  useEffect(() => {
    if (authUser && !puedeGestionar(authUser.rol)) {
      router.replace("/");
    }
  }, [authUser, router]);

  const { data, loading, reload } = useResource(async () => {
    if (!puedeGestionar(authUser?.rol)) {
      return { usuarios: [] as UsuarioSinPassword[], negocios: [] as Negocio[] };
    }
    const [u, n] = await Promise.all([
      apiGet<UsuarioSinPassword[]>("/api/usuarios"),
      apiGet<Negocio[]>("/api/negocio").catch(() => [] as Negocio[]),
    ]);
    return { usuarios: u, negocios: n };
  }, [authUser?.rol]);
  const usuarios = data?.usuarios ?? [];
  const negocios = data?.negocios ?? [];

  const nombreNegocio = (id: number | null) =>
    id == null ? "Todas las sucursales" : negocios.find((n) => n.id === id)?.Nombre ?? `#${id}`;

  const confirmDesactivar = async () => {
    if (!toDesactivar) return;
    setWorking(true);
    try {
      await apiDelete(`/api/usuarios/${toDesactivar.id}`);
      toast.success("Usuario desactivado");
      setToDesactivar(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setWorking(false);
    }
  };

  if (authUser && !puedeGestionar(authUser.rol)) {
    return (
      <EmptyState title="Acceso restringido" description="Solo administradores." />
    );
  }

  // SUPERVISOR ve la lista pero no crea/desactiva (solo lectura).
  const soloLectura = esSoloLectura(authUser?.rol);

  return (
    <div className="space-y-2">
      <PageHeader
        title="Usuarios"
        actions={
          soloLectura ? undefined : (
            <Button
              size="sm"
              className="bg-brand hover:bg-brand-dark text-white gap-1.5 shadow-sm"
              onClick={() => router.push("/configuracion/usuarios/nuevo")}
            >
              <Plus className="h-4 w-4" />
              Nuevo
            </Button>
          )
        }
      />

      {authUser == null || loading ? (
        <LoadingState variant="skeleton-list" count={4} />
      ) : usuarios.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin usuarios"
          description="Crea el primer usuario con el botón 'Nuevo'."
        />
      ) : (
        <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 divide-y divide-border overflow-hidden">
          {usuarios.map((u) => {
            const isSelf = authUser?.id === u.id;
            const inactivo = u.Estado === 0;
            return (
              <div
                key={u.id}
                className={cn(
                  "flex items-center gap-2 p-3",
                  inactivo && "opacity-60",
                )}
              >
                <div className="h-10 w-10 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-brand-dark">
                    {extraerIniciales(u.Nombre)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold truncate">
                      {u.Nombre}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {u.Rol}
                    </span>
                    {inactivo && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <span className="font-mono">{u.Codigo}</span>
                    <span>·</span>
                    <Building2 className="h-3 w-3" />
                    <span className="truncate">{nombreNegocio(u.IdNegocio)}</span>
                  </div>
                </div>

                {!soloLectura && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => router.push(`/configuracion/usuarios/${u.id}`)}
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive disabled:opacity-30"
                      onClick={() => setToDesactivar(u)}
                      disabled={isSelf || inactivo}
                      aria-label="Desactivar"
                      title={
                        isSelf
                          ? "No puedes desactivarte"
                          : inactivo
                          ? "Ya está inactivo"
                          : "Desactivar"
                      }
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={!!toDesactivar}
        onOpenChange={(o) => !o && setToDesactivar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              {toDesactivar?.Nombre} no podrá iniciar sesión. Puedes reactivarlo
              después editándolo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDesactivar} disabled={working}>
              {working ? "Desactivando..." : "Desactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
