"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getSimbolo, formatMontoInput, parseFormatted } from "@/lib/format";

interface MontoInputProps {
  /** Monto numérico (fuente de verdad del padre). */
  value: number;
  /** Emite el número parseado en cada tecla. */
  onChange: (n: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  ariaLabel?: string;
  id?: string;
}

/**
 * Input de monto: prefijo con el símbolo del negocio (`getSimbolo()`, nunca
 * `$` literal) y formato/parseo según `Negocio.Decimales` + locale. Única
 * fuente del símbolo y del formato editable de montos en toda la app.
 *
 * Mantiene un string local mientras el campo tiene foco para no reformatear
 * (ni saltar el cursor) en cada tecla; al perder foco / cambiar el valor
 * externo, re-sincroniza con el formato canónico.
 */
export function MontoInput({
  value,
  onChange,
  placeholder = "0",
  autoFocus,
  className,
  ariaLabel,
  id,
}: MontoInputProps) {
  const simbolo = getSimbolo();
  const prefixRef = useRef<HTMLSpanElement>(null);
  // Padding inicial estimado por longitud del símbolo (evita flash antes de medir).
  const [padLeft, setPadLeft] = useState(simbolo.length * 9 + 16);
  const [display, setDisplay] = useState(value ? formatMontoInput(value) : "");

  // Ancho real del símbolo → padding-left ($, S/, Bs, US$… de ancho variable).
  useEffect(() => {
    if (prefixRef.current) setPadLeft(prefixRef.current.offsetWidth + 16);
  }, [simbolo]);

  // Re-sincroniza con el valor externo solo si difiere de lo tecleado (reset,
  // cambio de ítem). Si el valor solo refleja lo que acabamos de emitir, no
  // reformatea — así el cursor no salta mientras se escribe.
  useEffect(() => {
    if (parseFormatted(display) !== value) {
      setDisplay(value ? formatMontoInput(value) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <span
        ref={prefixRef}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium pointer-events-none"
      >
        {simbolo}
      </span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={display}
        style={{ paddingLeft: padLeft }}
        onFocus={(e) => e.target.select()}
        onBlur={() => setDisplay(value ? formatMontoInput(value) : "")}
        onChange={(e) => {
          setDisplay(e.target.value);
          onChange(parseFormatted(e.target.value));
        }}
        className={cn("tabular-nums", className)}
      />
    </div>
  );
}
