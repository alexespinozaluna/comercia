"use client";

import { useEffect, useState, useCallback } from "react";
import { Categoria, SIN_CATEGORIA_ID } from "@/types/database";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useGuardar } from "@/hooks/use-guardar";
import { toast } from "sonner";
import { ChevronsUpDown, Check, Pencil, Trash2, Plus, X } from "lucide-react";

interface CategoriaSelectProps {
  value: number;
  onChange: (id: number) => void;
  className?: string;
}

export function CategoriaSelect({ value, onChange, className }: CategoriaSelectProps) {
  const [open, setOpen] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const { saving: busy, guardar } = useGuardar();

  const load = useCallback(async () => {
    try {
      const data = await apiGet<Categoria[]>("/api/categorias");
      setCategorias(data);
    } catch {
      setCategorias([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = categorias.find((c) => c.id === value);

  const handleCrear = () => guardar(async () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    try {
      const nueva = await apiPost<Categoria>("/api/categorias", { Nombre: nombre });
      setNuevoNombre("");
      await load();
      onChange(nueva.id);
      toast.success("Categoría creada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear");
    }
  });

  const handleRenombrar = (id: number) => guardar(async () => {
    const nombre = editNombre.trim();
    if (!nombre) return;
    try {
      await apiPut(`/api/categorias/${id}`, { Nombre: nombre });
      setEditingId(null);
      await load();
      toast.success("Categoría actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al renombrar");
    }
  });

  const handleBorrar = (id: number) => guardar(async () => {
    try {
      await apiDelete(`/api/categorias/${id}`);
      await load();
      if (value === id) onChange(SIN_CATEGORIA_ID);
      toast.success("Categoría borrada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al borrar");
    }
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm",
          className,
        )}
      >
        <span className={cn(!selected && "text-muted-foreground")}>
          {selected?.Nombre ?? "Sin categoría"}
        </span>
        <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-1.5">
        <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
          {categorias.map((c) => {
            const isSentinel = c.id === SIN_CATEGORIA_ID;
            if (editingId === c.id) {
              return (
                <div key={c.id} className="flex items-center gap-1 p-1">
                  <Input
                    autoFocus
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenombrar(c.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-8 text-sm"
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => handleRenombrar(c.id)}>
                    <Check className="h-4 w-4 text-emerald-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            }
            return (
              <div
                key={c.id}
                className="group flex items-center gap-1 rounded-md hover:bg-muted/60"
              >
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm min-w-0"
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4 shrink-0", value === c.id ? "opacity-100 text-brand" : "opacity-0")} />
                  <span className="truncate">{c.Nombre}</span>
                </button>
                {!isSentinel && (
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => { setEditingId(c.id); setEditNombre(c.Nombre); }}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleBorrar(c.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border mt-1 pt-1.5 flex items-center gap-1">
          <Input
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCrear(); }}
            placeholder="Nueva categoría..."
            className="h-8 text-sm"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={handleCrear}
            disabled={!nuevoNombre.trim() || busy}
          >
            <Plus className="h-4 w-4 text-brand" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
