"use client";

import { StickyNote } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { SectionLabel } from "./SectionLabel";

interface NotasSectionProps {
  /** Value currently shown in the textarea (auto-derived or user-edited). */
  concepto: string;
  /** Auto-derived value (used as placeholder when empty). */
  autoDescripcion: string;
  onChange: (value: string) => void;
  /** Called when the user clicks "Restaurar auto" (resets dirty flag). */
  onClear: () => void;
}

export function NotasSection({
  concepto,
  autoDescripcion,
  onChange,
  onClear,
}: NotasSectionProps) {
  const isDirty = concepto !== autoDescripcion && concepto.length > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <SectionLabel icon={<StickyNote className="h-3.5 w-3.5" />}>Notas</SectionLabel>
        {isDirty && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Restaurar auto
          </button>
        )}
      </div>
      <Textarea
        value={concepto}
        onChange={(e) => onChange(e.target.value)}
        placeholder={autoDescripcion || "Resumen automático de productos..."}
        rows={2}
        className="text-sm min-h-14 resize-none rounded-md"
      />
    </div>
  );
}
