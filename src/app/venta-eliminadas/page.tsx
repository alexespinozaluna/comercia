"use client";

import { useRouter } from "next/navigation";
import { Documento } from "@/types/database";
import { apiGet, apiPost } from "@/lib/api-client";
import { useResource } from "@/hooks/use-resource";
import { numToString, fechaString, parseDateOnly } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTableWrapper } from "@/components/shared/data-table-wrapper";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { RotateCcw, Receipt, CalendarDays, UserRound, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { esSoloLectura } from "@/lib/permisos";

export default function VentaEliminadasPage() {
  const router = useRouter();
  const soloLectura = esSoloLectura(useAppStore((s) => s.authUser)?.rol);
  const { data, loading, reload } = useResource(() =>
    apiGet<Documento[]>("/api/ventas/eliminadas"),
  );
  const docs = data ?? [];

  const handleRestore = async (id: number) => {
    try {
      await apiPost(`/api/ventas/${id}`, {});
      useAppStore.getState().triggerRefresh();
      toast.success("Documento restaurado");
      await reload();
    } catch (err) {
      console.error(err);
      toast.error("Error al restaurar");
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Papelera" onBack={() => router.back()} breadcrumbs={[{ label: "Ventas", href: "/venta" }, { label: "Eliminadas" }]} />
        <LoadingState variant="skeleton-list" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Papelera"
        onBack={() => router.back()}
        breadcrumbs={[
          { label: "Ventas", href: "/venta" },
          { label: "Eliminadas" },
        ]}
      />

      {docs.length === 0 ? (
        <EmptyState title="Sin documentos" description="No hay ventas eliminadas." />
      ) : (
        <DataTableWrapper>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-semibold">Documento</TableHead>
                <TableHead className="text-xs font-semibold">Fecha</TableHead>
                <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                <TableHead className="text-xs font-semibold text-right">Accion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map((d) => (
                <TableRow key={d.id} className="hover:bg-accent/30">
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{d.Concepto ?? d.Descripcion ?? `Venta #${d.id}`}</div>
                        {d.Cliente?.Nombre && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <UserRound className="h-3 w-3" /> {d.Cliente.Nombre}
                          </div>
                        )}
                        {d.UsuarioCreacion?.Nombre && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <UserCheck className="h-3 w-3" /> {d.UsuarioCreacion.Nombre}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {fechaString(parseDateOnly(d.FechaEmision))}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-right">{numToString(d.Total)}</TableCell>
                  <TableCell className="text-right">
                    {soloLectura ? null : (
                    <AlertDialog>
                      <AlertDialogTrigger className={cn(
                        "inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors",
                        "border shadow-sm h-8 px-3",
                        "text-success border-success/20 hover:bg-success/10"
                      )}>
                        <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Restaurar documento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            El documento volvera a estar visible en ventas.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRestore(d.id)} className="bg-success hover:bg-success/90">Restaurar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableWrapper>
      )}
    </div>
  );
}
