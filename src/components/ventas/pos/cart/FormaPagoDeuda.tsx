"use client";

import { Wallet, Lock } from "lucide-react";
import { SectionLabel } from "./SectionLabel";

/**
 * Indicador de solo lectura para ventas a crédito: la forma de pago queda
 * fijada en "Deuda" automáticamente (el backend asigna el método "Deuda" del
 * tenant). No es seleccionable — sustituye a FormaPagoChips cuando isCredit.
 */
export function FormaPagoDeuda() {
  return (
    <div className="space-y-2">
      <SectionLabel icon={<Wallet className="h-3.5 w-3.5" />}>Forma de pago</SectionLabel>
      <div className="flex items-center gap-1.5 w-fit px-3 py-1.5 rounded-md text-xs font-semibold ring-1 bg-warning/10 text-warning ring-warning/20">
        <Lock className="h-3 w-3" />
        Deuda
      </div>
      <p className="text-[11px] text-muted-foreground">
        Las ventas a crédito se registran como Deuda automáticamente.
      </p>
    </div>
  );
}
