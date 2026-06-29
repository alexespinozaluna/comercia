"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Documento } from "@/types/database";
import { apiPost, apiPut } from "@/lib/api-client";
import { toInputDate } from "@/lib/format";
import { TipoDoc } from "@/lib/tipo-documento";
import { msgDeudaRequiereCliente } from "@/lib/terminologia";
import { useAppStore } from "@/stores/app-store";
import { toast } from "sonner";
import { useBasket, sufijoDescuento } from "./pos/use-basket";
import { useDescuento } from "./pos/use-descuento";
import { useClienteSeleccionado, DEFAULT_CLIENT_ID } from "./pos/use-cliente-seleccionado";
import { useMetodoPago } from "./pos/use-metodo-pago";
import { useCajaGuard } from "./pos/use-caja-guard";
import { useProductos } from "./pos/use-productos";
import { useConcepto } from "./pos/use-concepto";
import { useVentaEdicion } from "./pos/use-venta-edicion";

export type { BasketItemLocal } from "./pos/use-basket";

/**
 * POS transaction hook — composes focused sub-hooks (basket, cliente, metodo de pago,
 * caja guard, productos, concepto) and adds the load-from-id + save coordination.
 */
export function usePosTransaction(params: Promise<{ id: string }>) {
  const router = useRouter();

  const [id, setId] = useState<number>(0);
  const [isEdit, setIsEdit] = useState(false);
  const [initialReady, setInitialReady] = useState(false);

  // Form state
  const [fecha, setFecha] = useState(toInputDate());
  const [isCredit, setIsCredit] = useState(false);

  // Sub-hooks
  const basket = useBasket();
  // Descuento global sobre el bruto de la canasta (subtotal = basket.total).
  const descuento = useDescuento(basket.total);
  // loadDefault solo guarda el cliente común como fallback de guardado;
  // el selector arranca vacío (también al editar una venta del cliente común).
  const cliente = useClienteSeleccionado({ loadDefault: true });
  const metodo = useMetodoPago();
  const cajaGuard = useCajaGuard();
  const productos = useProductos();
  // Descripción autogenerada + sufijo de descuento ("..., Descto -5.00").
  const autoDescripcion = basket.autoDescripcion + sufijoDescuento(descuento.montoDescuento);
  const concepto = useConcepto(autoDescripcion);

  // Carga + elegibilidad + hidratación al editar (compartido con el wizard móvil)
  const edicion = useVentaEdicion({
    id: isEdit ? id : 0,
    basket,
    cliente,
    metodo,
    concepto,
    onFecha: setFecha,
    onIsCredit: setIsCredit,
    onDescuento: descuento.hydrate,
  });

  // Resolve route params
  useEffect(() => {
    params.then((p) => {
      const parsedId = parseInt(p.id);
      setId(parsedId);
      setIsEdit(parsedId > 0);
    });
  }, [params]);

  // Initial loading is done once caja+productos finished (solo aplica en
  // creación; al editar manda la carga de la venta en useVentaEdicion).
  useEffect(() => {
    if (cajaGuard.isOpen !== null && productos.items !== undefined) {
      setInitialReady(true);
    }
  }, [cajaGuard.isOpen, productos.items]);

  const loading = isEdit ? edicion.loading : !initialReady;

  // Las ventas con deuda exigen un cliente real (distinto del cliente común id 0).
  const clienteCreditoOk =
    !isCredit || (cliente.id != null && cliente.id !== DEFAULT_CLIENT_ID);
  // Las ventas pagadas exigen una forma de pago.
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
      toast.error(msgDeudaRequiereCliente());
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
        Descripcion: autoDescripcion || null,
        Concepto: concepto.value || null,
        // Importe = bruto (Σ items); Total = neto (bruto − descuento).
        Importe: basket.total,
        Descuento: descuento.montoDescuento,
        Total: descuento.total,
        bCredito: isCredit,
        // Sin cliente seleccionado → se asigna el común y su dirección.
        IdCliente: cliente.idEfectivo,
        IdClienteDireccion: cliente.direccionIdEfectiva,
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
        Saldo: isCredit ? descuento.total : 0,
        // En deuda no aplica forma de pago (no se muestra ni se exige).
        IdMetodoPago: isCredit ? null : metodo.selectedId,
        IdCaja: null, // backend lo setea al crear
      };

      if (isEdit) {
        await apiPut(`/api/ventas/${id}`, { ...documento, originalItemIds: edicion.originalItemIds });
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
    autoDescripcion,
    descuento.montoDescuento,
    descuento.total,
    isCredit,
    cliente.id,
    cliente.idEfectivo,
    cliente.direccionIdEfectiva,
    concepto.value,
    metodo.selectedId,
    fecha,
    isEdit,
    id,
    edicion.originalItemIds,
    router,
  ]);

  return {
    // Identity
    id,
    isEdit,
    loading,
    redirecting: edicion.redirecting,
    // Basket
    basket: basket.items,
    subtotal: basket.total,
    total: descuento.total, // neto (lo que muestran las barras y el botón guardar)
    descripcion: autoDescripcion,
    // Descuento
    descuentoModo: descuento.modo,
    setDescuentoModo: descuento.setModo,
    descuentoValor: descuento.valor,
    setDescuentoValor: descuento.setValor,
    montoDescuento: descuento.montoDescuento,
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
