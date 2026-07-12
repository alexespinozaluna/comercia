"use client";

import { useState } from "react";
import { numToString } from "@/lib/format";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Nodo del desglose. Si trae `children`, la fila es expandible (colapsable);
 * si no, es una hoja. Soporta anidación arbitraria:
 *   "Por tipo"    → profundidad 1 (tipo → métodos hoja)
 *   "Por usuario" → profundidad 2 (usuario → tipos → métodos hoja)
 */
export interface ReportNode {
  label: string;
  count: number;
  total: number;
  children?: ReportNode[];
}

interface CollapsibleReportCardProps {
  /** Título del header (tipo o usuario). */
  title: string;
  /** Conteo del header (documentos). */
  count: number;
  /** Monto destacado del header (Σ total, o balance). */
  amount: number;
  /** Filas del desglose (pueden ser anidadas). */
  nodes: ReportNode[];
}

// Sangría por nivel (rem) para leer la jerarquía.
function indent(depth: number): React.CSSProperties {
  return { paddingLeft: `${0.75 + depth * 1}rem` };
}

/** Fila de desglose recursiva: hoja o botón colapsable con hijos anidados. */
function NodeRow({ node, depth }: { node: ReportNode; depth: number }) {
  const [open, setOpen] = useState(false);
  const hasChildren = !!node.children?.length;

  if (!hasChildren) {
    return (
      <div className="flex items-center justify-between py-2 pr-3 text-sm" style={indent(depth)}>
        <span className="text-muted-foreground">
          {node.label}
          <span className="ml-1.5 text-xs text-muted-foreground/70 tabular-nums">({node.count})</span>
        </span>
        <span className="tabular-nums font-medium">{numToString(node.total)}</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between py-2 pr-3 text-sm hover:bg-accent/30 transition-colors"
        style={indent(depth)}
      >
        <span className="font-medium">
          {node.label}
          <span className="ml-1.5 text-xs text-muted-foreground/70 tabular-nums">({node.count})</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums font-semibold">{numToString(node.total)}</span>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </span>
      </button>
      {open && (
        <div className="divide-y divide-border/60">
          {node.children!.map((c) => (
            <NodeRow key={c.label} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Card colapsable genérica del reporte: header `Título (count) · monto` con
 * chevron; al expandir muestra las filas (anidadas o no). La usan "Por tipo"
 * y "Por usuario". Colapsada por defecto (en todos los niveles).
 */
export function CollapsibleReportCard({ title, count, amount, nodes }: CollapsibleReportCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg ring-1 bg-white dark:bg-card ring-border/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-accent/40 transition-colors"
      >
        <span className="text-sm font-bold truncate">
          {title}
          <span className="ml-1.5 text-xs font-medium text-muted-foreground/70 tabular-nums">
            ({count})
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold tabular-nums">{numToString(amount)}</span>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </span>
      </button>

      {open && (
        <div className="divide-y divide-border/60 border-t border-border">
          {nodes.map((c) => (
            <NodeRow key={c.label} node={c} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}
