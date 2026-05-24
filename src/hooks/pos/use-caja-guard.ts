"use client";

import { useState, useEffect } from "react";
import { Caja } from "@/types/database";
import { apiGet } from "@/lib/api-client";

/**
 * Loads the current open Caja. While loading, `isOpen` is null (tri-state).
 * Once resolved, it's `true` if a caja is open, `false` otherwise.
 */
export function useCajaGuard() {
  const [caja, setCaja] = useState<Caja | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    apiGet<Caja | null>("/api/caja")
      .then((data) => {
        if (!cancelled) setCaja(data);
      })
      .catch(() => {
        if (!cancelled) setCaja(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isOpen: boolean | null = caja === undefined ? null : caja !== null;

  return { caja, isOpen };
}
