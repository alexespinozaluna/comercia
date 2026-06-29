"use client";

import { ChevronLeft, Lock } from "lucide-react";
import { Cliente, MetodoPago } from "@/types/database";
import { BasketItemLocal } from "@/hooks/pos/use-basket";
import { DireccionOption } from "@/hooks/pos/use-cliente-seleccionado";
import { numToString, cantidadString } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ClientSelector } from "@/components/ventas/pos/ClientSelector";
import { FormaVentaToggle } from "@/components/ventas/pos/cart/FormaVentaToggle";
import { FormaPagoChips } from "@/components/ventas/pos/cart/FormaPagoChips";
import { FormaPagoDeuda } from "@/components/ventas/pos/cart/FormaPagoDeuda";
import { FechaSection } from "@/components/ventas/pos/cart/FechaSection";
import { NotasSection } from "@/components/ventas/pos/cart/NotasSection";

interface PasoCrearProps {
  items: BasketItemLocal[];
  /** Bruto (Σ items). */
  subtotal: number;
  /** Monto del descuento global (0 = sin descuento). */
  montoDescuento: number;
  /** Neto (subtotal − descuento). */
  total: number;
  fecha: string;
  onFechaChange: (fecha: string) => void;
  isCredit: boolean;
  onIsCreditChange: (isCredit: boolean) => void;
  metodosPago: MetodoPago[];
  selectedIdMetodoPago: number | null;
  onIdMetodoPagoChange: (id: number | null) => void;
  selectedClientId: number | null;
  selectedClientName: string;
  selectedDireccionId: number | null;
  direcciones: DireccionOption[];
  onSelectClient: (cliente: Cliente) => void;
  onRemoveClient: () => void;
  onDireccionChange: (id: number | null) => void;
  concepto: string;
  autoDescripcion: string;
  onConceptoChange: (value: string) => void;
  onClearConcepto: () => void;
  cajaAbierta: boolean | null;
  canSave: boolean;
  saving: boolean;
  /** True al editar una venta existente (cambia la etiqueta del botón). */
  isEdit?: boolean;
  onSave: () => void;
  onBack: () => void;
}

/** Paso 3 del wizard móvil: datos de la venta y guardado. */
export function PasoCrear({
  items,
  subtotal,
  montoDescuento,
  total,
  fecha,
  onFechaChange,
  isCredit,
  onIsCreditChange,
  metodosPago,
  selectedIdMetodoPago,
  onIdMetodoPagoChange,
  selectedClientId,
  selectedClientName,
  selectedDireccionId,
  direcciones,
  onSelectClient,
  onRemoveClient,
  onDireccionChange,
  concepto,
  autoDescripcion,
  onConceptoChange,
  onClearConcepto,
  cajaAbierta,
  canSave,
  saving,
  isEdit = false,
  onSave,
  onBack,
}: PasoCrearProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
          Volver
        </button>
        <h2 className="text-[17px] font-bold">Datos de la venta</h2>
      </div>

      {/* Resumen compacto (no editable) */}
      <div className="rounded-lg ring-1 ring-border/50 bg-white dark:bg-card p-3 space-y-1.5">
        {items.map((item) => (
          <div key={item._tempId} className="flex justify-between text-sm">
            <span className="truncate text-muted-foreground">
              {item.Descripcion} × {cantidadString(item.Cantidad)}
            </span>
            <span className="font-semibold tabular-nums shrink-0 ml-2">
              {numToString(item.Cantidad * item.PrecioVenta)}
            </span>
          </div>
        ))}
        {montoDescuento > 0 && (
          <div className="pt-1.5 border-t border-border space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{numToString(subtotal)}</span>
            </div>
            <div className="flex justify-between text-success">
              <span>Descuento</span>
              <span className="tabular-nums">−{numToString(montoDescuento)}</span>
            </div>
          </div>
        )}
        <div
          className={cn(
            "flex justify-between items-baseline pt-1.5",
            montoDescuento === 0 && "border-t border-border",
          )}
        >
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Total</span>
          <span className="text-[22px] font-extrabold text-brand-dark tabular-nums">
            {numToString(total)}
          </span>
        </div>
      </div>

      {/* Advertencia caja cerrada (el server igual valida y rechaza) */}
      {cajaAbierta === false && (
        <div className="rounded-md border bg-warning/10 border-warning/20 p-3 text-xs flex items-center gap-2">
          <Lock className="h-4 w-4 text-warning shrink-0" />
          <span>Debe abrir la caja para registrar ventas.</span>
        </div>
      )}

      {/* Formulario */}
      <div className="rounded-lg ring-1 ring-border/50 bg-white dark:bg-card p-3 space-y-4">
        <FormaVentaToggle isCredit={isCredit} onChange={onIsCreditChange} />

        <FechaSection fecha={fecha} onChange={onFechaChange} />

        {isCredit ? (
          <FormaPagoDeuda />
        ) : (
          <FormaPagoChips
            metodos={metodosPago}
            selectedId={selectedIdMetodoPago}
            onChange={onIdMetodoPagoChange}
          />
        )}

        <ClientSelector
          selectedClientId={selectedClientId}
          selectedClientName={selectedClientName}
          selectedDireccionId={selectedDireccionId}
          direcciones={direcciones}
          onSelectClient={onSelectClient}
          onRemoveClient={onRemoveClient}
          onDireccionChange={onDireccionChange}
          requireRealClient={isCredit}
        />

        <NotasSection
          concepto={concepto}
          autoDescripcion={autoDescripcion}
          onChange={onConceptoChange}
          onClear={onClearConcepto}
        />
      </div>

      {/* Espacio para que la barra fija no tape el formulario */}
      <div className="pb-28" />

      {/* Barra fija — Guardar */}
      <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 bg-white/95 dark:bg-card/95 backdrop-blur-sm border-t px-4 py-3 z-30">
        <Button
          className="w-full h-12 text-base font-bold bg-brand hover:bg-brand-dark text-white"
          onClick={onSave}
          disabled={!canSave || saving}
        >
          {saving
            ? "Guardando..."
            : `${isEdit ? "Modificar" : "Guardar"} venta · ${numToString(total)}`}
        </Button>
      </div>
    </div>
  );
}
