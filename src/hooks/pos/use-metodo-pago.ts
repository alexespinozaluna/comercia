"use client";

import { useState, useEffect } from "react";
import { MetodoPago } from "@/types/database";
import { apiGet } from "@/lib/api-client";

interface UseMetodoPagoOpts {
  /** When true, pre-select the first metodo de pago after load (default: true). */
  defaultToFirst?: boolean;
}

export function useMetodoPago({ defaultToFirst = true }: UseMetodoPagoOpts = {}) {
  const [list, setList] = useState<MetodoPago[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<MetodoPago[]>("/api/metodo-pago")
      .then((data) => {
        if (cancelled) return;
        setList(data);
        if (defaultToFirst && data.length > 0) {
          // Por defecto, el método marcado como efectivo (bEfectivo); si no hay
          // ninguno, cae al primero de la lista.
          const efectivo = data.find((m) => m.bEfectivo) ?? data[0];
          setSelectedId((prev) => prev ?? efectivo.id);
        }
      })
      .catch(() => {
        if (!cancelled) setList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [defaultToFirst]);

  return { list, selectedId, setSelectedId };
}
