"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Tag } from "lucide-react";
import { numToString } from "@/lib/format";
import { MontoInput } from "@/components/shared/monto-input";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DescuentoModo } from "@/hooks/pos/use-descuento";
import { SectionLabel } from "./SectionLabel";

interface DescuentoSectionProps {
  subtotal: number;
  montoDescuento: number;
  total: number;
  modo: DescuentoModo;
  valor: number;
  onModoChange: (modo: DescuentoModo) => void;
  onValorChange: (valor: number) => void;
}

/**
 * Sección desplegable de descuento global. Plegada por defecto; se auto-abre
 * cuando ya hay un descuento (p. ej. al editar una venta). Permite elegir entre
 * porcentaje y monto fijo, y muestra el desglose Subtotal / Descuento / Total.
 */
export function DescuentoSection({
  subtotal,
  montoDescuento,
  total,
  modo,
  valor,
  onModoChange,
  onValorChange,
}: DescuentoSectionProps) {
  const [open, setOpen] = useState(false);
  const tieneDescuento = montoDescuento > 0;

  // Auto-abrir cuando aparece un descuento (edición). Una sola vía: no se
  // vuelve a cerrar solo, para no pelear con el usuario que lo colapsa.
  useEffect(() => {
    if (tieneDescuento) setOpen(true);
  }, [tieneDescuento]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <SectionLabel icon={<Tag className="h-3.5 w-3.5" />}>Descuento</SectionLabel>
        <span className="flex items-center gap-1.5">
          {tieneDescuento && (
            <span className="text-xs font-semibold text-success tabular-nums">
              −{numToString(montoDescuento)}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-3">
          {/* Toggle modo + input */}
          <div className="flex gap-2">
            <div className="flex rounded-md ring-1 ring-border/60 overflow-hidden shrink-0">
              {(["monto", "pct"] as DescuentoModo[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onModoChange(m)}
                  className={cn(
                    "px-3 text-sm font-semibold transition-colors",
                    modo === m
                      ? "bg-brand text-white"
                      : "bg-white dark:bg-card text-muted-foreground hover:bg-brand-surface/60",
                  )}
                >
                  {m === "monto" ? "$" : "%"}
                </button>
              ))}
            </div>

            <div className="flex-1">
              {modo === "monto" ? (
                <MontoInput
                  value={valor}
                  onChange={onValorChange}
                  ariaLabel="Monto de descuento"
                  className="h-10"
                />
              ) : (
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    aria-label="Porcentaje de descuento"
                    placeholder="0"
                    value={valor || ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      onValorChange(isNaN(n) ? 0 : Math.min(Math.max(n, 0), 100));
                    }}
                    className="h-10 pr-7 tabular-nums"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none">
                    %
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Desglose */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{numToString(subtotal)}</span>
            </div>
            <div className="flex justify-between text-success">
              <span>Descuento</span>
              <span className="tabular-nums">−{numToString(montoDescuento)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-border pt-1">
              <span>Total</span>
              <span className="tabular-nums">{numToString(total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
