"use client";

/**
 * Harness de prueba para CartItemDetailSheet — replica el estado del padre
 * (como use-basket) y expone el estado commiteado vía data-testid para que
 * el test E2E pueda verificarlo. Solo accesible en desarrollo.
 */
import { useState } from "react";
import { CartItemDetailSheet } from "@/components/ventas/pos/CartItemDetailSheet";
import { BasketItemLocal } from "@/hooks/pos/use-basket";

export function CartItemHarness() {
  const [item, setItem] = useState<BasketItemLocal>({
    _tempId: "1",
    IdProducto: 1,
    Descripcion: "Arroz extra largo Premium 5kg",
    Cantidad: 3,
    PrecioVenta: 1250.75,
    MontoAbono: 0,
  });
  const [open, setOpen] = useState(true);

  return (
    <div className="p-6 space-y-4">
      <div data-testid="committed">{`qty=${item.Cantidad};price=${item.PrecioVenta}`}</div>
      <button data-testid="reopen" onClick={() => setOpen(true)}>
        abrir
      </button>
      <CartItemDetailSheet
        item={item}
        open={open}
        onOpenChange={setOpen}
        onUpdateQuantity={(_id, d) =>
          setItem((p) => ({ ...p, Cantidad: Math.max(1, p.Cantidad + d) }))
        }
        onSetQuantity={(_id, v) => setItem((p) => ({ ...p, Cantidad: Math.max(1, v) }))}
        onUpdatePrice={(_id, price) => setItem((p) => ({ ...p, PrecioVenta: price }))}
        onRemoveItem={() => {}}
      />
    </div>
  );
}
