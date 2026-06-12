"use client";

import { useState } from "react";
import { cantidadString } from "@/lib/format";

interface CantidadInputProps {
  value: number;
  /** Se llama solo al confirmar (blur/Enter) con un valor válido (> 0). */
  onCommit: (value: number) => void;
  ariaLabel: string;
}

/**
 * Input inline de cantidad con borrador local: mientras está enfocado el
 * valor vive aquí (permite vaciar o escribir parcial sin que el clamp ≥ 1
 * del basket pelee con el usuario tecla a tecla). Al blur/Enter se confirma;
 * vacío o inválido revierte al valor anterior. Sin foco se muestra el valor
 * de props, así los botones −/+ siguen reflejándose.
 */
export function CantidadInput({ value, onCommit, ariaLabel }: CantidadInputProps) {
  // null = sin foco (modo display); string = borrador en edición.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null) {
      const parsed = parseFloat(draft.replace(",", "."));
      if (!isNaN(parsed) && parsed > 0) onCommit(parsed);
    }
    setDraft(null);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft ?? cantidadString(value)}
      aria-label={ariaLabel}
      onFocus={(e) => {
        setDraft(String(value));
        // select() tras el re-render del borrador, para escribir encima.
        const input = e.target;
        requestAnimationFrame(() => input.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className="w-12 h-7 text-center text-sm font-bold tabular-nums rounded-md bg-transparent ring-1 ring-transparent focus:ring-brand/40 focus:bg-white dark:focus:bg-card focus:outline-none transition-colors"
    />
  );
}
