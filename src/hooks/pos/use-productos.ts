"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Producto, Categoria } from "@/types/database";
import { apiGet } from "@/lib/api-client";

export function useProductos() {
  const [items, setItems] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [search, setSearch] = useState("");
  // null = TODOS; un número = filtrar por esa categoría (0 = Sin categoría)
  const [catFilter, setCatFilter] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<Producto[]>("/api/productos?activos=1")
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    apiGet<Categoria[]>("/api/categorias")
      .then((data) => {
        if (!cancelled) setCategorias(data);
      })
      .catch(() => {
        if (!cancelled) setCategorias([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((p) => {
        const matchSearch =
          !search || p.Nombre.toLowerCase().includes(search.toLowerCase());
        const matchCat = catFilter == null || p.IdCategoria === catFilter;
        return matchSearch && matchCat;
      }),
    [search, catFilter, items],
  );

  /** Add a newly-created product to the local list (eg. quick-create flow). */
  const add = useCallback((product: Producto) => {
    setItems((prev) => [...prev, product]);
  }, []);

  return { items, filtered, search, setSearch, categorias, catFilter, setCatFilter, add };
}
