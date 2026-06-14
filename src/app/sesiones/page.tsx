"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiDelete } from "@/lib/api-client";
import type { SesionActivaDTO } from "@/types/sesion";
import { useAppStore } from "@/stores/app-store";
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
import { Monitor, Smartphone, LogOut, MonitorSmartphone, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Etiqueta amigable de navegador/SO a partir del User-Agent. */
function dispositivoLabel(ua: string | null): { texto: string; movil: boolean } {
  if (!ua) return { texto: "Dispositivo desconocido", movil: false };
  const movil = /Mobile|Android|iPhone|iPad/i.test(ua);
  let nav = "Navegador";
  if (/Edg\//i.test(ua)) nav = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) nav = "Opera";
  else if (/Chrome\//i.test(ua)) nav = "Chrome";
  else if (/Firefox\//i.test(ua)) nav = "Firefox";
  else if (/Safari\//i.test(ua)) nav = "Safari";
  let os = "";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  return { texto: os ? `${nav} · ${os}` : nav, movil };
}

export default function SesionesPage() {
  const locale = useAppStore((s) => s.locale);
  const [sesiones, setSesiones] = useState<SesionActivaDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [toRevocar, setToRevocar] = useState<SesionActivaDTO | null>(null);
  const [confirmOtras, setConfirmOtras] = useState(false);
  const [working, setWorking] = useState(false);

  const fmt = useCallback(
    (iso: string | null) =>
      iso
        ? new Date(iso).toLocaleString(locale, {
            day: "2-digit",
            month: "short",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—",
    [locale],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<SesionActivaDTO[]>("/api/auth/sesiones");
      setSesiones(data);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar sesiones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmRevocar = async () => {
    if (!toRevocar) return;
    setWorking(true);
    try {
      await apiDelete(`/api/auth/sesiones?id=${toRevocar.id}`);
      toast.success("Sesión cerrada");
      setToRevocar(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setWorking(false);
    }
  };

  const confirmCerrarOtras = async () => {
    setWorking(true);
    try {
      await apiDelete("/api/auth/sesiones");
      toast.success("Se cerraron las demás sesiones");
      setConfirmOtras(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setWorking(false);
    }
  };

  const otras = sesiones.filter((s) => !s.esActual).length;

  return (
    <div className="space-y-2 max-w-lg">
      <PageHeader
        title="Sesiones activas"
        actions={
          otras > 0 ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setConfirmOtras(true)}
            >
              <LogOut className="h-4 w-4" />
              Cerrar las demás
            </Button>
          ) : undefined
        }
      />

      <p className="text-xs text-muted-foreground px-0.5">
        Dispositivos donde tu cuenta tiene la sesión abierta. Si no reconoces
        alguno, ciérralo.
      </p>

      {loading ? (
        <LoadingState variant="skeleton-list" count={3} />
      ) : sesiones.length === 0 ? (
        <EmptyState
          icon={MonitorSmartphone}
          title="Sin sesiones activas"
          description="No hay sesiones abiertas."
        />
      ) : (
        <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 divide-y divide-border overflow-hidden">
          {sesiones.map((s) => {
            const { texto, movil } = dispositivoLabel(s.UserAgent);
            const Icono = movil ? Smartphone : Monitor;
            return (
              <div key={s.id} className="flex items-center gap-3 p-3">
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                    s.esActual ? "bg-success/10" : "bg-muted",
                  )}
                >
                  <Icono
                    className={cn(
                      "h-5 w-5",
                      s.esActual ? "text-success" : "text-muted-foreground",
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold truncate">{texto}</span>
                    {s.esActual && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-success/10 text-success">
                        Este dispositivo
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        Última actividad: {fmt(s.UltimoUso ?? s.FechaCreacion)}
                      </span>
                    </div>
                    <div className="truncate">
                      Inició: {fmt(s.FechaCreacion)}
                      {s.Ip ? ` · IP ${s.Ip}` : ""}
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-30"
                  onClick={() => setToRevocar(s)}
                  disabled={s.esActual}
                  title={s.esActual ? "Usa 'Cerrar sesión' para esta" : "Cerrar"}
                >
                  Cerrar
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmar cierre de una sesión */}
      <AlertDialog
        open={!!toRevocar}
        onOpenChange={(o) => !o && setToRevocar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar sesión remota</AlertDialogTitle>
            <AlertDialogDescription>
              Ese dispositivo deberá volver a iniciar sesión. La acción es
              inmediata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRevocar} disabled={working}>
              {working ? "Cerrando..." : "Cerrar sesión"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar cierre de las demás */}
      <AlertDialog open={confirmOtras} onOpenChange={setConfirmOtras}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar las demás sesiones</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrarán todas las sesiones excepto la de este dispositivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCerrarOtras} disabled={working}>
              {working ? "Cerrando..." : "Cerrar las demás"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
