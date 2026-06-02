"use client";

import { useState, useEffect } from "react";
import { Producto } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";
import { numToString, cantidadString } from "@/lib/format";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { Package, ArrowDownRight, ArrowUpDown, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MOTIVOS_BAJA = ["Merma", "Vencimiento", "Daño", "Robo", "Ajuste de Inventario"] as const;
const MOTIVOS_INVENTARIO = ["Inventario Fisico", "Reconteo"] as const;

type AjusteMode = "baja" | "inventario";

interface RegistroBajaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: AjusteMode;
  /** Si se indica, preselecciona ese producto al abrir. */
  initialProductId?: number;
}

export function RegistroBajaForm({ open, onOpenChange, initialMode = "baja", initialProductId }: RegistroBajaFormProps) {
  const [mode, setMode] = useState<AjusteMode>(initialMode);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState<number>(0);
  const [motivo, setMotivo] = useState<string>("");
  const [observacion, setObservacion] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync mode when initialMode changes (e.g., user clicks different buttons)
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setMotivo("");
      setCantidad(0);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<Producto[]>("/api/productos");
        const conStock = data.filter((p) => p.Cantidad != null);
        if (cancelled) return;
        setProductos(conStock);
        // Preselección por id (botón "Ajustar Stock" desde el detalle del producto)
        if (initialProductId) {
          const found = conStock.find((p) => p.id === initialProductId);
          if (found) {
            setSelectedProduct(found);
            setCantidad(0);
          }
        }
      } catch {
        if (!cancelled) toast.error("Error al cargar productos");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, initialProductId]);

  const filtered = search
    ? productos.filter((p) => p.Nombre.toLowerCase().includes(search.toLowerCase()))
    : productos;

  const handleSelectProduct = (p: Producto) => {
    setSelectedProduct(p);
    setSearch("");
    setCantidad(0);
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setSearch("");
    setCantidad(0);
    setMotivo("");
    setObservacion("");
  };

  // Computed values for inventario mode
  const stockActual = selectedProduct?.Cantidad ?? 0;
  const diferencia = mode === "inventario" ? cantidad - stockActual : 0;
  const isPositiveDiff = diferencia > 0;
  const isNegativeDiff = diferencia < 0;
  const canSave = (() => {
    if (!selectedProduct || !motivo || saving) return false;
    if (mode === "baja") return cantidad > 0 && cantidad <= stockActual;
    if (mode === "inventario") return cantidad >= 0 && cantidad !== stockActual;
    return false;
  })();

  const handleSave = async () => {
    if (!selectedProduct) { toast.error("Seleccione un producto"); return; }
    if (!motivo) { toast.error("Seleccione un motivo"); return; }
    if (saving) return;

    setSaving(true);
    try {
      const res = await fetch("/api/ajustes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          IdProducto: selectedProduct.id,
          Cantidad: cantidad,
          Motivo: motivo,
          Observacion: observacion.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al registrar");
      }

      if (mode === "inventario") {
        const diff = data.data?.stockNuevo - data.data?.stockAnterior;
        const direction = diff > 0 ? "ingreso" : "egreso";
        toast.success(`Inventario registrado: ${selectedProduct.Nombre} → ${data.data?.stockNuevo} (${Math.abs(diff)} ${direction})`);
      } else {
        toast.success(`Baja registrada: ${selectedProduct.Nombre} x${cantidad}`);
      }

      useAppStore.getState().triggerRefresh();
      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setSaving(false);
    }
  };

  const validMotivos = mode === "inventario" ? MOTIVOS_INVENTARIO : MOTIVOS_BAJA;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { resetForm(); setMode("baja"); } onOpenChange(v); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className={cn(
              "h-7 w-7 rounded-lg flex items-center justify-center",
              mode === "inventario" ? "bg-sky-500/10" : "bg-amber-500/10"
            )}>
              {mode === "inventario"
                ? <ArrowUpDown className="h-4 w-4 text-sky-600" />
                : <ArrowDownRight className="h-4 w-4 text-amber-600" />
              }
            </div>
            {mode === "inventario" ? "Inventario Fisico" : "Registro de Baja"}
          </SheetTitle>
          <SheetDescription>
            {mode === "inventario"
              ? "Establece el stock contado y el sistema ajusta la diferencia"
              : "Registra una baja de inventario por merma, vencimiento o ajuste"
            }
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          {/* Mode toggle */}
          <div className="flex gap-1.5 p-1 rounded-lg bg-muted/50">
            <Button
              variant={mode === "baja" ? "default" : "ghost"}
              size="sm"
              className={cn("flex-1 h-8 text-xs font-medium", mode === "baja" && "shadow-sm")}
              onClick={() => { setMode("baja"); setMotivo(""); setCantidad(0); }}
            >
              <ArrowDownRight className="h-3.5 w-3.5 mr-1" /> Baja
            </Button>
            <Button
              variant={mode === "inventario" ? "default" : "ghost"}
              size="sm"
              className={cn("flex-1 h-8 text-xs font-medium", mode === "inventario" && "shadow-sm")}
              onClick={() => { setMode("inventario"); setMotivo(""); setCantidad(0); }}
            >
              <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> Inventario
            </Button>
          </div>

          {/* Product selection */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Producto *</Label>
            {selectedProduct ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border ring-1 ring-primary/20 bg-primary/5">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{selectedProduct.Nombre}</div>
                  <div className="text-xs text-muted-foreground">
                    Stock: <span className="font-semibold">{cantidadString(selectedProduct.Cantidad)}</span>
                    {" · "}{numToString(selectedProduct.PrecioVenta)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => { setSelectedProduct(null); setCantidad(0); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Command className="rounded-lg border shadow-none">
                <CommandInput
                  placeholder="Buscar producto..."
                  value={search}
                  onValueChange={setSearch}
                />
                <CommandList>
                  <CommandEmpty>No se encontraron productos</CommandEmpty>
                  <CommandGroup>
                    {filtered.slice(0, 20).map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.Nombre}
                        onSelect={() => handleSelectProduct(p)}
                        className="flex items-center gap-3 px-3 py-2.5"
                      >
                        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Package className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{p.Nombre}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {p.Cantidad != null ? (
                              <StatusBadge variant={p.Cantidad > 0 ? "success" : "error"}>
                                {cantidadString(p.Cantidad)}
                              </StatusBadge>
                            ) : null}
                            <span>{numToString(p.PrecioVenta)}</span>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </div>

          <Separator />

          {/* Quantity */}
          {mode === "inventario" ? (
            <div className="space-y-2">
              <Label htmlFor="inv-cantidad" className="text-xs text-muted-foreground">
                Cantidad Contada *
              </Label>
              {selectedProduct && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
                  <span className="text-xs text-muted-foreground">Stock actual:</span>
                  <span className="text-sm font-bold">{stockActual}</span>
                </div>
              )}
              <Input
                id="inv-cantidad"
                type="number"
                min={0}
                value={cantidad || ""}
                onChange={(e) => setCantidad(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="h-9"
                disabled={!selectedProduct}
              />
              {selectedProduct && cantidad >= 0 && selectedProduct.Cantidad !== null && (
                <div className={cn(
                  "text-xs font-medium",
                  isPositiveDiff ? "text-emerald-600" : isNegativeDiff ? "text-amber-600" : "text-muted-foreground"
                )}>
                  {isPositiveDiff && `Se ingresaran +${diferencia} unidades`}
                  {isNegativeDiff && `Se daran de baja ${Math.abs(diferencia)} unidades`}
                  {diferencia === 0 && "Sin diferencia"}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="baja-cantidad" className="text-xs text-muted-foreground">Cantidad *</Label>
              <Input
                id="baja-cantidad"
                type="number"
                min={1}
                max={selectedProduct?.Cantidad ?? undefined}
                value={cantidad || ""}
                onChange={(e) => setCantidad(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="h-9"
                disabled={!selectedProduct}
              />
              {selectedProduct && (
                <div className="text-xs text-muted-foreground">
                  Stock disponible: <span className="font-medium">{cantidadString(selectedProduct.Cantidad)}</span>
                </div>
              )}
            </div>
          )}

          {/* Motivo */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Motivo *</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v ?? "")}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seleccionar motivo" />
              </SelectTrigger>
              <SelectContent>
                {validMotivos.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observacion */}
          <div className="space-y-1">
            <Label htmlFor="ajuste-obs" className="text-xs text-muted-foreground">Observacion (opcional)</Label>
            <Input
              id="ajuste-obs"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Detalle adicional..."
              className="h-9"
            />
          </div>

          {/* Preview */}
          {selectedProduct && (mode === "baja" ? cantidad > 0 : cantidad >= 0 && cantidad !== stockActual) && (
            <div className={cn(
              "rounded-xl border ring-1 p-3 space-y-1.5",
              mode === "inventario"
                ? "ring-sky-500/20 bg-sky-500/5"
                : "ring-amber-500/20 bg-amber-500/5"
            )}>
              <div className={cn(
                "text-xs font-medium",
                mode === "inventario" ? "text-sky-600 dark:text-sky-400" : "text-amber-600 dark:text-amber-400"
              )}>
                Vista previa
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Producto</span>
                <span className="font-medium">{selectedProduct.Nombre}</span>
              </div>

              {mode === "inventario" ? (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Stock actual</span>
                    <span className="font-medium">{stockActual}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Cantidad contada</span>
                    <span className="font-bold">{cantidad}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Diferencia</span>
                    <span className={cn(
                      "font-bold",
                      isPositiveDiff ? "text-emerald-600" : isNegativeDiff ? "text-amber-600" : ""
                    )}>
                      {isPositiveDiff ? `+${diferencia}` : diferencia === 0 ? "0" : diferencia}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Stock resultante</span>
                    <span className="font-bold">{cantidad}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Cantidad</span>
                    <span className="font-medium text-amber-600">-{cantidad}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Stock resultante</span>
                    <span className="font-bold">{selectedProduct.Cantidad! - cantidad}</span>
                  </div>
                </>
              )}

              {motivo && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Motivo</span>
                  <span className="font-medium">{motivo}</span>
                </div>
              )}
            </div>
          )}

          <Button
            className={cn("w-full shadow-sm gap-1.5", mode === "inventario" && "bg-sky-600 hover:bg-sky-700")}
            size="lg"
            onClick={handleSave}
            disabled={!canSave}
          >
            {saving ? (
              <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : mode === "inventario" ? (
              <ArrowUpDown className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            {saving ? "Registrando..." : mode === "inventario" ? "Establecer Stock" : "Registrar Baja"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}