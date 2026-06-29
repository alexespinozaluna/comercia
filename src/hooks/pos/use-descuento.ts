"use client";

import { useState, useCallback, useMemo } from "react";
import { getDecimales } from "@/lib/format";

export type DescuentoModo = "monto" | "pct";

/** Redondea a los decimales del negocio (0 o 2). */
function redondear(value: number, decimales: number): number {
  const f = Math.pow(10, decimales);
  return Math.round(value * f) / f;
}

/**
 * Descuento global de la venta. `subtotal` es el bruto (Σ items). Mantiene el
 * modo (% o monto) y el valor crudo del input, y deriva el MONTO de descuento
 * ya redondeado a Negocio.Decimales y acotado a [0, subtotal]. El neto (`total`)
 * sale de subtotal − montoDescuento.
 */
export function useDescuento(subtotal: number) {
  const [modo, setModo] = useState<DescuentoModo>("monto");
  const [valor, setValor] = useState(0);

  const montoDescuento = useMemo(() => {
    const bruto = modo === "pct" ? (subtotal * valor) / 100 : valor;
    const clamped = Math.min(Math.max(bruto, 0), subtotal);
    return redondear(clamped, getDecimales());
  }, [modo, valor, subtotal]);

  const total = useMemo(() => subtotal - montoDescuento, [subtotal, montoDescuento]);

  /** Hidrata desde una venta existente (solo se conoce el monto guardado). */
  const hydrate = useCallback((monto: number) => {
    setModo("monto");
    setValor(monto ?? 0);
  }, []);

  return { modo, setModo, valor, setValor, montoDescuento, total, hydrate };
}
