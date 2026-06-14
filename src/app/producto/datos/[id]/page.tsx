"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Producto } from "@/types/database";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { useResource } from "@/hooks/use-resource";
import { Input } from "@/components/ui/input";
import { MontoInput } from "@/components/shared/monto-input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { CategoriaSelect } from "@/components/producto/categoria-select";
import { SIN_CATEGORIA_ID } from "@/types/database";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import { useGuardar } from "@/hooks/use-guardar";
import { SlidersHorizontal } from "lucide-react";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
      {children}
    </label>
  );
}

export default function ProductoDatosPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const id = parseInt(use(params).id);
  const isEdit = id > 0;

  const [nombre, setNombre] = useState("");
  const [precioCosto, setPrecioCosto] = useState<number | null>(null);
  const [precioVenta, setPrecioVenta] = useState(0);
  const [cantidad, setCantidad] = useState<number | null>(null);
  const [fechaVencimiento, setFechaVencimiento] = useState<string>("");
  const [idCategoria, setIdCategoria] = useState<number>(SIN_CATEGORIA_ID);
  const [activoVenta, setActivoVenta] = useState<boolean>(true);
  const { saving, guardar } = useGuardar();

  const { data: product, loading } = useResource(
    () => (isEdit ? apiGet<Producto | null>(`/api/productos/${id}`) : Promise.resolve(null)),
    [id],
  );

  // Poblar el formulario al editar (en alta queda con los valores por defecto).
  useEffect(() => {
    if (!product) return;
    setNombre(product.Nombre);
    setPrecioCosto(product.PrecioCosto);
    setPrecioVenta(product.PrecioVenta);
    setCantidad(product.Cantidad);
    setFechaVencimiento(product.FechaVencimiento?.split("T")[0] ?? "");
    setIdCategoria(product.IdCategoria ?? SIN_CATEGORIA_ID);
    setActivoVenta(product.bActivoVenta ?? true);
  }, [product]);

  const handleSave = () => guardar(async () => {
    if (!nombre) { toast.error("Nombre es requerido"); return; }
    if (precioVenta <= 0) { toast.error("Precio de venta es requerido"); return; }
    try {
      const data = {
        Nombre: nombre,
        PrecioCosto: precioCosto,
        PrecioVenta: precioVenta,
        Cantidad: cantidad,
        FechaVencimiento: fechaVencimiento || null,
        IdCategoria: idCategoria,
        bActivoVenta: activoVenta,
      };
      if (isEdit) {
        await apiPut(`/api/productos/${id}`, data);
        toast.success("Producto actualizado");
      } else {
        await apiPost("/api/productos", data);
        toast.success("Producto creado");
      }
      useAppStore.getState().triggerRefresh();
      router.push("/producto");
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar producto");
    }
  });

  if (loading) return <LoadingState variant="skeleton-form" count={4} />;

  return (
    <div className="space-y-2 max-w-lg">
      <PageHeader
        title={isEdit ? nombre || "Editar producto" : "Nuevo producto"}
        onBack={() => router.back()}
      />

      {/* Card — Datos del producto */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Datos del producto
        </h2>

        {/* Nombre */}
        <div>
          <FieldLabel>Nombre *</FieldLabel>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del producto"
            className="h-11 rounded-md"
          />
        </div>

        {/* Precio Venta */}
        <div>
          <FieldLabel>Precio de venta *</FieldLabel>
          <MontoInput
            value={precioVenta}
            onChange={setPrecioVenta}
            className="h-11 rounded-md text-brand-dark font-semibold"
          />
        </div>

        {/* Categoría */}
        <div>
          <FieldLabel>Categoría</FieldLabel>
          <CategoriaSelect value={idCategoria} onChange={setIdCategoria} />
        </div>

        {/* Activo para venta */}
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Activo para venta</p>
            <p className="text-[11px] text-muted-foreground">
              Si se desactiva, no aparece en la lista de venta
            </p>
          </div>
          <Switch checked={activoVenta} onCheckedChange={setActivoVenta} />
        </div>

        {/* Precio Costo */}
        <div>
          <FieldLabel>Precio de costo</FieldLabel>
          <MontoInput
            value={precioCosto ?? 0}
            onChange={(n) => setPrecioCosto(n || null)}
            className="h-11 rounded-md"
          />
        </div>

        {/* Cantidad */}
        <div>
          <FieldLabel>{isEdit ? "Stock actual" : "Cantidad inicial"}</FieldLabel>
          {isEdit ? (
            <div className="flex items-center gap-3 rounded-md bg-muted/50 border border-border px-3 py-2.5">
              <span className="text-sm font-semibold">{cantidad ?? "—"}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto gap-1.5"
                onClick={() => router.push(`/producto/ajustes?producto=${id}`)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Ajustar Stock
              </Button>
            </div>
          ) : (
            <Input
              type="number"
              value={cantidad ?? ""}
              onChange={(e) => setCantidad(parseInt(e.target.value) || null)}
              placeholder="0"
              className="h-11 rounded-md"
            />
          )}
        </div>

        {/* Fecha de vencimiento */}
        <div>
          <FieldLabel>Fecha de vencimiento</FieldLabel>
          <Input
            type="date"
            value={fechaVencimiento}
            onChange={(e) => setFechaVencimiento(e.target.value)}
            className="h-11 rounded-md"
          />
        </div>
      </div>

      {/* Save */}
      <Button
        className="w-full h-12 bg-brand hover:bg-brand-dark text-white font-bold text-base"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}
