"use client";

import { ReactNode, useState } from "react";
import { numToString } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Receipt, Lock, Package, StickyNote, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BasketItemLocal } from "@/hooks/use-pos-transaction";
import { CartItemDetailSheet } from "./CartItemDetailSheet";
import { motion, AnimatePresence } from "framer-motion";

interface CartSummaryProps {
  basket: BasketItemLocal[];
  total: number;
  fecha: string;
  isCredit: boolean;
  cajaAbierta: boolean | null;
  isEdit: boolean;
  canSave: boolean;
  descripcion: string;
  concepto: string;
  onFechaChange: (fecha: string) => void;
  onIsCreditChange: (isCredit: boolean) => void;
  onUpdateQuantity: (tempId: string, delta: number) => void;
  onSetQuantity: (tempId: string, value: number) => void;
  onUpdatePrice: (tempId: string, price: number) => void;
  onRemoveItem: (tempId: string) => void;
  onConceptoChange: (value: string) => void;
  onClearConcepto: () => void;
  onSave: () => void;
  children: ReactNode;
  inSheet?: boolean;
}

export function CartSummary({
  basket,
  total,
  fecha,
  isCredit,
  cajaAbierta,
  isEdit,
  canSave,
  descripcion,
  concepto,
  onFechaChange,
  onIsCreditChange,
  onUpdateQuantity,
  onSetQuantity,
  onUpdatePrice,
  onRemoveItem,
  onConceptoChange,
  onClearConcepto,
  onSave,
  children,
  inSheet = false,
}: CartSummaryProps) {
  const [editItem, setEditItem] = useState<BasketItemLocal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleItemTap = (item: BasketItemLocal) => {
    setEditItem(item);
    setDetailOpen(true);
  };

  const handleSave = () => {
    if (saving) return;
    setSaving(true);
    onSave();
  };

  const handleVaciar = () => {
    basket.forEach((item) => onRemoveItem(item._tempId));
  };

  /* ── Bottom bar (total + save button) ──────────────────────── */
  const BottomBar = (
    <div
      className={cn(
        "bg-white dark:bg-card border-t",
        inSheet
          ? "sticky bottom-0 -mx-4 px-4 py-3 backdrop-blur-sm bg-white/95 dark:bg-card/95"
          : "fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 md:left-[220px] z-40 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.07)]"
      )}
    >
      <div className={cn("space-y-3", !inSheet && "max-w-lg mx-auto")}>
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-[28px] font-extrabold tabular-nums leading-none text-brand-dark">
            {numToString(total, "N2")}
          </span>
        </div>
        <Button
          className={cn(
            "w-full h-12 text-base font-bold bg-brand hover:bg-brand-dark text-white rounded-md transition-all",
            (!canSave || saving) && "opacity-50 cursor-not-allowed"
          )}
          onClick={handleSave}
          disabled={!canSave || saving}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Guardando...
            </span>
          ) : (
            <>
              <Receipt className="h-5 w-5 mr-2" />
              {isEdit ? "Modificar venta" : "Guardar venta"}
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className={cn("space-y-5", inSheet ? "pb-28" : "pb-44 md:pb-36")}>

        {/* Items list */}
        <div className="space-y-1">
          {/* Section header */}
          {basket.length > 0 && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {basket.length} producto{basket.length !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={handleVaciar}
                className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
              >
                Vaciar
              </button>
            </div>
          )}

          {basket.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Package className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">La canasta está vacía</p>
            </div>
          ) : (
            <div className="rounded-md bg-white dark:bg-card ring-1 ring-border/50 divide-y divide-border overflow-hidden">
              {basket.map((item) => {
                const subtotal = item.Cantidad * item.PrecioVenta;
                return (
                  <div
                    key={item._tempId}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => handleItemTap(item)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{item.Descripcion}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.Cantidad} × {numToString(item.PrecioVenta)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Inline quantity controls */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item._tempId, -1); }}
                          disabled={item.Cantidad <= 1}
                          className={cn(
                            "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                            item.Cantidad <= 1
                              ? "bg-muted/50 text-muted-foreground/40 cursor-not-allowed"
                              : "bg-muted hover:bg-accent text-muted-foreground"
                          )}
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-xs font-bold tabular-nums">
                          {item.Cantidad}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onUpdateQuantity(item._tempId, 1); }}
                          className="h-6 w-6 rounded-full bg-muted hover:bg-accent flex items-center justify-center text-xs font-bold text-muted-foreground transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-foreground min-w-[4rem] text-right">
                        {numToString(subtotal)}
                      </span>
                      <Pencil className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRemoveItem(item._tempId); }}
                        aria-label={`Eliminar ${item.Descripcion}`}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Forma de pago — toggle pill */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Forma de pago
          </Label>
          <div className="relative flex bg-muted/60 rounded-lg p-[3px] gap-0">
            {(["efectivo", "credito"] as const).map((v) => {
              const active = (v === "credito") === isCredit;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onIsCreditChange(v === "credito")}
                  className="relative flex-1 flex items-center justify-center gap-1.5 z-10 py-2 px-3 rounded-md"
                >
                  {active && (
                    <motion.div
                      layoutId="payment-toggle"
                      className="absolute inset-0 bg-white dark:bg-card rounded-md shadow-sm"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <Receipt className={cn("relative z-10 h-3.5 w-3.5", active ? "text-brand" : "text-muted-foreground")} />
                  <span
                    className={cn(
                      "relative z-10 text-sm transition-colors",
                      active ? "font-semibold text-brand-dark" : "font-medium text-muted-foreground"
                    )}
                  >
                    {v === "efectivo" ? "Contado" : "Crédito"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cliente — solo si crédito */}
        <AnimatePresence>
          {isCredit && (
            <motion.div
              key="client-section"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Cliente
                </Label>
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fecha */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Fecha
          </Label>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => onFechaChange(e.target.value)}
            className="h-9 text-sm rounded-md"
          />
        </div>

        {/* Notas */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <StickyNote className="h-3.5 w-3.5" />
              Notas
            </Label>
            {concepto !== descripcion && concepto && (
              <button
                type="button"
                onClick={onClearConcepto}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Restaurar auto
              </button>
            )}
          </div>
          <Textarea
            value={concepto}
            onChange={(e) => onConceptoChange(e.target.value)}
            placeholder={descripcion || "Resumen automático de productos..."}
            rows={2}
            className="text-sm min-h-14 resize-none rounded-md"
          />
        </div>

        {/* Caja warning */}
        {cajaAbierta === false && (
          <div className="rounded-md border bg-warning/10 border-warning/20 p-3 text-xs flex items-center gap-2">
            <Lock className="h-4 w-4 text-warning shrink-0" />
            <span>Debe abrir la caja para registrar ventas.</span>
          </div>
        )}
      </div>

      {BottomBar}

      <CartItemDetailSheet
        item={editItem}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdateQuantity={onUpdateQuantity}
        onSetQuantity={onSetQuantity}
        onUpdatePrice={onUpdatePrice}
        onRemoveItem={onRemoveItem}
      />
    </>
  );
}
