"use client";

import { useMemo, useState, useEffect } from "react";
import { SlidersHorizontal, Check, ChevronDown } from "lucide-react";
import { Documento } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Filtros activos sobre la lista de movimientos (no afectan el balance). */
export interface VentaFilter {
  metodoPago: number[];
  usuario: number[];
  cliente: number[];
}

export const EMPTY_FILTER: VentaFilter = { metodoPago: [], usuario: [], cliente: [] };

export function contarFiltros(f: VentaFilter): number {
  return f.metodoPago.length + f.usuario.length + f.cliente.length;
}

/** Aplica los filtros a una venta (OR dentro de cada tipo, AND entre tipos). */
export function pasaFiltro(v: Documento, f: VentaFilter): boolean {
  if (f.metodoPago.length && !f.metodoPago.includes(v.IdMetodoPago ?? -1)) return false;
  if (f.usuario.length && !f.usuario.includes(v.IdUsuarioCreacion ?? -1)) return false;
  if (f.cliente.length && !f.cliente.includes(v.IdCliente ?? -1)) return false;
  return true;
}

interface Opcion {
  id: number;
  label: string;
}

/** Construye opciones distintas presentes en la lista cargada. */
function distinct(
  items: Documento[],
  keyFn: (v: Documento) => number | null | undefined,
  labelFn: (v: Documento) => string | null | undefined,
): Opcion[] {
  const map = new Map<number, string>();
  for (const it of items) {
    const k = keyFn(it);
    if (k == null) continue;
    if (!map.has(k)) map.set(k, labelFn(it) ?? "—");
  }
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

/** Dropdown con checkboxes para tipos con muchos valores (Usuario, Cliente). */
function CheckDropdown({
  opciones,
  selected,
  onToggle,
}: {
  opciones: Opcion[];
  selected: number[];
  onToggle: (id: number) => void;
}) {
  const label =
    selected.length === 0
      ? "Todos"
      : `${selected.length} seleccionado${selected.length > 1 ? "s" : ""}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center justify-between gap-2 h-10 rounded-md border border-border px-3 text-sm",
          "bg-white dark:bg-card transition-colors hover:bg-accent",
          "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand",
        )}
      >
        <span className={selected.length ? "text-foreground font-medium" : "text-muted-foreground"}>
          {label}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-64">
        {opciones.map((op) => (
          <DropdownMenuCheckboxItem
            key={op.id}
            checked={selected.includes(op.id)}
            onCheckedChange={() => onToggle(op.id)}
          >
            {op.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface FilterSheetProps {
  ventas: Documento[];
  value: VentaFilter;
  onChange: (value: VentaFilter) => void;
}

export function FilterSheet({ ventas, value, onChange }: FilterSheetProps) {
  const [open, setOpen] = useState(false);
  // Borrador editable; se sincroniza con el valor real al abrir.
  const [draft, setDraft] = useState<VentaFilter>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const opcMetodoPago = useMemo(
    () => distinct(ventas, (v) => v.IdMetodoPago, (v) => v.MetodoPago?.Nombre),
    [ventas],
  );
  const opcUsuario = useMemo(
    () => distinct(ventas, (v) => v.IdUsuarioCreacion, (v) => v.UsuarioCreacion?.Nombre),
    [ventas],
  );
  const opcCliente = useMemo(
    () => distinct(ventas, (v) => v.IdCliente, (v) => v.Cliente?.Nombre),
    [ventas],
  );

  const activos = contarFiltros(value);
  const sinOpciones =
    opcMetodoPago.length === 0 && opcUsuario.length === 0 && opcCliente.length === 0;

  const toggle = (key: keyof VentaFilter, id: number) => {
    setDraft((prev) => {
      const set = prev[key];
      return {
        ...prev,
        [key]: set.includes(id) ? set.filter((x) => x !== id) : [...set, id],
      };
    });
  };

  const aplicar = () => {
    onChange(draft);
    setOpen(false);
  };

  const limpiar = () => setDraft(EMPTY_FILTER);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10 shrink-0 relative"
        aria-label="Filtrar movimientos"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="h-4 w-4" />
        {activos > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
            {activos}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] rounded-t-xl p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Filtrar movimientos</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {sinOpciones ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No hay valores para filtrar en este periodo.
              </p>
            ) : (
              <>
                {/* Método de pago — chips */}
                {opcMetodoPago.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Método de pago
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {opcMetodoPago.map((op) => {
                        const sel = draft.metodoPago.includes(op.id);
                        return (
                          <button
                            key={op.id}
                            type="button"
                            onClick={() => toggle("metodoPago", op.id)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                              sel
                                ? "bg-brand text-white ring-brand"
                                : "bg-white dark:bg-card text-foreground ring-border hover:bg-accent",
                            )}
                          >
                            {sel && <Check className="h-3 w-3 shrink-0" />}
                            {op.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Usuario — dropdown checkboxes */}
                {opcUsuario.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Usuario
                    </p>
                    <CheckDropdown
                      opciones={opcUsuario}
                      selected={draft.usuario}
                      onToggle={(id) => toggle("usuario", id)}
                    />
                  </div>
                )}

                {/* Cliente — dropdown checkboxes */}
                {opcCliente.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Cliente
                    </p>
                    <CheckDropdown
                      opciones={opcCliente}
                      selected={draft.cliente}
                      onToggle={(id) => toggle("cliente", id)}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <SheetFooter className="flex-row gap-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={limpiar}
              disabled={contarFiltros(draft) === 0}
            >
              Limpiar
            </Button>
            <Button
              type="button"
              className="flex-1 bg-brand hover:bg-brand-dark text-white"
              onClick={aplicar}
            >
              Aplicar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
