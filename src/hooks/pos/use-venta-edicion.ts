"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Documento, Cliente } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { toInputDate } from "@/lib/format";
import { BasketItemLocal } from "./use-basket";
import { DEFAULT_CLIENT_ID } from "./use-cliente-seleccionado";

interface UseVentaEdicionParams {
  /** Id de la venta a editar; 0 = modo creación (el hook no hace nada). */
  id: number;
  basket: { hydrate: (items: BasketItemLocal[]) => void };
  cliente: {
    hydrate: (cliente: Cliente, preferredDireccionId?: number | null) => void;
  };
  metodo: { setSelectedId: (id: number | null) => void };
  concepto: { hydrate: (value: string | null) => void };
  onFecha: (fecha: string) => void;
  onIsCredit: (isCredit: boolean) => void;
}

/**
 * Carga una venta existente para edición: valida elegibilidad (no eliminada,
 * sin abonos), hidrata los sub-hooks del POS y conserva originalItemIds —
 * la base del diff UPDATE-vs-INSERT que evita duplicar movimientos de kardex.
 * Compartido por el POS desktop (use-pos-transaction) y el wizard móvil,
 * para que las reglas de elegibilidad nunca diverjan entre flujos.
 */
export function useVentaEdicion({
  id,
  basket,
  cliente,
  metodo,
  concepto,
  onFecha,
  onIsCredit,
}: UseVentaEdicionParams) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [originalItemIds, setOriginalItemIds] = useState<number[]>([]);

  useEffect(() => {
    if (id <= 0) return;
    let cancelled = false;
    (async () => {
      try {
        const venta = await apiGet<Documento | null>(`/api/ventas/${id}`);
        if (cancelled) return;
        if (!venta) {
          toast.error("Venta no encontrada");
          setRedirecting(true);
          router.replace("/");
          return;
        }
        if (venta.Estado === 0) {
          toast.error("Esta venta fue eliminada");
          setRedirecting(true);
          router.replace(`/venta-detalle/${id}`);
          return;
        }
        if (venta.TotalAbono > 0) {
          toast.error("Esta venta ya tiene abonos y no se puede modificar");
          setRedirecting(true);
          router.replace(`/venta-detalle/${id}`);
          return;
        }

        onFecha(venta.FechaEmision?.split("T")[0] ?? toInputDate());
        onIsCredit(venta.bCredito);
        metodo.setSelectedId(venta.IdMetodoPago);
        concepto.hydrate(venta.Concepto);

        // El cliente común (id 0) no se muestra seleccionado: el selector
        // queda vacío y el guardado lo reasigna como fallback.
        if (venta.IdCliente != null && venta.IdCliente !== DEFAULT_CLIENT_ID) {
          const c = await apiGet<Cliente | null>(`/api/clientes/${venta.IdCliente}`);
          if (!cancelled && c) cliente.hydrate(c, venta.IdClienteDireccion);
        }

        if (venta.DocumentoItem) {
          setOriginalItemIds(venta.DocumentoItem.map((item) => item.id));
          basket.hydrate(
            venta.DocumentoItem.map((item) => ({
              _tempId: `item-${item.id}`,
              id: item.id, // preserva el id real → el diff lo trata como UPDATE, no re-INSERT
              IdProducto: item.IdProducto,
              Descripcion: item.Descripcion,
              Cantidad: item.Cantidad,
              PrecioVenta: item.PrecioVenta,
              MontoAbono: item.MontoAbono,
            })),
          );
        }
      } catch (err) {
        console.error(err);
        toast.error("Error al cargar datos");
      } finally {
        if (!cancelled) setDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Se excluyen a propósito las refs a sub-hooks/callbacks: su identidad
    // cambia por render y re-correr esto repetiría el fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return {
    /** True mientras se carga la venta (false en modo creación). */
    loading: id > 0 && !done,
    /** True si la venta no es editable y ya se navega fuera (render null). */
    redirecting,
    /** Ids de los DocumentoItem al cargar — enviar en el PUT para el diff. */
    originalItemIds,
  };
}
