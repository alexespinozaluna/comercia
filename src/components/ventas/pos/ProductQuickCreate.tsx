"use client";

import { useState } from "react";
import { Producto } from "@/types/database";
import { apiPost } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";
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
import { Package } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface ProductQuickCreateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductCreated: (product: Producto) => void;
}

export function ProductQuickCreate({ open, onOpenChange, onProductCreated }: ProductQuickCreateProps) {
  const [nombre, setNombre] = useState("");
  const [precioCosto, setPrecioCosto] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setNombre("");
    setPrecioCosto("");
    setPrecioVenta("");
    setCantidad("");
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      toast.error("Nombre es requerido");
      return;
    }
    if (!precioVenta || parseFloat(precioVenta) <= 0) {
      toast.error("Precio de venta es requerido");
      return;
    }

    setSaving(true);
    try {
      const product = await apiPost<Producto>("/api/productos", {
        id: 0,
        FechaCreacion: new Date().toISOString(),
        Nombre: nombre.trim(),
        PrecioCosto: precioCosto ? parseFloat(precioCosto) : null,
        PrecioVenta: parseFloat(precioVenta),
        Cantidad: cantidad ? parseFloat(cantidad) : null,
        FechaVencimiento: null,
        Estado: 1,
      });

      useAppStore.getState().triggerRefresh();
      toast.success("Producto creado");
      onProductCreated(product);
      onOpenChange(false);
      resetForm();
    } catch {
      toast.error("Error al crear producto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(value) => { if (!value) resetForm(); onOpenChange(value); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nuevo producto</SheetTitle>
          <SheetDescription>Crea un producto y se agregara al carrito automaticamente</SheetDescription>
        </SheetHeader>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex flex-col gap-4 px-4 pt-4"
        >
          <div>
            <Label htmlFor="pq-nombre">Nombre *</Label>
            <Input
              id="pq-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del producto"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="pq-costo">Precio costo</Label>
            <Input
              id="pq-costo"
              type="number"
              value={precioCosto}
              onChange={(e) => setPrecioCosto(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="pq-venta">Precio venta *</Label>
            <Input
              id="pq-venta"
              type="number"
              value={precioVenta}
              onChange={(e) => setPrecioVenta(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="pq-cantidad">Stock inicial</Label>
            <Input
              id="pq-cantidad"
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              placeholder="0"
            />
          </div>

          <Button className="w-full gap-2" onClick={handleSave} disabled={saving || !nombre.trim()}>
            <Package className="h-4 w-4" />
            {saving ? "Creando..." : "Crear y agregar al carrito"}
          </Button>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}