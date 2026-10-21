"use client";

import { Landmark, Copy } from "lucide-react";
import { toast } from "sonner";

/** Cuentas del negocio para pagar por transferencia (ventas a crédito).
 * `subtitulo`: p. ej. sucursal y monto, cuando hay cuentas de varias sucursales. */
export function DatosTransferenciaCard({ texto, subtitulo }: { texto: string; subtitulo?: string }) {
  if (!texto) return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Datos copiados");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 overflow-hidden">
      <div className="flex justify-between items-center px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border-b border-border">
        <span className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
          <Landmark className="h-4 w-4" /> Datos para transferencia
        </span>
        <button
          type="button"
          onClick={copiar}
          aria-label="Copiar datos para transferencia"
          className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1 hover:opacity-80"
        >
          <Copy className="h-3.5 w-3.5" /> Copiar
        </button>
      </div>
      {subtitulo && (
        <p className="px-3 pt-2.5 text-xs font-semibold text-muted-foreground">{subtitulo}</p>
      )}
      <p className="px-3 py-2.5 text-sm whitespace-pre-line break-words select-all">{texto}</p>
    </div>
  );
}
