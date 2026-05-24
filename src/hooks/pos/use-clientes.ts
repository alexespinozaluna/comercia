"use client";

import { useState, useEffect } from "react";
import { Cliente } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";

/**
 * Shared cliente list (used by ClientSelector search and elsewhere).
 * Refetches when the global refreshCounter ticks (eg. a new cliente was created).
 */
export function useClientes() {
  const [items, setItems] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshCounter = useAppStore((s) => s.refreshCounter);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGet<Cliente[]>("/api/clientes")
      .then((data) => {
        if (cancelled) return;
        // Defensive: tolerate a {data: [...]} wrapper if a future endpoint paginates.
        const arr = Array.isArray(data)
          ? data
          : Array.isArray((data as unknown as { data?: Cliente[] })?.data)
            ? (data as unknown as { data: Cliente[] }).data
            : [];
        setItems(arr);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshCounter]);

  return { items, loading };
}
