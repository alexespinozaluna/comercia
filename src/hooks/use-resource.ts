"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type DependencyList,
  type Dispatch,
  type SetStateAction,
} from "react";

export interface UseResourceResult<T> {
  /** Datos cargados, o `null` mientras no hay resultado todavía. */
  data: T | null;
  /** `true` durante la carga inicial y cada `reload()`. */
  loading: boolean;
  /** Último error de carga (se limpia al recargar), o `null`. */
  error: Error | null;
  /** Vuelve a ejecutar el fetcher (p. ej. tras crear/editar/borrar). */
  reload: () => Promise<void>;
  /** Permite actualización optimista del dato sin recargar. */
  setData: Dispatch<SetStateAction<T | null>>;
}

/**
 * Carga datos de forma declarativa: ejecuta `fetcher` al montar (y cuando
 * cambie alguna `deps`) y expone `{ data, loading, error, reload, setData }`.
 *
 * Reemplaza el patrón repetido de `useState(loading)` + `useEffect(fetch)` +
 * `try/catch/finally` en las páginas. El `fetcher` puede devolver un único
 * recurso o un objeto compuesto (varios `apiGet` en `Promise.all`).
 *
 *   const { data, loading, reload } = useResource(
 *     () => apiGet<Cliente[]>("/api/clientes"),
 *   );
 *
 *   // compuesto + recarga tras mutaciones:
 *   const { data, loading, reload } = useResource(async () => {
 *     const [rows, caja] = await Promise.all([
 *       apiGet<Row[]>("/api/saldo-favor"),
 *       apiGet<Caja | null>("/api/caja").catch(() => null),
 *     ]);
 *     return { rows, caja };
 *   });
 *
 * `fetcher` se lee siempre en su versión más reciente (vía ref), así que no
 * necesita memoizarse; usa `deps` solo para forzar recarga cuando cambie un
 * parámetro (un id de ruta, un filtro, etc.).
 */
export function useResource<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList = [],
): UseResourceResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Mantener el fetcher actual sin que su identidad cambiante reejecute el efecto.
  // Se actualiza en un efecto (no en render) y antes del efecto de carga.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      setData(result);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      console.error(e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    // `deps` controla la recarga por cambios de parámetros del llamador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...deps]);

  return { data, loading, error, reload, setData };
}
