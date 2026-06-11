"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Documento, Cliente } from "@/types/database";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { toInputDate } from "@/lib/format";
import { TipoDoc } from "@/lib/tipo-documento";
import { useAppStore } from "@/stores/app-store";
import { toast } from "sonner";
import { useBasket } from "./pos/use-basket";
import { useClienteSeleccionado, DEFAULT_CLIENT_ID } from "./pos/use-cliente-seleccionado";
import { useMetodoPago } from "./pos/use-metodo-pago";
import { useCajaGuard } from "./pos/use-caja-guard";
import { useProductos } from "./pos/use-productos";
import { useConcepto } from "./pos/use-concepto";

export type { BasketItemLocal } from "./pos/use-basket";

/**
 * POS transaction hook — composes focused sub-hooks (basket, cliente, metodo de pago,
 * caja guard, productos, concepto) and adds the load-from-id + save coordination.
 */
export function usePosTransaction(params: Promise<{ id: string }>) {
  const router = useRouter();

  const [id, setId] = useState<number>(0);
  const [isEdit, setIsEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  // Form state
  const [fecha, setFecha] = useState(toInputDate());
  const [isCredit, setIsCredit] = useState(false);
  // Ids de los DocumentoItem que tenia la venta al cargarse — base del diff de modificacion
  const [originalItemIds, setOriginalItemIds] = useState<number[]>([]);

  // Sub-hooks
  const basket = useBasket();
  const cliente = useClienteSeleccionado({ loadDefault: !isEdit });
  const metodo = useMetodoPago();
  const cajaGuard = useCajaGuard();
  const productos = useProductos();
  const concepto = useConcepto(basket.autoDescripcion);

  // Resolve route params
  useEffect(() => {
    params.then((p) => {
      const parsedId = parseInt(p.id);
      setId(parsedId);
      setIsEdit(parsedId > 0);
    });
  }, [params]);

  // Redirect when sale is not editable
  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  // Load existing venta when in edit mode (params already resolved)
  useEffect(() => {
    if (id === undefined) return;
    if (!isEdit || id <= 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const venta = await apiGet<Documento | null>(`/api/ventas/${id}`);
        if (cancelled) return;
        if (!venta) {
          toast.error("Venta no encontrada");
          setRedirectTo("/");
          return;
        }
        if (venta.Estado === 0) {
          toast.error("Esta venta fue eliminada");
          setRedirectTo(`/venta-detalle/${id}`);
          return;
        }
        if (venta.TotalAbono > 0) {
          toast.error("Esta venta ya tiene abonos y no se puede modificar");
          setRedirectTo(`/venta-detalle/${id}`);
          return;
        }

        setFecha(venta.FechaEmision?.split("T")[0] ?? toInputDate());
        setIsCredit(venta.bCredito);
        metodo.setSelectedId(venta.IdMetodoPago);
        concepto.hydrate(venta.Concepto);

        if (venta.IdCliente != null) {
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
            }))
          );
        }
      } catch (err) {
        console.error(err);
        toast.error("Error al cargar datos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally exclude the sub-hook setter refs — they're stable enough,
    // and re-running this on their identity would cause repeated re-fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  // Initial loading is done once caja+productos+metodos finished
  // (the load effect above flips loading=false for the !isEdit path too).
  useEffect(() => {
    if (isEdit) return;
    if (cajaGuard.isOpen !== null && productos.items !== undefined) {
      setLoading(false);
    }
  }, [isEdit, cajaGuard.isOpen, productos.items]);

  // Las ventas a crédito exigen un cliente real (distinto del cliente común id 0).
  const clienteCreditoOk =
    !isCredit || (cliente.id != null && cliente.id !== DEFAULT_CLIENT_ID);
  // Las ventas de contado exigen una forma de pago.
  const metodoPagoOk = isCredit || metodo.selectedId != null;
  const canSave =
    cajaGuard.isOpen === true &&
    basket.items.length > 0 &&
    clienteCreditoOk &&
    metodoPagoOk;

  const handleSave = useCallback(async () => {
    if (basket.items.length === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }
    if (isCredit && (cliente.id == null || cliente.id === DEFAULT_CLIENT_ID)) {
      toast.error("Las ventas a crédito requieren un cliente");
      return;
    }
    if (!isCredit && metodo.selectedId == null) {
      toast.error("Seleccione una forma de pago");
      return;
    }

    try {
      const documento: Documento = {
        id: isEdit ? id : 0,
        Estado: 1,
        IdTenant: 0,
        FechaCreacion: new Date().toISOString(),
        FechaEmision: fecha,
        Descripcion: basket.autoDescripcion || null,
        Concepto: concepto.value || null,
        Total: basket.total,
        bCredito: isCredit,
        IdCliente: cliente.id,
        IdClienteDireccion: cliente.direccionId,
        DireccionEntrega: null,
        DocumentoItem: basket.items.map((b) => ({
          id: b.id ?? 0, // id real al editar (→ UPDATE); 0 para items nuevos (→ INSERT)
          IdProducto: b.IdProducto,
          Descripcion: b.Descripcion,
          Cantidad: b.Cantidad,
          PrecioVenta: b.PrecioVenta,
          MontoAbono: b.MontoAbono,
          Total: b.Cantidad * b.PrecioVenta,
          IdDocumento: 0,
          IdDocumentoRef: null,
        })),
        Cliente: undefined,
        TotalAbono: 0,
        IdTipoDocumento: TipoDoc.VENTA,
        Saldo: isCredit ? basket.total : 0,
        // En crédito no aplica forma de pago (no se muestra ni se exige).
        IdMetodoPago: isCredit ? null : metodo.selectedId,
        IdCaja: null, // backend lo setea al crear
      };

      if (isEdit) {
        await apiPut(`/api/ventas/${id}`, { ...documento, originalItemIds });
        toast.success("Venta modificada");
      } else {
        await apiPost("/api/ventas", documento);
        toast.success("Venta creada");
      }
      useAppStore.getState().triggerRefresh();
      router.push("/");
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar la venta");
    }
  }, [
    basket.items,
    basket.total,
    basket.autoDescripcion,
    isCredit,
    cliente.id,
    cliente.direccionId,
    concepto.value,
    metodo.selectedId,
    fecha,
    isEdit,
    id,
    originalItemIds,
    router,
  ]);

  return {
    // Identity
    id,
    isEdit,
    loading,
    redirectTo,
    // Basket
    basket: basket.items,
    total: basket.total,
    descripcion: basket.autoDescripcion,
    addToBasket: basket.add,
    updateQuantity: basket.updateQuantity,
    setQuantity: basket.setQuantity,
    updatePrice: basket.updatePrice,
    removeFromBasket: basket.remove,
    // Productos
    products: productos.items,
    filteredProducts: productos.filtered,
    search: productos.search,
    setSearch: productos.setSearch,
    categorias: productos.categorias,
    catFilter: productos.catFilter,
    setCatFilter: productos.setCatFilter,
    addProductToList: (p: Parameters<typeof productos.add>[0]) => {
      productos.add(p);
      basket.add(p);
    },
    // Cliente
    selectedClientId: cliente.id,
    selectedClientName: cliente.nombre,
    selectedDireccionId: cliente.direccionId,
    direcciones: cliente.direcciones,
    setSelectedDireccionId: cliente.setDireccionId,
    handleSelectClient: cliente.select,
    removeClient: cliente.remove,
    // Metodo de pago
    metodosPago: metodo.list,
    selectedIdMetodoPago: metodo.selectedId,
    setSelectedIdMetodoPago: metodo.setSelectedId,
    // Caja
    cajaAbierta: cajaGuard.isOpen,
    // Forma de venta + fecha
    fecha,
    setFecha,
    isCredit,
    setIsCredit,
    // Concepto
    concepto: concepto.value,
    handleConceptoChange: concepto.handleChange,
    clearConceptoManual: concepto.clear,
    // Save
    canSave,
    handleSave,
  };
}
