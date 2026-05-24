"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Producto } from "@/types/database";
import { apiGet } from "@/lib/api-client";

export function useProductos() {
  const [items, setItems] = useState<Producto[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiGet<Producto[]>("/api/productos")
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      search
        ? items.filter((p) => p.Nombre.toLowerCase().includes(search.toLowerCase()))
        : items,
    [search, items]
  );

  /** Add a newly-created product to the local list (eg. quick-create flow). */
  const add = useCallback((product: Producto) => {
    setItems((prev) => [...prev, product]);
  }, []);

  return { items, filtered, search, setSearch, add };
}
