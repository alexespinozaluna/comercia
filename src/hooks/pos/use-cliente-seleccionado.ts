"use client";

import { useState, useCallback, useEffect } from "react";
import { Cliente, ClienteDireccion } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";

export interface DireccionOption {
  id: number;
  Direccion: string;
  Contacto: string;
}

export const DEFAULT_CLIENT_ID = 0;
export const DEFAULT_DIRECCION_ID = 0;

function toOption(d: ClienteDireccion): DireccionOption {
  return { id: d.id, Direccion: d.Direccion, Contacto: d.Contacto };
}

/** Pick default direccion: id=0 → principal → first. */
function pickDefaultDireccionId(dirs: ClienteDireccion[]): number | null {
  const def =
    dirs.find((d) => d.id === DEFAULT_DIRECCION_ID) ??
    dirs.find((d) => d.bPrincipal) ??
    dirs[0];
  return def?.id ?? null;
}

interface UseClienteSeleccionadoOpts {
  /** If true, on mount load /api/clientes/0 and pre-select. */
  loadDefault?: boolean;
}

export function useClienteSeleccionado({
  loadDefault = false,
}: UseClienteSeleccionadoOpts = {}) {
  const [id, setId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [direcciones, setDirecciones] = useState<DireccionOption[]>([]);
  const [direccionId, setDireccionId] = useState<number | null>(null);
  const refreshCounter = useAppStore((s) => s.refreshCounter);

  /** Hydrate from a Cliente (used at edit-load or programmatically). */
  const hydrate = useCallback(
    (cliente: Cliente, preferredDireccionId?: number | null) => {
      setId(cliente.id);
      setNombre(cliente.Nombre);
      const dirs = cliente.ClienteDireccion ?? [];
      setDirecciones(dirs.map(toOption));
      if (preferredDireccionId !== undefined) {
        setDireccionId(preferredDireccionId);
      } else {
        setDireccionId(pickDefaultDireccionId(dirs));
      }
    },
    [],
  );

  /** User explicitly picks a cliente from the search list. */
  const select = useCallback((cliente: Cliente) => {
    setId(cliente.id);
    setNombre(cliente.Nombre);
    const dirs = cliente.ClienteDireccion ?? [];
    setDirecciones(dirs.map(toOption));
    setDireccionId(pickDefaultDireccionId(dirs));
  }, []);

  const remove = useCallback(() => {
    setId(null);
    setNombre("");
    setDirecciones([]);
    setDireccionId(null);
  }, []);

  // Load default cliente on mount
  useEffect(() => {
    if (!loadDefault) return;
    let cancelled = false;
    apiGet<Cliente | null>(`/api/clientes/${DEFAULT_CLIENT_ID}`)
      .then((cliente) => {
        if (cancelled || !cliente) return;
        hydrate(cliente);
      })
      .catch(() => {
        /* no default configured */
      });
    return () => {
      cancelled = true;
    };
  }, [loadDefault, hydrate]);

  // Refetch direcciones when refreshCounter ticks (eg. user added a new address)
  useEffect(() => {
    if (refreshCounter === 0 || id == null) return;
    let cancelled = false;
    apiGet<Cliente | null>(`/api/clientes/${id}`)
      .then((cliente) => {
        if (cancelled || !cliente?.ClienteDireccion) return;
        const dirs = cliente.ClienteDireccion;
        setDirecciones(dirs.map(toOption));
        setDireccionId((prev) => {
          if (prev != null && dirs.some((d) => d.id === prev)) return prev;
          return pickDefaultDireccionId(dirs);
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshCounter, id]);

  return {
    id,
    nombre,
    direcciones,
    direccionId,
    setDireccionId,
    hydrate,
    select,
    remove,
  };
}
