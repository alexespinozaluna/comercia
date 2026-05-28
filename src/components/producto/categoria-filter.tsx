"use client";

import { Categoria } from "@/types/database";
import { cn } from "@/lib/utils";

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ring-1",
        active
          ? "bg-brand text-white ring-brand"
          : "bg-white dark:bg-card text-muted-foreground ring-border hover:ring-brand/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

interface CategoriaFilterProps {
  categorias: Categoria[];
  /** null = TODOS; un número = filtrar por esa categoría (0 = Sin categoría). */
  value: number | null;
  onChange: (id: number | null) => void;
  className?: string;
}

/** Barra de chips para filtrar por categoría. Reutilizada en inventario y POS. */
export function CategoriaFilter({ categorias, value, onChange, className }: CategoriaFilterProps) {
  if (categorias.length === 0) return null;
  return (
    <div className={cn("flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5", className)}>
      <Chip label="Todos" active={value == null} onClick={() => onChange(null)} />
      {categorias.map((c) => (
        <Chip
          key={c.id}
          label={c.Nombre}
          active={value === c.id}
          onClick={() => onChange(c.id)}
        />
      ))}
    </div>
  );
}
