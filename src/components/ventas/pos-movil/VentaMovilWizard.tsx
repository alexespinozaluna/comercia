"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Producto, Categoria, Documento } from "@/types/database";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { toInputDate, nowIso } from "@/lib/format";
import { TipoDoc } from "@/lib/tipo-documento";
import { msgDeudaRequiereCliente } from "@/lib/terminologia";
import { useAppStore } from "@/stores/app-store";
import { useBasket, sufijoDescuento } from "@/hooks/pos/use-basket";
import { useDescuento } from "@/hooks/pos/use-descuento";
import { useMetodoPago } from "@/hooks/pos/use-metodo-pago";
import {
  useClienteSeleccionado,
  DEFAULT_CLIENT_ID,
} from "@/hooks/pos/use-cliente-seleccionado";
import { useCajaGuard } from "@/hooks/pos/use-caja-guard";
import { useConcepto } from "@/hooks/pos/use-concepto";
import { useVentaEdicion } from "@/hooks/pos/use-venta-edicion";
import { useGuardar } from "@/hooks/use-guardar";
import { LoadingState } from "@/components/shared/loading-state";
import { ProductQuickCreate } from "@/components/ventas/pos/ProductQuickCreate";
import { PasoSeleccionar } from "./PasoSeleccionar";
import { PasoConfirmar } from "./PasoConfirmar";
import { PasoCrear } from "./PasoCrear";

type WizardStep = "seleccionar" | "confirmar" | "crear";

interface VentaMovilWizardProps {
  /** Id de la venta a editar; 0/ausente = crear una nueva. */
  idVenta?: number;
}

/**
 * Wizard POS móvil de 3 pasos: Seleccionar → Confirmar → Crear.
 * Reutiliza los hooks chicos del POS (useBasket, useMetodoPago,
 * useClienteSeleccionado, useCajaGuard, useConcepto) sin tocarlos; solo el
 * fetch de productos es local porque useProductos no expone `loading` y aquí
 * se necesita el skeleton inicial.
 * Con `idVenta` entra en modo edición: useVentaEdicion (compartido con el
 * POS desktop) carga/valida/hidrata, se aterriza en el paso Confirmar y el
 * guardado es PUT con originalItemIds (diff que preserva kardex).
 */
export function VentaMovilWizard({ idVenta = 0 }: VentaMovilWizardProps) {
  const router = useRouter();
  const isEdit = idVenta > 0;
  const [step, setStep] = useState<WizardStep>(isEdit ? "confirmar" : "seleccionar");

  // Productos / categorías
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const basket = useBasket();
  // Descuento global sobre el bruto de la canasta (subtotal = basket.total).
  const descuento = useDescuento(basket.total);
  const metodo = useMetodoPago();
  // loadDefault solo guarda el cliente común como fallback de guardado;
  // el selector arranca vacío (también al editar una venta del cliente común).
  const cliente = useClienteSeleccionado({ loadDefault: true });
  const caja = useCajaGuard();
  // Descripción autogenerada + sufijo de descuento ("..., Descto -5.00").
  const autoDescripcion = basket.autoDescripcion + sufijoDescuento(descuento.montoDescuento);
  const concepto = useConcepto(autoDescripcion);
  const { saving, guardar } = useGuardar();

  const [fecha, setFecha] = useState(toInputDate());
  const [isCredit, setIsCredit] = useState(false);

  // Carga + elegibilidad + hidratación al editar (compartido con el POS desktop)
  const edicion = useVentaEdicion({
    id: idVenta,
    basket,
    cliente,
    metodo,
    concepto,
    onFecha: setFecha,
    onIsCredit: setIsCredit,
    onDescuento: descuento.hydrate,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [prods, cats] = await Promise.all([
        apiGet<Producto[]>("/api/productos?activos=1").catch(() => [] as Producto[]),
        apiGet<Categoria[]>("/api/categorias").catch(() => [] as Categoria[]),
      ]);
      if (cancelled) return;
      setProductos(prods);
      setCategorias(cats);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Si la canasta queda vacía en los pasos 2/3, volver al paso 1.
  // (No mientras hidrata la edición: la canasta aún está vacía y el wizard
  // arranca en Confirmar — sin el guard rebotaría al paso 1.)
  useEffect(() => {
    if (edicion.loading) return;
    if (basket.items.length === 0 && step !== "seleccionar") {
      setStep("seleccionar");
    }
  }, [basket.items.length, step, edicion.loading]);

  const filteredProducts = useMemo(
    () =>
      productos.filter((p) => {
        const matchSearch =
          !search || p.Nombre.toLowerCase().includes(search.toLowerCase());
        const matchCat = catFilter == null || p.IdCategoria === catFilter;
        return matchSearch && matchCat;
      }),
    [productos, search, catFilter],
  );

  const canSave =
    basket.items.length > 0 &&
    (!isCredit || (cliente.id != null && cliente.id !== DEFAULT_CLIENT_ID)) &&
    (isCredit || metodo.selectedId != null);

  const irACrear = () => {
    if (!basket.items.every((i) => i.Cantidad > 0 && i.PrecioVenta > 0)) {
      toast.error("Verifica cantidades y precios");
      return;
    }
    setStep("crear");
  };

  const handleSave = () =>
    guardar(async () => {
      if (basket.items.length === 0) {
        toast.error("Agrega al menos un producto");
        return;
      }
      if (caja.isOpen === false) {
        toast.error("Debes abrir caja antes de vender");
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
        // Mismo payload plano que el flujo desktop (use-pos-transaction):
        // el API exige Descripcion cuando hay items y arma DocumentoItem.
        const documento: Documento = {
          id: isEdit ? idVenta : 0,
          Estado: 1,
          IdTenant: 0,
          FechaCreacion: nowIso(),
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
            id: b.id ?? 0,
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
          // En deuda no aplica forma de pago.
          IdMetodoPago: isCredit ? null : metodo.selectedId,
          IdCaja: null, // backend lo setea al crear
        };

        if (isEdit) {
          // originalItemIds: base del diff UPDATE-vs-INSERT (no duplica kardex)
          await apiPut(`/api/ventas/${idVenta}`, {
            ...documento,
            originalItemIds: edicion.originalItemIds,
          });
          useAppStore.getState().triggerRefresh();
          toast.success("Venta modificada");
          router.push(`/venta-detalle/${idVenta}`);
        } else {
          const created = await apiPost<Documento>("/api/ventas", documento);
          useAppStore.getState().triggerRefresh();
          toast.success("Venta creada");
          router.push(`/venta-detalle/${created.id}`);
        }
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Error al guardar la venta");
      }
    });

  if (loading || edicion.loading) {
    return <LoadingState variant="skeleton-cards" count={6} />;
  }

  if (edicion.redirecting) {
    return null;
  }

  return (
    <div className="max-w-lg mx-auto">
      {step === "seleccionar" && (
        <PasoSeleccionar
          products={filteredProducts}
          search={search}
          onSearchChange={setSearch}
          categorias={categorias}
          catFilter={catFilter}
          onCatFilterChange={setCatFilter}
          basket={basket.items}
          total={basket.total}
          onAddProduct={basket.add}
          onQuickCreate={() => setQuickCreateOpen(true)}
          onNext={() => setStep("confirmar")}
        />
      )}

      {step === "confirmar" && (
        <PasoConfirmar
          items={basket.items}
          subtotal={basket.total}
          total={descuento.total}
          montoDescuento={descuento.montoDescuento}
          descuentoModo={descuento.modo}
          descuentoValor={descuento.valor}
          onDescuentoModoChange={descuento.setModo}
          onDescuentoValorChange={descuento.setValor}
          onUpdateQuantity={basket.updateQuantity}
          onSetQuantity={basket.setQuantity}
          onUpdatePrice={basket.updatePrice}
          onRemoveItem={basket.remove}
          onClear={() => basket.hydrate([])}
          onBack={() => setStep("seleccionar")}
          onNext={irACrear}
        />
      )}

      {step === "crear" && (
        <PasoCrear
          items={basket.items}
          subtotal={basket.total}
          montoDescuento={descuento.montoDescuento}
          total={descuento.total}
          fecha={fecha}
          onFechaChange={setFecha}
          isCredit={isCredit}
          onIsCreditChange={setIsCredit}
          metodosPago={metodo.list}
          selectedIdMetodoPago={metodo.selectedId}
          onIdMetodoPagoChange={metodo.setSelectedId}
          selectedClientId={cliente.id}
          selectedClientName={cliente.nombre}
          selectedDireccionId={cliente.direccionId}
          direcciones={cliente.direcciones}
          onSelectClient={cliente.select}
          onRemoveClient={cliente.remove}
          onDireccionChange={cliente.setDireccionId}
          concepto={concepto.value}
          autoDescripcion={autoDescripcion}
          onConceptoChange={concepto.handleChange}
          onClearConcepto={concepto.clear}
          cajaAbierta={caja.isOpen}
          canSave={canSave}
          saving={saving}
          isEdit={isEdit}
          onSave={handleSave}
          onBack={() => setStep("confirmar")}
        />
      )}

      <ProductQuickCreate
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        onProductCreated={(p) => setProductos((prev) => [...prev, p])}
      />
    </div>
  );
}
