"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cliente } from "@/types/database";
import { extraerIniciales } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClienteSelectorSheet } from "@/components/ventas/cliente-selector-sheet";
import { X, Plus, UserPlus, AlertCircle } from "lucide-react";
import { msgDeudaRequiereSeleccionarCliente } from "@/lib/terminologia";
import { DEFAULT_CLIENT_ID, type DireccionOption } from "@/hooks/pos/use-cliente-seleccionado";

// ────────────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────────────

// Valor sentinel del combo cuando no hay dirección elegida.
const VALOR_SIN_DIRECCION = "none";

// Valor sentinel de la última opción del combo. Al seleccionarla, navega
// al formulario de edición del cliente para que pueda crear una dirección.
const VALOR_AGREGAR_DIRECCION = "__agregar__";

// ────────────────────────────────────────────────────────────────────
// Tipos / Props
// ────────────────────────────────────────────────────────────────────

interface ClientSelectorProps {
  selectedClientId: number | null;
  selectedClientName: string;
  selectedDireccionId: number | null;
  direcciones: DireccionOption[];
  onSelectClient: (cliente: Cliente) => void;
  onRemoveClient: () => void;
  onDireccionChange: (id: number | null) => void;
  /** Cuando true (venta con deuda), exige un cliente real (id ≠ 0). */
  requireRealClient?: boolean;
}

/** Aviso cuando la venta con deuda exige un cliente real y aún no hay uno válido. */
function AvisoClienteRequerido() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-destructive mt-1.5">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {msgDeudaRequiereSeleccionarCliente()}
    </p>
  );
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Arma la etiqueta que se ve en el combo para una dirección.
 * Si no hay texto de dirección, muestra el placeholder.
 * Si hay contacto, lo concatena con un guion.
 */
function armarEtiquetaDireccion(direccion: DireccionOption): string {
  const textoDireccion = direccion.Direccion?.trim();
  const textoContacto = direccion.Contacto?.trim();

  let etiqueta: string;
  if (textoDireccion) {
    etiqueta = textoDireccion;
  } else {
    etiqueta = "Sin dirección";
  }

  if (textoContacto) {
    etiqueta = `${etiqueta} — ${textoContacto}`;
  }

  return etiqueta;
}

// ────────────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────────────

export function ClientSelector({
  selectedClientId,
  selectedClientName,
  selectedDireccionId,
  direcciones,
  onSelectClient,
  onRemoveClient,
  onDireccionChange,
  requireRealClient = false,
}: ClientSelectorProps) {
  const router = useRouter();
  // El bottom sheet de búsqueda/creación de clientes.
  const [sheetOpen, setSheetOpen] = useState(false);

  // ¿Falta un cliente real para una venta con deuda?
  const faltaClienteCredito =
    requireRealClient &&
    (selectedClientId === null || selectedClientId === DEFAULT_CLIENT_ID);

  // ─── Bloque 1: si no hay cliente seleccionado → botón que abre el sheet ───
  if (selectedClientId === null) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full flex items-center gap-2.5 rounded-md ring-1 ring-border/50 bg-white dark:bg-card px-3 py-2.5 text-left hover:bg-accent transition-colors"
        >
          <div className="h-9 w-9 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
            <UserPlus className="h-4 w-4 text-brand" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">Seleccionar cliente</span>
        </button>

        {faltaClienteCredito && <AvisoClienteRequerido />}

        <ClienteSelectorSheet open={sheetOpen} onOpenChange={setSheetOpen} onSelect={onSelectClient} />
      </>
    );
  }

  // ─── Bloque 2: si hay cliente seleccionado → card + combo ──

  // Buscamos la direccion actualmente seleccionada (puede ser undefined si
  // selectedDireccionId no matchea ninguna direccion en la lista).
  const direccionSeleccionada = direcciones.find((d) => d.id === selectedDireccionId);

  // Texto a mostrar dentro del trigger del Select (Base UI no resuelve el label
  // del item automaticamente — hay que pasarle el texto via children).
  const textoTriggerDireccion = direccionSeleccionada?.Direccion?.trim() || "Sin dirección";

  // Value del Select: usamos el id como string para que matchee con los SelectItem
  // y se vea el check de "seleccionado" en el dropdown. Si la direccion no tiene
  // texto valido, caemos al placeholder.
  const valorCombo = direccionSeleccionada?.Direccion?.trim()
    ? selectedDireccionId!.toString()
    : VALOR_SIN_DIRECCION;

  // Traduce el value (string) del Select a la acción que corresponda.
  const handleCambioDireccion = (value: string | null) => {
    // Caso a: usuario eligió "Sin dirección" o el Select se limpió.
    if (value === null || value === VALOR_SIN_DIRECCION) {
      onDireccionChange(null);
      return;
    }

    // Caso b: usuario eligió "Agregar dirección…" → navegar al form del cliente.
    if (value === VALOR_AGREGAR_DIRECCION) {
      router.push(`/cliente/datos/${selectedClientId}`);
      return;
    }

    // Caso c: usuario eligió una dirección existente → reportar su id al padre.
    const idDireccion = Number(value);
    onDireccionChange(idDireccion);
  };

  return (
    <>
      <div className="rounded-md bg-white dark:bg-card ring-1 ring-border/50 p-3 space-y-2">
        {/* Cabecera: avatar con iniciales + nombre + botones de acción */}
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-brand-dark">
              {extraerIniciales(selectedClientName)}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{selectedClientName}</div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* "Cambiar" abre el sheet para elegir otro cliente; "X" deselecciona */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="text-xs font-semibold text-brand hover:text-brand-dark transition-colors"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={onRemoveClient}
              aria-label="Quitar cliente"
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Combo de direcciones del cliente */}
        <Select value={valorCombo} onValueChange={handleCambioDireccion}>
          {/* SelectTrigger es el botón visible que abre el dropdown (requerido por shadcn/ui) */}
          <SelectTrigger className="text-xs h-8 w-full">
            {/* Base UI renderiza el value como texto crudo si no le pasamos children.
                Pasamos el texto explicitamente para que el trigger muestre la direccion. */}
            <SelectValue placeholder="Sin dirección">{textoTriggerDireccion}</SelectValue>
          </SelectTrigger>

          <SelectContent>
            {/* Primera opción: sin dirección */}
            <SelectItem value={VALOR_SIN_DIRECCION}>Sin dirección</SelectItem>

            {/* Opciones del medio: las direcciones reales del cliente */}
            {direcciones.map((direccion) => (
              <SelectItem key={direccion.id} value={direccion.id.toString()}>
                {armarEtiquetaDireccion(direccion)}
              </SelectItem>
            ))}

            {/* Última opción: agregar nueva (lleva al formulario del cliente) */}
            <SelectItem value={VALOR_AGREGAR_DIRECCION} className="text-brand font-semibold">
              <span className="inline-flex items-center gap-1">
                <Plus className="h-3 w-3" /> Agregar dirección…
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {faltaClienteCredito && <AvisoClienteRequerido />}

      <ClienteSelectorSheet open={sheetOpen} onOpenChange={setSheetOpen} onSelect={onSelectClient} />
    </>
  );
}
