"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Producto } from "@/types/database";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import Link from "next/link";
import { Info } from "lucide-react";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
      {children}
    </label>
  );
}

export default function ProductoDatosPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState(0);
  const [isEdit, setIsEdit] = useState(false);

  const [nombre, setNombre] = useState("");
  const [precioCosto, setPrecioCosto] = useState<number | null>(null);
  const [precioVenta, setPrecioVenta] = useState(0);
  const [cantidad, setCantidad] = useState<number | null>(null);
  const [fechaVencimiento, setFechaVencimiento] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(async (p) => {
      const parsedId = parseInt(p.id);
      setId(parsedId);
      setIsEdit(parsedId > 0);
      if (parsedId > 0) {
        try {
          const product = await apiGet<Producto | null>(`/api/productos/${parsedId}`);
          if (product) {
            setNombre(product.Nombre);
            setPrecioCosto(product.PrecioCosto);
            setPrecioVenta(product.PrecioVenta);
            setCantidad(product.Cantidad);
            setFechaVencimiento(product.FechaVencimiento?.split("T")[0] ?? "");
          }
        } catch (err) {
          console.error(err);
        }
      }
      setLoading(false);
    });
  }, [params]);

  const handleSave = async () => {
    if (!nombre) { toast.error("Nombre es requerido"); return; }
    if (precioVenta <= 0) { toast.error("Precio de venta es requerido"); return; }
    try {
      const data = {
        Nombre: nombre,
        PrecioCosto: precioCosto,
        PrecioVenta: precioVenta,
        Cantidad: cantidad,
        FechaVencimiento: fechaVencimiento || null,
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
  };

  if (loading) return <LoadingState variant="skeleton-form" count={4} />;

  return (
    <div className="space-y-4 max-w-lg">
      <PageHeader
        title={isEdit ? nombre || "Editar producto" : "Nuevo producto"}
        onBack={() => router.back()}
      />

      {/* Card — Datos del producto */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-4 space-y-3">
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
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">
              $
            </span>
            <Input
              type="number"
              value={precioVenta || ""}
              onChange={(e) => setPrecioVenta(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="h-11 rounded-md pl-7 text-brand-dark font-semibold"
            />
          </div>
        </div>

        {/* Precio Costo */}
        <div>
          <FieldLabel>Precio de costo</FieldLabel>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">
              $
            </span>
            <Input
              type="number"
              value={precioCosto ?? ""}
              onChange={(e) => setPrecioCosto(parseFloat(e.target.value) || null)}
              placeholder="0"
              className="h-11 rounded-md pl-7"
            />
          </div>
        </div>

        {/* Cantidad */}
        <div>
          <FieldLabel>Cantidad inicial</FieldLabel>
          {isEdit ? (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 border border-border px-3 py-2.5">
              <Info className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">
                Stock gestionado en{" "}
                <Link href="/producto/ajustes" className="font-semibold text-brand hover:text-brand-dark underline underline-offset-2">
                  Ajustes de stock
                </Link>
              </span>
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
      >
        Guardar
      </Button>
    </div>
  );
}
