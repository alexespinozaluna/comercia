"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { Producto } from "@/types/database";
import { formatNumero } from "@/lib/format";

export interface BasketItemLocal {
  _tempId: string;
  /** Id del DocumentoItem original al editar una venta; undefined/0 = item nuevo.
   *  Imprescindible para que el diff de modificación (toUpdate vs toAdd) reconozca
   *  los items existentes y NO los reinserte (evita duplicar movimientos de stock). */
  id?: number;
  /** null = ítem libre (venta sin producto de catálogo; no toca stock/kardex). */
  IdProducto: number | null;
  Descripcion: string;
  Cantidad: number;
  PrecioVenta: number;
  MontoAbono: number;
}

/** Datos de un ítem libre (descripción/cantidad/precio a mano, sin catálogo). */
export interface ItemLibre {
  Descripcion: string;
  Cantidad: number;
  PrecioVenta: number;
}

/** Build a concepto/descripcion string from basket items: "{Cantidad} {Descripcion} {PrecioVenta}" (sin símbolo de moneda). */
function crearConcepto(items: BasketItemLocal[]): string {
  return items.map((b) => `${b.Cantidad} ${b.Descripcion} ${formatNumero(b.PrecioVenta)}`).join(", ");
}

export function useBasket() {
  const [items, setItems] = useState<BasketItemLocal[]>([]);
  const counterRef = useRef(0);

  const generateTempId = useCallback((productId: number) => {
    return `new-${counterRef.current++}-${productId}`;
  }, []);

  /** Agrega un ítem libre: SIEMPRE crea una línea nueva (nunca fusiona). */
  const addLibre = useCallback((item: ItemLibre) => {
    setItems((prev) => [
      ...prev,
      {
        _tempId: generateTempId(0),
        IdProducto: null,
        Descripcion: item.Descripcion,
        Cantidad: item.Cantidad,
        PrecioVenta: item.PrecioVenta,
        MontoAbono: 0,
      },
    ]);
  }, [generateTempId]);

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

  /** Cambia la descripción de una línea (solo aplica a ítems libres). */
  const updateDescripcion = useCallback((tempId: string, descripcion: string) => {
    setItems((prev) =>
      prev.map((b) => (b._tempId === tempId ? { ...b, Descripcion: descripcion } : b))
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
    addLibre,
    remove,
    updateQuantity,
    setQuantity,
    updatePrice,
    updateDescripcion,
    hydrate,
  };
}
