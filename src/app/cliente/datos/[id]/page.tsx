"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Cliente, ClienteDireccion } from "@/types/database";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { Trash2, Plus, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
      {children}
    </label>
  );
}

export default function ClienteDatosPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState(0);
  const [isEdit, setIsEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nombre, setNombre] = useState("");
  const [nroTelefono, setNroTelefono] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [nroDocumento, setNroDocumento] = useState("");
  const [comentario, setComentario] = useState("");
  const [direcciones, setDirecciones] = useState<ClienteDireccion[]>([]);

  useEffect(() => {
    params.then(async (p) => {
      const parsedId = parseInt(p.id);
      setId(parsedId);
      setIsEdit(parsedId > 0);
      if (parsedId > 0) {
        try {
          const cliente = await apiGet<Cliente | null>(`/api/clientes/${parsedId}`);
          if (cliente) {
            setNombre(cliente.Nombre);
            setNroTelefono(cliente.NroTelefono ?? "");
            setTipoDocumento(cliente.TipoDocumento ?? "");
            setNroDocumento(cliente.NroDocumento ?? "");
            setComentario(cliente.Comentario ?? "");
            setDirecciones(cliente.ClienteDireccion ?? []);
          }
        } catch (err) {
          console.error(err);
        }
      }
      setLoading(false);
    });
  }, [params]);

  const addDireccion = () => {
    setDirecciones([
      ...direcciones,
      { id: 0, Direccion: "", Telefono: "", Contacto: "", IdCliente: id, bPrincipal: direcciones.length === 0 },
    ]);
  };

  const updateDireccion = (index: number, field: keyof ClienteDireccion, value: string | boolean) => {
    const updated = [...direcciones];
    (updated[index] as unknown as Record<string, unknown>)[field] = value;
    if (field === "bPrincipal" && value === true) {
      updated.forEach((d, i) => { if (i !== index) d.bPrincipal = false; });
    }
    setDirecciones(updated);
  };

  const removeDireccion = (index: number) => {
    setDirecciones(direcciones.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (saving) return;
    if (!nombre) { toast.error("Nombre es requerido"); return; }
    setSaving(true);
    try {
      const cliente: Cliente = {
        id,
        FechaCreacion: new Date().toISOString(),
        Nombre: nombre,
        NroTelefono: nroTelefono || null,
        TipoDocumento: tipoDocumento || null,
        NroDocumento: nroDocumento || null,
        Comentario: comentario || null,
        ClienteDireccion: direcciones,
      };
      if (isEdit) {
        await apiPut(`/api/clientes/${id}`, cliente);
        toast.success("Cliente actualizado");
      } else {
        await apiPost("/api/clientes", cliente);
        toast.success("Cliente creado");
      }
      useAppStore.getState().triggerRefresh();
      router.push("/cliente");
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar cliente");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiDelete(`/api/clientes/${id}`);
      useAppStore.getState().triggerRefresh();
      toast.success("Cliente eliminado");
      router.push("/cliente");
    } catch {
      toast.error("Error al eliminar cliente");
    }
  };

  if (loading) return <LoadingState variant="skeleton-form" count={4} />;

  return (
    <div className="space-y-2 max-w-lg">
      <PageHeader
        title={isEdit ? nombre || "Editar cliente" : "Nuevo cliente"}
        onBack={() => router.back()}
      />

      {/* Card — Datos personales */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Datos personales
        </h2>

        <div>
          <FieldLabel>Nombre *</FieldLabel>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del cliente"
            className="h-11 rounded-md"
          />
        </div>

        <div>
          <FieldLabel>Teléfono</FieldLabel>
          <Input
            value={nroTelefono}
            onChange={(e) => setNroTelefono(e.target.value)}
            placeholder="Número de celular"
            className="h-11 rounded-md"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Tipo documento</FieldLabel>
            <Select value={tipoDocumento} onValueChange={(v) => setTipoDocumento(v ?? "")}>
              <SelectTrigger className="h-11 rounded-md w-full">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CI">CI</SelectItem>
                <SelectItem value="RUT">RUT</SelectItem>
                <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                <SelectItem value="DNI">DNI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel>Nro documento</FieldLabel>
            <Input
              value={nroDocumento}
              onChange={(e) => setNroDocumento(e.target.value)}
              placeholder="Número"
              className="h-11 rounded-md"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Comentario</FieldLabel>
          <Textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Notas sobre el cliente"
            rows={2}
            className="rounded-md resize-none"
          />
        </div>
      </div>

      {/* Card — Direcciones */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Direcciones
          </h2>
          <span className="text-xs text-muted-foreground">{direcciones.length} registrada{direcciones.length !== 1 ? "s" : ""}</span>
        </div>

        {direcciones.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Sin direcciones. Agrega una.
          </p>
        )}

        {direcciones.map((d, i) => (
          <div key={i} className="rounded-md ring-1 ring-border/60 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">
                  Dirección {i + 1}
                </span>
                {d.bPrincipal && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm bg-brand-surface text-brand-dark">
                    Principal
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeDireccion(i)}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <Input
              placeholder="Dirección"
              value={d.Direccion}
              onChange={(e) => updateDireccion(i, "Direccion", e.target.value)}
              className="h-9 rounded-md"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Contacto"
                value={d.Contacto}
                onChange={(e) => updateDireccion(i, "Contacto", e.target.value)}
                className="h-9 rounded-md"
              />
              <Input
                placeholder="Teléfono"
                value={d.Telefono ?? ""}
                onChange={(e) => updateDireccion(i, "Telefono", e.target.value)}
                className="h-9 rounded-md"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={d.bPrincipal}
                onCheckedChange={(v) => updateDireccion(i, "bPrincipal", v)}
              />
              <Label className="text-xs cursor-pointer">Marcar como principal</Label>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addDireccion}
          className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark transition-colors"
        >
          <Plus className="h-4 w-4" />
          Agregar dirección
        </button>
      </div>

      {/* Actions */}
      <Button
        className="w-full h-12 bg-brand hover:bg-brand-dark text-white font-bold text-base"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Guardando..." : "Guardar"}
      </Button>

      {isEdit && id > 0 && (
        <AlertDialog>
          <AlertDialogTrigger
            className={cn(
              "w-full inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
              "h-10 px-4 border border-destructive/30 text-destructive hover:bg-destructive/5"
            )}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar cliente
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
              <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90"
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
