"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { Producto } from "@/types/database";
import { numToString } from "@/lib/format";

export interface BasketItemLocal {
  _tempId: string;
  IdProducto: number;
  Descripcion: string;
  Cantidad: number;
  PrecioVenta: number;
  MontoAbono: number;
}

/** Build a concepto/descripcion string from basket items: "{Cantidad} {Descripcion} {PrecioVenta formateado}" */
function crearConcepto(items: BasketItemLocal[]): string {
  return items.map((b) => `${b.Cantidad} ${b.Descripcion} ${numToString(b.PrecioVenta)}`).join(", ");
}

export function useBasket() {
  const [items, setItems] = useState<BasketItemLocal[]>([]);
  const counterRef = useRef(0);

  const generateTempId = useCallback((productId: number) => {
    return `new-${counterRef.current++}-${productId}`;
  }, []);

  const add = useCallback((product: Producto) => {
    setItems((prev) => {
      const existing = prev.find((b) => b.IdProducto === product.id);
      if (existing) {
        return prev.map((b) =>
          b._tempId === existing._tempId ? { ...b, Cantidad: b.Cantidad + 1 } : b
        );
      }
      return [
        ...prev,
        {
          _tempId: generateTempId(product.id),
          IdProducto: product.id,
          Descripcion: product.Nombre,
          Cantidad: 1,
          PrecioVenta: product.PrecioVenta,
          MontoAbono: 0,
        },
      ];
    });
  }, [generateTempId]);

  const updateQuantity = useCallback((tempId: string, delta: number) => {
    setItems((prev) =>
      prev.map((b) =>
        b._tempId === tempId ? { ...b, Cantidad: Math.max(1, b.Cantidad + delta) } : b
      )
    );
  }, []);

  const setQuantity = useCallback((tempId: string, value: number) => {
    setItems((prev) =>
      prev.map((b) =>
        b._tempId === tempId ? { ...b, Cantidad: Math.max(1, value) } : b
      )
    );
  }, []);

  const updatePrice = useCallback((tempId: string, price: number) => {
    setItems((prev) =>
      prev.map((b) => (b._tempId === tempId ? { ...b, PrecioVenta: price } : b))
    );
  }, []);

  const remove = useCallback((tempId: string) => {
    setItems((prev) => prev.filter((b) => b._tempId !== tempId));
  }, []);

  const hydrate = useCallback((initial: BasketItemLocal[]) => {
    setItems(initial);
  }, []);

  const total = useMemo(
    () => items.reduce((sum, b) => sum + b.Cantidad * b.PrecioVenta, 0),
    [items]
  );

  const autoDescripcion = useMemo(() => crearConcepto(items), [items]);

  return {
    items,
    total,
    autoDescripcion,
    add,
    remove,
    updateQuantity,
    setQuantity,
    updatePrice,
    hydrate,
  };
}
