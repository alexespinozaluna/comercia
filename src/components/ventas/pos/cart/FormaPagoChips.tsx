"use client";

import { Wallet } from "lucide-react";
import { MetodoPago } from "@/types/database";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./SectionLabel";

interface FormaPagoChipsProps {
  metodos: MetodoPago[];
  selectedId: number | null;
  onChange: (id: number | null) => void;
}

export function FormaPagoChips({ metodos, selectedId, onChange }: FormaPagoChipsProps) {
  if (metodos.length === 0) return null;

  return (
    <div className="space-y-2">
      <SectionLabel icon={<Wallet className="h-3.5 w-3.5" />}>Forma de pago *</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {metodos.map((m) => {
          const active = selectedId === m.id;
          return (
            <button
              key={m.id}
              type="button"
              // Requerido en venta pagada: seleccionar siempre (no se puede deseleccionar).
              onClick={() => onChange(m.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ring-1",
                active
                  ? "bg-brand text-white ring-brand"
                  : "bg-white dark:bg-card text-foreground ring-border/60 hover:ring-brand/40 hover:bg-brand-surface/60"
              )}
            >
              {m.Simbolo ? `${m.Simbolo} ` : ""}{m.Nombre}
            </button>
          );
        })}
      </div>
      {selectedId == null && (
        <p className="text-xs text-destructive">Seleccione una forma de pago.</p>
      )}
    </div>
  );
}
