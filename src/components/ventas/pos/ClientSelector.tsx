"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Cliente } from "@/types/database";
import { useClientes } from "@/hooks/pos/use-clientes";
import { extraerIniciales } from "@/lib/format";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import type { DireccionOption } from "@/hooks/pos/use-cliente-seleccionado";

// ────────────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────────────

// Valor sentinel del combo cuando no hay dirección elegida.
const VALOR_SIN_DIRECCION = "none";

// Valor sentinel de la última opción del combo. Al seleccionarla, navega
// al formulario de edición del cliente para que pueda crear una dirección.
const VALOR_AGREGAR_DIRECCION = "__agregar__";

// Cantidad de clientes que se muestran cuando el usuario aún no escribió nada.
const MAX_CLIENTES_SIN_BUSQUEDA = 10;

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
}: ClientSelectorProps) {
  const router = useRouter();

  // ─── Bloque 1: si no hay cliente seleccionado → mostrar buscador ───
  if (selectedClientId === null) {
    return <BuscadorDeClientes onSelectClient={onSelectClient} />;
  }

  // ─── Bloque 2: si hay cliente seleccionado → mostrar card + combo ──

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
          {/* "Cambiar" y "X" hacen lo mismo: deseleccionan el cliente actual */}
          <button
            type="button"
            onClick={onRemoveClient}
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
          <SelectItem
            value={VALOR_AGREGAR_DIRECCION}
            className="text-brand font-semibold"
          >
            <span className="inline-flex items-center gap-1">
              <Plus className="h-3 w-3" /> Agregar dirección…
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Subcomponente local: buscador de clientes
//
// Lo dejo en el mismo archivo porque solo se usa acá y mantiene todo el
// contexto del selector junto. Si en el futuro lo necesita otro lugar,
// se promueve a archivo aparte.
// ────────────────────────────────────────────────────────────────────

function BuscadorDeClientes({
  onSelectClient,
}: {
  onSelectClient: (cliente: Cliente) => void;
}) {
  const { items: clientes } = useClientes();
  const [textoBusqueda, setTextoBusqueda] = useState("");

  // Lista a renderizar:
  // - Si el usuario escribió algo, filtramos por nombre (case-insensitive).
  // - Si no escribió nada, mostramos los primeros N para no llenar la pantalla.
  const clientesAMostrar = useMemo(() => {
    if (textoBusqueda.length > 0) {
      const termino = textoBusqueda.toLowerCase();
      return clientes.filter((c) => c.Nombre.toLowerCase().includes(termino));
    }
    return clientes.slice(0, MAX_CLIENTES_SIN_BUSQUEDA);
  }, [clientes, textoBusqueda]);

  const haySinResultados = textoBusqueda.length > 0 && clientesAMostrar.length === 0;
  const hayResultados = clientesAMostrar.length > 0;

  return (
    <div className="space-y-2">
      <SearchInput
        placeholder="Buscar cliente..."
        value={textoBusqueda}
        onChange={setTextoBusqueda}
        debounceMs={200}
      />

      {haySinResultados && (
        <EmptyState
          title="Sin resultados"
          description={`No se encontró "${textoBusqueda}"`}
        />
      )}

      {hayResultados && (
        <div className="rounded-md ring-1 ring-border/50 bg-white dark:bg-card overflow-hidden divide-y divide-border max-h-52 overflow-y-auto">
          {clientesAMostrar.map((cliente) => {
            const direccionPrincipal = cliente.ClienteDireccion?.[0]?.Direccion;

            return (
              <button
                key={cliente.id}
                type="button"
                onClick={() => {
                  onSelectClient(cliente);
                  setTextoBusqueda("");
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-brand-surface/60 transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-brand-dark">
                    {extraerIniciales(cliente.Nombre)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{cliente.Nombre}</div>
                  {direccionPrincipal && (
                    <div className="text-[11px] text-muted-foreground truncate">
                      {direccionPrincipal}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
