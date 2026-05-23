"use client";

import { useState, useEffect } from "react";
import { Cliente } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { extraerIniciales } from "@/lib/format";

interface DireccionOption {
  id: number;
  Direccion: string;
  Contacto: string;
}

interface ClientSelectorProps {
  selectedClientId: number | null;
  selectedClientName: string;
  selectedDireccionId: number | null;
  direcciones: DireccionOption[];
  onSelectClient: (cliente: Cliente) => void;
  onRemoveClient: () => void;
  onDireccionChange: (id: number | null) => void;
}

export function ClientSelector({
  selectedClientId,
  selectedClientName,
  selectedDireccionId,
  direcciones,
  onSelectClient,
  onRemoveClient,
  onDireccionChange,
}: ClientSelectorProps) {
  const [search, setSearch] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    apiGet<Cliente[]>("/api/clientes")
      .then((data) => {
        // Defensive: endpoint normally returns an array, but guard against a paginated wrapper.
        const arr = Array.isArray(data)
          ? data
          : Array.isArray((data as unknown as { data?: Cliente[] })?.data)
            ? (data as unknown as { data: Cliente[] }).data
            : [];
        setClientes(arr);
      })
      .catch(() => setClientes([]));
  }, []);

  const list = Array.isArray(clientes) ? clientes : [];
  const filtered = search
    ? list.filter((c) => c.Nombre.toLowerCase().includes(search.toLowerCase()))
    : list.slice(0, 10);

  /* ── Client selected ──────────────────────────────────────── */
  if (selectedClientId != null) {
    return (
      <div className="rounded-md bg-white dark:bg-card ring-1 ring-border/50 p-3 space-y-2">
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
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {direcciones.length > 0 && (
          <Select
            value={selectedDireccionId != null ? selectedDireccionId.toString() : "none"}
            onValueChange={(v) => onDireccionChange(v === "none" ? null : Number(v))}
          >
            <SelectTrigger className="text-xs h-8 w-full">
              <SelectValue placeholder="Sin dirección" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin dirección</SelectItem>
              {direcciones.map((d) => (
                <SelectItem key={d.id} value={d.id.toString()}>
                  {d.Direccion} — {d.Contacto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  }

  /* ── No client — search ────────────────────────────────────── */
  return (
    <div className="space-y-2">
      <SearchInput
        placeholder="Buscar cliente..."
        value={search}
        onChange={setSearch}
        debounceMs={200}
      />

      {search && filtered.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description={`No se encontró "${search}"`}
        />
      ) : filtered.length > 0 ? (
        <div className="rounded-md ring-1 ring-border/50 bg-white dark:bg-card overflow-hidden divide-y divide-border max-h-52 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelectClient(c);
                setSearch("");
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-brand-surface/60 transition-colors text-left"
            >
              <div className="h-9 w-9 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-brand-dark">
                  {extraerIniciales(c.Nombre)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{c.Nombre}</div>
                {c.ClienteDireccion && c.ClienteDireccion.length > 0 && (
                  <div className="text-[11px] text-muted-foreground truncate">
                    {c.ClienteDireccion[0]?.Direccion}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
