"use client";

import { useState, useCallback } from "react";

/**
 * Concepto editor state: starts auto-derived from the basket;
 * once the user types, it becomes "dirty" and overrides the auto value.
 */
export function useConcepto(autoDescripcion: string) {
  const [manual, setManual] = useState("");
  const [dirty, setDirty] = useState(false);

  const handleChange = useCallback((value: string) => {
    setManual(value);
    setDirty(value.length > 0);
  }, []);

  const clear = useCallback(() => {
    setManual("");
    setDirty(false);
  }, []);

  const hydrate = useCallback((value: string | null | undefined) => {
    if (value) {
      setManual(value);
      setDirty(true);
    } else {
      setManual("");
      setDirty(false);
    }
  }, []);

  const value = dirty ? manual : autoDescripcion;

  return { value, dirty, handleChange, clear, hydrate };
}
