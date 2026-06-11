"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Envuelve un guardado asíncrono con protección anti doble-submit.
 *
 * `saving` alimenta el `disabled` y la etiqueta del botón; el guard usa un
 * ref porque `setSaving(true)` no es síncrono: dos clics dentro del mismo
 * render pasarían ambos un guard basado solo en estado.
 *
 * Uso:
 *   const { saving, guardar } = useGuardar();
 *   const handleSave = () => guardar(async () => { ... });
 *   <Button onClick={handleSave} disabled={saving}>
 *     {saving ? "Guardando..." : "Guardar"}
 *   </Button>
 *
 * Todo botón de guardar nuevo debe usar este hook (ver
 * docs/analisis-guardado-transaccional-y-hook-saving-2026-06-10.md).
 */
export function useGuardar() {
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const guardar = useCallback(async (fn: () => Promise<void>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await fn();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, []);

  return { saving, guardar };
}
