"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Producto, Documento, Cliente, Caja } from "@/types/database";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";
import { toast } from "sonner";

export interface BasketItemLocal {
  _tempId: string;
  IdProducto: number;
  Descripcion: string;
  Cantidad: number;
  PrecioVenta: number;
  MontoAbono: number;
}

let _tempIdCounter = 0;
function generateTempId(productId: number): string {
  return `new-${_tempIdCounter++}-${productId}`;
}

/** Build a concepto/descripcion string from basket items: "{Cantidad} {Descripcion} {PrecioVenta}" */
function crearConcepto(items: BasketItemLocal[]): string {
  return items.map((b) => `${b.Cantidad} ${b.Descripcion} ${b.PrecioVenta}`).join(", ");
}

export function usePosTransaction(params: Promise<{ id: string }>) {
  const router = useRouter();

  const [id, setId] = useState<number>(0);
  const [isEdit, setIsEdit] = useState(false);
  const [products, setProducts] = useState<Producto[]>([]);
  const [search, setSearch] = useState("");
  const [basket, setBasket] = useState<BasketItemLocal[]>([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [isCredit, setIsCredit] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [selectedDireccionId, setSelectedDireccionId] = useState<number | null>(null);
  const [direcciones, setDirecciones] = useState<{ id: number; Direccion: string; Contacto: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [conceptoManual, setConceptoManual] = useState("");
  const [conceptoDirty, setConceptoDirty] = useState(false);

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
    if (redirectTo) {
      router.replace(redirectTo);
    }
  }, [redirectTo, router]);

  // Load initial data
  useEffect(() => {
    async function load() {
      try {
        const caja = await apiGet<Caja | null>("/api/caja");
        setCajaAbierta(!!caja);

        const prods = await apiGet<Producto[]>("/api/productos");
        setProducts(prods);

        if (isEdit && id > 0) {
          const venta = await apiGet<Documento | null>(`/api/ventas/${id}`);
          if (!venta) {
            toast.error("Venta no encontrada");
            setRedirectTo("/");
            return;
          }

          // Protect: redirect to detail if not editable
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

          setFecha(venta.FechaEmision?.split("T")[0] ?? new Date().toISOString().split("T")[0]);
          setIsCredit(venta.bCredito);
          setSelectedClientId(venta.IdCliente);
          setSelectedClientName(venta.Cliente?.Nombre ?? "");
          // Restore concepto: if user had typed a custom one, preserve it as dirty
          if (venta.Concepto) {
            setConceptoManual(venta.Concepto);
            setConceptoDirty(true);
          }
          if (venta.IdCliente != null && venta.IdCliente > 0) {
            const cliente = await apiGet<Cliente | null>(`/api/clientes/${venta.IdCliente}`);
            if (cliente?.ClienteDireccion) {
              setDirecciones(cliente.ClienteDireccion.map((d) => ({ id: d.id, Direccion: d.Direccion, Contacto: d.Contacto })));
            }
            setSelectedDireccionId(venta.IdClienteDireccion);
          }
          if (venta.DocumentoItem) {
            setBasket(
              venta.DocumentoItem.map((item) => ({
                _tempId: `item-${item.id}`,
                IdProducto: item.IdProducto,
                Descripcion: item.Descripcion,
                Cantidad: item.Cantidad,
                PrecioVenta: item.PrecioVenta,
                MontoAbono: item.MontoAbono,
              }))
            );
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Error al cargar datos");
      } finally {
        setLoading(false);
      }
    }
    if (id !== undefined) load();
  }, [id, isEdit]);

  // Load client direcciones when selectedClientId changes (for new sales)
  useEffect(() => {
    if (!isEdit && selectedClientId != null && selectedClientId > 0 && direcciones.length === 0) {
      apiGet<Cliente | null>(`/api/clientes/${selectedClientId}`).then((cliente) => {
        if (cliente?.ClienteDireccion) {
          setDirecciones(cliente.ClienteDireccion.map((d) => ({ id: d.id, Direccion: d.Direccion, Contacto: d.Contacto })));
        }
      });
    }
  }, [selectedClientId, isEdit, direcciones.length]);

  // Derived values
  const filteredProducts = useMemo(
    () => (search ? products.filter((p) => p.Nombre.toLowerCase().includes(search.toLowerCase())) : products),
    [search, products]
  );

  const total = useMemo(() => basket.reduce((sum, b) => sum + b.Cantidad * b.PrecioVenta, 0), [basket]);

  // Descripcion: always auto-generated from basket (not editable)
  const descripcion = useMemo(() => crearConcepto(basket), [basket]);

  // Concepto: user-edited takes priority, otherwise auto-generated
  const concepto = conceptoDirty ? conceptoManual : crearConcepto(basket);

  const canSave = cajaAbierta === true && basket.length > 0;

  // Basket handlers
  const addToBasket = (product: Producto) => {
    setBasket((prev) => {
      const existing = prev.find((b) => b.IdProducto === product.id);
      if (existing) {
        toast.success(`${product.Nombre} × ${existing.Cantidad + 1}`);
        return prev.map((b) => (b._tempId === existing._tempId ? { ...b, Cantidad: b.Cantidad + 1 } : b));
      }
      toast.success(`${product.Nombre} agregado`);
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
  };

  const updateQuantity = (tempId: string, delta: number) => {
    setBasket((prev) =>
      prev.map((b) => {
        if (b._tempId !== tempId) return b;
        return { ...b, Cantidad: Math.max(1, b.Cantidad + delta) };
      })
    );
  };

  const setQuantity = (tempId: string, value: number) => {
    setBasket((prev) =>
      prev.map((b) => {
        if (b._tempId !== tempId) return b;
        return { ...b, Cantidad: Math.max(1, value) };
      })
    );
  };

  const updatePrice = (tempId: string, price: number) => {
    setBasket((prev) => prev.map((b) => (b._tempId === tempId ? { ...b, PrecioVenta: price } : b)));
  };

  const removeFromBasket = (tempId: string) => {
    setBasket((prev) => prev.filter((b) => b._tempId !== tempId));
  };

  // Add a newly created product to the list and basket
  const addProductToList = (product: Producto) => {
    setProducts((prev) => [...prev, product]);
    addToBasket(product);
  };

  const handleSelectClient = (cliente: Cliente) => {
    setSelectedClientId(cliente.id);
    setSelectedClientName(cliente.Nombre);
    if (cliente.ClienteDireccion?.length) {
      setDirecciones(cliente.ClienteDireccion.map((d) => ({ id: d.id, Direccion: d.Direccion, Contacto: d.Contacto })));
      const principal = cliente.ClienteDireccion.find((d) => d.bPrincipal);
      setSelectedDireccionId(principal?.id ?? cliente.ClienteDireccion[0].id);
    } else {
      setDirecciones([]);
      setSelectedDireccionId(null);
    }
  };

  const handleConceptoChange = (value: string) => {
    setConceptoManual(value);
    setConceptoDirty(value.length > 0);
  };

  const clearConceptoManual = () => {
    setConceptoManual("");
    setConceptoDirty(false);
  };

  // Save handler
  const handleSave = async () => {
    if (basket.length === 0) {
      toast.error("Agrega al menos un producto");
      return;
    }
    if (isCredit && selectedClientId == null) {
      toast.error("Las ventas a credito requieren un cliente");
      return;
    }

    try {
      const documento: Documento = {
        id: 0,
        Estado: 1,
        IdTenant: 0,
        FechaCreacion: new Date().toISOString(),
        FechaEmision: fecha,
        Descripcion: descripcion || null,
        Concepto: concepto || null,
        Total: total,
        bCredito: isCredit,
        IdCliente: selectedClientId,
        IdClienteDireccion: selectedDireccionId,
        DireccionEntrega: null,
        DocumentoItem: basket.map((b) => ({
          id: 0,
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
        IdTipoDocumento: 1,
        Saldo: isCredit ? total : 0,
        IdMetodoPago: null,
      };

      if (isEdit) {
        documento.id = id;
        await apiPut(`/api/ventas/${id}`, documento);
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
  };

  // Client handlers
  const removeClient = () => {
    setSelectedClientId(null);
    setSelectedClientName("");
    setSelectedDireccionId(null);
    setDirecciones([]);
  };

  return {
    // State
    id,
    isEdit,
    products,
    search,
    basket,
    fecha,
    isCredit,
    selectedClientId,
    selectedClientName,
    selectedDireccionId,
    direcciones,
    loading,
    cajaAbierta,
    redirectTo,
    // Derived
    filteredProducts,
    total,
    canSave,
    descripcion,
    concepto,
    // Handlers
    setSearch,
    setFecha,
    setIsCredit,
    setSelectedDireccionId,
    addToBasket,
    updateQuantity,
    setQuantity,
    updatePrice,
    removeFromBasket,
    addProductToList,
    handleSelectClient,
    removeClient,
    handleSave,
    handleConceptoChange,
    clearConceptoManual,
  };
}