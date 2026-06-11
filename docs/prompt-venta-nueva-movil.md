# Prompt Claude Code — `/venta/nueva_movil` Wizard POS Móvil de 3 Pasos

## Tarea

Crear la ruta `/venta/nueva_movil` como un wizard POS de 3 pasos diseñado específicamente para uso móvil. No modifica ningún componente existente — solo agrega archivos nuevos y un ajuste menor en `app-shell.tsx`.

---

## Contexto del proyecto

- **Framework:** Next.js 16 App Router + TypeScript
- **UI:** shadcn/ui con Base UI (NO Radix) — **NUNCA usar `asChild`**
- **Estilos:** Tailwind CSS con variables CSS del proyecto (`bg-brand`, `text-brand-dark`, `bg-page-bg`, `ring-border/50`, `bg-brand-surface`, `text-muted-foreground`)
- **Estado:** Zustand (`@/stores/app-store`)
- **Animaciones:** `framer-motion` (ya instalado)
- **Datos:** SOLO por API routes (`/api/*`), nunca Supabase directo desde cliente
- **Columnas:** PascalCase (`IdCliente`, `bCredito`, `FechaEmision`, `IdTenant`, etc.)
- **Idioma UI:** español (es-ES)
- **Formateo moneda:** `numToString()` de `@/lib/format`
- **Íconos:** `lucide-react`

---

## Lectura obligatoria ANTES de escribir código

Lee estos archivos en orden. Son la base de toda la implementación:

1. `node_modules/next/dist/docs/` — verificar cualquier API de Next.js que uses
2. `src/hooks/use-pos-transaction.ts` — hook principal de estado POS (entender, NO reutilizar)
3. `src/hooks/pos/use-basket.ts` — tipo `BasketItemLocal`, lógica de canasta
4. `src/hooks/pos/use-cliente-seleccionado.ts` — `DEFAULT_CLIENT_ID`, `DireccionOption`
5. `src/hooks/use-guardar.ts` — patrón de guardado con spinner
6. `src/types/database.ts` — tipos `Producto`, `Documento`, `DocumentoItem`, `Cliente`, `MetodoPago`, `Categoria`
7. `src/lib/format.ts` — `numToString`, `cantidadString`, `formatN2`, `parseFormatted`
8. `src/components/ventas/pos/PosShell.tsx` — orquestador actual (referencia de arquitectura)
9. `src/components/ventas/pos/ProductSearch.tsx` — grid de productos con categorías (reutilizar diseño)
10. `src/components/ventas/pos/CartSummary.tsx` — panel de carrito (referencia de subcomponentes)
11. `src/components/ventas/pos/ClientSelector.tsx` — selector de cliente con direcciones (reutilizar)
12. `src/components/ventas/pos/cart/FormaVentaToggle.tsx` — toggle Contado/Crédito (reutilizar)
13. `src/components/ventas/pos/cart/FormaPagoChips.tsx` — chips método de pago (reutilizar)
14. `src/components/ventas/pos/cart/FechaSection.tsx` — campo fecha (reutilizar)
15. `src/components/ventas/pos/cart/NotasSection.tsx` — campo notas/concepto (reutilizar)
16. `src/components/ventas/pos/cart/SectionLabel.tsx` — label reutilizable (reutilizar)
17. `src/components/ventas/pos/cart/CartItemsList.tsx` — lista de items con edición inline (reutilizar)
18. `src/components/ventas/pos/CartItemEditSheet.tsx` — sheet editor de cantidad/precio (reutilizar)

---

## Archivos a crear

### `src/app/venta/nueva_movil/page.tsx`

Página mínima — solo importa y renderiza el wizard:

```typescript
import { VentaMovilWizard } from "@/components/ventas/pos-movil/VentaMovilWizard";

export default function VentaNuevaMovilPage() {
  return <VentaMovilWizard />;
}
```

---

### `src/components/ventas/pos-movil/VentaMovilWizard.tsx`

Componente `"use client"` principal. Orquesta los 3 pasos.

#### Tipo del wizard

```typescript
type WizardStep = "seleccionar" | "confirmar" | "crear";
```

#### Estado local (NO usar `usePosTransaction`)

```typescript
// Productos
const [productos, setProductos] = useState<Producto[]>([]);
const [categorias, setCategorias] = useState<Categoria[]>([]);
const [search, setSearch] = useState("");
const [catFilter, setCatFilter] = useState<number | null>(null);

// Canasta
const [basket, setBasket] = useState<BasketItemLocal[]>([]);

// Wizard
const [step, setStep] = useState<WizardStep>("seleccionar");
const [loading, setLoading] = useState(true);

// Flag para carga lazy del paso 3
const [hasLoadedStep3, setHasLoadedStep3] = useState(false);

// Paso 3 — carga lazy
const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null);
const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
const [isCredit, setIsCredit] = useState(false);
const [selectedIdMetodoPago, setSelectedIdMetodoPago] = useState<number | null>(null);
const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
const [selectedClientName, setSelectedClientName] = useState("");
const [selectedDireccionId, setSelectedDireccionId] = useState<number | null>(null);
const [direcciones, setDirecciones] = useState<DireccionOption[]>([]);
const [concepto, setConcepto] = useState("");
```

#### Carga inicial (al montar)

```typescript
useEffect(() => {
  async function load() {
    const [prods, cats] = await Promise.all([
      apiGet<Producto[]>("/api/productos"),
      apiGet<Categoria[]>("/api/categorias").catch(() => []),
    ]);
    setProductos(prods.filter(p => p.Estado === 1));
    setCategorias(cats);
    setLoading(false);
  }
  load();
}, []);
```

#### Carga lazy paso 3

```typescript
useEffect(() => {
  if (step !== "crear" || hasLoadedStep3) return;
  async function loadStep3() {
    const [metodos, caja] = await Promise.all([
      apiGet<MetodoPago[]>("/api/metodos-pago").catch(() => []),
      apiGet("/api/caja").catch(() => null),
    ]);
    setMetodosPago(metodos);
    setCajaAbierta(caja !== null);
    setHasLoadedStep3(true);
  }
  loadStep3();
}, [step, hasLoadedStep3]);
```

#### Lógica de canasta

```typescript
const total = basket.reduce((sum, i) => sum + i.Cantidad * i.PrecioVenta, 0);

const addToBasket = (producto: Producto) => {
  setBasket(prev => {
    const existing = prev.find(i => i.IdProducto === producto.id);
    if (existing) {
      return prev.map(i =>
        i.IdProducto === producto.id
          ? { ...i, Cantidad: i.Cantidad + 1 }
          : i
      );
    }
    return [...prev, {
      _tempId: crypto.randomUUID(),
      IdProducto: producto.id,
      Descripcion: producto.Nombre,
      Cantidad: 1,
      PrecioVenta: producto.PrecioVenta,
    } as BasketItemLocal];
  });
};

const removeFromBasket = (tempId: string) =>
  setBasket(prev => prev.filter(i => i._tempId !== tempId));

const updateQuantity = (tempId: string, delta: number) =>
  setBasket(prev => prev.map(i =>
    i._tempId === tempId
      ? { ...i, Cantidad: Math.max(1, i.Cantidad + delta) }
      : i
  ));

const setQuantity = (tempId: string, value: number) =>
  setBasket(prev => prev.map(i =>
    i._tempId === tempId
      ? { ...i, Cantidad: Math.max(1, value) }
      : i
  ));

const updatePrice = (tempId: string, price: number) =>
  setBasket(prev => prev.map(i =>
    i._tempId === tempId ? { ...i, PrecioVenta: price } : i
  ));
```

#### Productos filtrados

```typescript
const filteredProducts = productos.filter(p => {
  const matchSearch = !search || p.Nombre.toLowerCase().includes(search.toLowerCase());
  const matchCat = catFilter === null || p.IdCategoria === catFilter;
  return matchSearch && matchCat;
});
```

#### `autoDescripcion` para notas

```typescript
const autoDescripcion = basket
  .map(i => i.Descripcion)
  .join(", ")
  .substring(0, 500);
```

#### `canSave`

```typescript
const canSave =
  basket.length > 0 &&
  (!isCredit || selectedClientId !== null) &&
  (isCredit || selectedIdMetodoPago !== null);
```

#### Lógica de guardado (usar `useGuardar`)

```typescript
const { saving, guardar } = useGuardar();

const handleSave = () => guardar(async () => {
  if (cajaAbierta === false) {
    toast.error("Debes abrir caja antes de vender");
    return;
  }
  if (isCredit && !selectedClientId) {
    toast.error("Selecciona un cliente para venta a crédito");
    return;
  }

  const doc = {
    FechaEmision: fecha,
    Total: total,
    bCredito: isCredit,
    Concepto: concepto || autoDescripcion || null,
    IdCliente: selectedClientId || null,
    IdClienteDireccion: selectedDireccionId || null,
    IdTipoDocumento: 1,
    Saldo: isCredit ? total : 0,
    IdMetodoPago: isCredit ? null : selectedIdMetodoPago,
  };

  const items = basket.map(item => ({
    IdProducto: item.IdProducto,
    Descripcion: item.Descripcion,
    Cantidad: item.Cantidad,
    PrecioVenta: item.PrecioVenta,
    Total: item.Cantidad * item.PrecioVenta,
    MontoAbono: 0,
  }));

  const result = await apiPost<{ id: number }>("/api/ventas", { documento: doc, items });
  useAppStore.getState().triggerRefresh();
  toast.success("Venta creada");
  router.push(`/venta-detalle/${result.id}`);
});
```

#### Render condicional por paso

```typescript
if (loading) return <LoadingState variant="skeleton-cards" count={6} />;

return (
  <div className="min-h-screen bg-page-bg">
    {step === "seleccionar" && <PasoSeleccionar ... />}
    {step === "confirmar"   && <PasoConfirmar  ... />}
    {step === "crear"       && <PasoCrear      ... />}
  </div>
);
```

---

### PASO 1 — `PasoSeleccionar`

**Layout:** scroll vertical libre, sticky bottom bar.

**Estructura:**

```
<SearchInput placeholder="Buscar producto..." />
<CategoriaFilter categorias={categorias} value={catFilter} onChange={setCatFilter} />
<grid de productos>
<AnimatePresence> <sticky bottom bar> </AnimatePresence>
```

**Grid de productos:** Copiar EXACTAMENTE el diseño de `ProductSearch.tsx`:
- `grid grid-cols-2 gap-3`
- Card: nombre, badge de stock coloreado (`bg-destructive/10` si ≤0, `bg-warning/10` si ≤5, `bg-success/10` si >5), precio, botón `+` circular con badge de cantidad
- Tocar card completa O botón `+` → `addToBasket(producto)`
- Card "Nuevo producto" dashed al final → abre `ProductQuickCreate`
- `ProductQuickCreate` ya existe en `@/components/ventas/pos/ProductQuickCreate` — reutilizar directamente

**Sticky bottom bar:**

```typescript
// Posición: encima del bottom nav del AppShell
className="fixed bottom-[calc(3.5rem+1rem+env(safe-area-inset-bottom))] left-4 right-4 z-40"
```

Diseño del botón:
```
[🛒] [N producto(s) · Añadir productos] [$TOTAL →]
```

```typescript
className="w-full flex items-center justify-between bg-brand hover:bg-brand-dark text-white rounded-full px-5 py-3 shadow-lg transition-colors"
```

Animación con `framer-motion AnimatePresence`:
```typescript
initial={{ y: 80, opacity: 0 }}
animate={{ y: 0, opacity: 1 }}
exit={{ y: 80, opacity: 0 }}
transition={{ type: "spring", stiffness: 400, damping: 30 }}
```

Visible solo si `basket.length > 0`. Al presionar → `setStep("confirmar")`.

Padding inferior para que el bar no tape contenido: `<div className="h-28" />` al final del grid.

---

### PASO 2 — `PasoConfirmar`

**Header:**
```typescript
<div className="flex items-center gap-2 mb-4">
  <button onClick={() => setStep("seleccionar")} className="...">
    <ChevronLeft className="h-5 w-5" /> Volver
  </button>
  <h2 className="text-[17px] font-bold">Confirmar pedido</h2>
</div>
```

**Contenido:** Reutilizar `CartItemsList` directamente:
```typescript
import { CartItemsList } from "@/components/ventas/pos/cart/CartItemsList";

<CartItemsList
  items={basket}
  onUpdateQuantity={updateQuantity}
  onRemoveItem={removeFromBasket}
  onEditQuantity={(item) => openEditor(item, "cantidad")}
  onEditPrice={(item) => openEditor(item, "precio")}
  onClear={() => setBasket([])}
/>
```

Sheet de edición: reutilizar `CartItemEditSheet` de `@/components/ventas/pos/CartItemEditSheet`.

**Sticky bottom bar:**
```
[N producto(s) · Confirmar] [$TOTAL →]
```

Misma posición y estilo que paso 1. Validación antes de avanzar:
```typescript
if (!basket.every(i => i.Cantidad > 0 && i.PrecioVenta > 0)) {
  toast.error("Verifica cantidades y precios");
  return;
}
setStep("crear");
```

---

### PASO 3 — `PasoCrear`

**Header:**
```typescript
<button onClick={() => setStep("confirmar")}>
  <ChevronLeft /> Volver
</button>
<h2>Datos de la venta</h2>
```

**Resumen compacto** (arriba del formulario, no editable):

```typescript
<div className="rounded-lg ring-1 ring-border/50 bg-white dark:bg-card p-3 space-y-1.5 mb-4">
  {basket.map(item => (
    <div key={item._tempId} className="flex justify-between text-sm">
      <span className="truncate text-muted-foreground">
        {item.Descripcion} × {cantidadString(item.Cantidad)}
      </span>
      <span className="font-semibold tabular-nums shrink-0 ml-2">
        {numToString(item.Cantidad * item.PrecioVenta)}
      </span>
    </div>
  ))}
  <div className="flex justify-between items-baseline pt-1.5 border-t border-border">
    <span className="text-xs text-muted-foreground uppercase tracking-wide">Total</span>
    <span className="text-[22px] font-extrabold text-brand-dark tabular-nums">
      {numToString(total)}
    </span>
  </div>
</div>
```

**Campos del formulario** — usar `SectionLabel` y cards `rounded-lg ring-1 ring-border/50 bg-white dark:bg-card p-3`:

| Campo | Componente a reutilizar | Condición |
|-------|------------------------|-----------|
| Forma de venta | `<FormaVentaToggle>` | Siempre |
| Fecha emisión | `<FechaSection>` | Siempre |
| Forma de pago | `<FormaPagoChips>` | Solo si `!isCredit` |
| Cliente | `<ClientSelector>` | Siempre (`requireRealClient={isCredit}`) |
| Notas | `<NotasSection>` | Siempre |

**Advertencia caja cerrada** (si `cajaAbierta === false`):
```typescript
import { Lock } from "lucide-react";

<div className="rounded-md border bg-warning/10 border-warning/20 p-3 text-xs flex items-center gap-2">
  <Lock className="h-4 w-4 text-warning shrink-0" />
  <span>Debe abrir la caja para registrar ventas.</span>
</div>
```

**Sticky bottom bar — Guardar:**

```typescript
// Mismo patrón que CartBottomBar.tsx
<div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 bg-white/95 dark:bg-card/95 backdrop-blur-sm border-t px-4 py-3 z-30">
  <Button
    className="w-full h-12 text-base font-bold bg-brand hover:bg-brand-dark text-white"
    onClick={handleSave}
    disabled={!canSave || saving}
  >
    {saving ? "Guardando..." : `Guardar venta · ${numToString(total)}`}
  </Button>
</div>
```

Padding inferior: `<div className="pb-28" />` al final del formulario.

---

## Archivos a modificar

### `src/app/app-shell.tsx` — función `getPageTitle`

Agregar esta línea antes del `return` genérico final:

```typescript
if (pathname.startsWith("/venta/nueva_movil")) return "Nueva Venta";
```

---

## Reglas de diseño

- Cards: `rounded-lg ring-1 ring-border/50 bg-white dark:bg-card p-3`
- Botones primarios: `bg-brand hover:bg-brand-dark text-white font-bold`
- Inputs: `h-11 rounded-md`
- Espaciado entre secciones paso 3: `space-y-4`
- Bottom bar sticky siempre encima del nav: `bottom-[calc(3.5rem+1rem+env(safe-area-inset-bottom))]`
- **NUNCA usar `asChild`**
- **NUNCA hablar con Supabase directamente desde el cliente**

---

## Lo que NO debes hacer

- ❌ Crear nuevas API routes (existen: `/api/ventas`, `/api/productos`, `/api/categorias`, `/api/clientes`, `/api/metodos-pago`, `/api/caja`)
- ❌ Modificar hooks existentes (`usePosTransaction`, `use-basket`, etc.)
- ❌ Modificar componentes existentes de `src/components/ventas/pos/`
- ❌ Usar `usePosTransaction` en el wizard (reimplementar solo lo necesario)
- ❌ Usar `asChild`
- ❌ Acceder a Supabase directamente desde el cliente
