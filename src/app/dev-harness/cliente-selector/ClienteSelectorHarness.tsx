"use client";

/**
 * Harness de prueba para ClienteSelectorSheet — el test E2E mockea
 * GET /api/clientes (page.route) y verifica el layout móvil del sheet:
 * buscador arriba, lista con scroll interno y botón "Crear nuevo cliente"
 * visible sin scroll. Solo accesible en desarrollo.
 */
import { useState } from "react";
import { Cliente } from "@/types/database";
import { ClienteSelectorSheet } from "@/components/ventas/cliente-selector-sheet";

export function ClienteSelectorHarness() {
  const [open, setOpen] = useState(true);
  const [seleccionado, setSeleccionado] = useState<Cliente | null>(null);

  return (
    <div className="p-6 space-y-4">
      <div data-testid="seleccionado">{seleccionado?.Nombre ?? "ninguno"}</div>
      <button data-testid="reopen" onClick={() => setOpen(true)}>
        abrir
      </button>
      <ClienteSelectorSheet open={open} onOpenChange={setOpen} onSelect={setSeleccionado} />
    </div>
  );
}
