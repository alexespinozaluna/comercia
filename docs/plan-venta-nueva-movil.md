# Plan: Módulo de venta móvil — wizard de 3 pasos

**Fecha:** 2026-06-11
**Base:** [prompt-venta-nueva-movil.md](prompt-venta-nueva-movil.md) (prompt original, auditado contra el código)
**Estado:** ejecutado 2026-06-11 (commit `a090667`). Decisiones tomadas: ruta `/venta/nueva-movil` (kebab-case), acceso solo por URL directa en este ciclo, prompt original intacto. Desviaciones del plan al implementar: (1) la carga lazy del paso 3 se descartó — los hooks `useMetodoPago`/`useCajaGuard` se montan con el wizard porque hacerlos lazy perdería las selecciones al volver atrás o exigiría duplicar su lógica; el costo son dos GET pequeños al montar. (2) `useProductos` no se usó (no expone `loading`, necesario para el skeleton) — fetch local en el wizard, como el fallback previsto en §2. (3) `ProductSearch` se reutilizó completo (su FAB ya trae la animación y el cálculo del bottom nav) en vez de copiar el grid.
**Alcance:** ruta nueva de venta para móvil como wizard de 3 pasos (Seleccionar → Confirmar → Crear), reutilizando los componentes POS existentes sin modificarlos.

---

## 1. Auditoría del prompt: qué está bien y qué corregir

### Verificado correcto ✓

- Los 11 componentes a reutilizar existen con esos nombres y rutas (`ProductSearch`, `CartItemsList`, `CartItemEditSheet`, `ClientSelector`, `FormaVentaToggle`, `FormaPagoChips`, `FechaSection`, `NotasSection`, `SectionLabel`, `ProductQuickCreate`, `CartBottomBar` como referencia).
- `framer-motion` instalado (`^12.38.0`); `useGuardar` existe y es regla de CLAUDE.md; `LoadingState` tiene `skeleton-cards`; `DEFAULT_CLIENT_ID`/`DireccionOption` exportados; clases `bg-warning/10`/`bg-success/10`/`bg-destructive/10` usadas en `ProductSearch`; bottom nav móvil mide `h-14` (3.5rem) → el cálculo del sticky bar es correcto; `Producto.IdCategoria` y `/api/categorias` existen; `canSave` coincide con las validaciones reales.

### Errores del prompt (corregidos en este plan) ✗

| # | Error en el prompt | Realidad verificada |
|---|---|---|
| 1 | `apiPost("/api/ventas", { documento: doc, items })` | El API espera el **documento plano** con `DocumentoItem: items` adentro (ver `use-pos-transaction.ts:162-199`) |
| 2 | El payload omite `Descripcion` | **400 garantizado**: el route la exige cuando hay items (`ventas/route.ts:103`). El flujo real la autogenera (`crearConcepto` de `use-basket`: `"2 Coca Cola 1.500, …"`) |
| 3 | `apiGet("/api/metodos-pago")` | La ruta es **`/api/metodo-pago`** (singular) |
| 4 | `fecha = new Date().toISOString().split("T")[0]` | Viola la regla de fechas de AGENTS.md (de noche adelanta el día) → **`toInputDate()`** |
| 5 | Modificar `src/app/app-shell.tsx` (`getPageTitle`) | El archivo está en `src/components/layout/app-shell.tsx`, y **no hay nada que modificar**: `startsWith("/venta/nueva")` ya cubre la ruta nueva |
| 6 | `addToBasket` arma `BasketItemLocal` sin `MontoAbono` (oculto con `as`) | `MontoAbono: number` es requerido; los items del POST también llevan `id: 0`, `IdDocumento: 0`, `IdDocumentoRef: null` como el flujo actual |
| 7 | Envía `IdTipoDocumento: 1` y `Saldo` desde el cliente | El route los ignora y construye los suyos (`TipoDoc.VENTA`, `Saldo = bCredito ? Total : 0`) — sobran |
| 8 | Reimplementa a mano la canasta, productos, método de pago, cliente y caja | Solo está prohibido `usePosTransaction` (el orquestador). Los hooks chicos (`useBasket`, `useProductos`, `useMetodoPago`, `useClienteSeleccionado`, `useCajaGuard`) son reutilizables **sin modificarlos** y dan gratis la lógica ya corregida (tempIds, `autoDescripcion`, stock, direcciones) |

Decisión de naming: la ruta del prompt es `/venta/nueva_movil` (snake_case). El proyecto usa kebab-case en rutas (`venta-abono`, `venta-gasto`, `deuda-detalle`) → propongo **`/venta/nueva-movil`** (igual cubierta por el título existente).

## 2. Diseño

### Archivos nuevos (no se modifica nada existente)

```
src/app/venta/nueva-movil/page.tsx                      ← mínima, renderiza el wizard
src/components/ventas/pos-movil/VentaMovilWizard.tsx    ← orquestador "use client"
src/components/ventas/pos-movil/PasoSeleccionar.tsx     ← paso 1
src/components/ventas/pos-movil/PasoConfirmar.tsx       ← paso 2
src/components/ventas/pos-movil/PasoCrear.tsx           ← paso 3
src/components/ventas/pos-movil/StickyTotalBar.tsx      ← bottom bar compartida (pasos 1 y 2)
```

### VentaMovilWizard

- `type WizardStep = "seleccionar" | "confirmar" | "crear"` + `useState<WizardStep>`.
- **Composición de hooks existentes** (en vez del estado manual del prompt):
  - `useBasket()` → items, total, add/remove/updateQuantity/setQuantity/updatePrice, `autoDescripcion` (la `Descripcion` requerida por el API).
  - `useProductos()` → productos + categorías + búsqueda/filtro (verificar firma; si acopla cosas de desktop que no aplican, se hace fetch local solo de productos/categorías como en el prompt).
  - `useMetodoPago()` (lazy al entrar al paso 3), `useClienteSeleccionado()`, `useCajaGuard()`.
  - Si alguno de estos hooks resulta acoplado al flujo desktop al implementarlo, fallback: estado local como el prompt, pero con los tipos completos (`MontoAbono: 0`).
- Carga lazy del paso 3 con flag, como propone el prompt (correcto).
- `fecha` con `toInputDate()`.
- Guardado con `useGuardar` + payload **plano** idéntico al de `use-pos-transaction.handleSave` (Descripcion = autoDescripcion, Concepto = notas, items con `id: 0`), `POST /api/ventas`, `triggerRefresh()`, redirect a `/venta-detalle/{id}` (la respuesta es `{data: Documento}` → `result.id` ✓).

### Paso 1 — Seleccionar

Como el prompt: SearchInput + chips de categoría + grid 2 columnas copiando el diseño de `ProductSearch` (badge de stock con los mismos umbrales/clases), card "Nuevo producto" que abre `ProductQuickCreate` (reutilizado). Sticky bar `[🛒 N productos · Añadir] [$TOTAL →]` con `AnimatePresence` (spring 400/30), visible con items, `bottom-[calc(3.5rem+1rem+env(safe-area-inset-bottom))]`, spacer `h-28`.

### Paso 2 — Confirmar

Header con "Volver" → paso 1. `CartItemsList` + `CartItemEditSheet` reutilizados tal cual (las firmas de props coinciden con lo que expone `useBasket`). Validación `Cantidad > 0 && PrecioVenta > 0` antes de avanzar. Sticky bar igual al paso 1.

### Paso 3 — Crear

Resumen compacto no editable (items + total, diseño del prompt ✓). Formulario reutilizando `FormaVentaToggle`, `FechaSection`, `FormaPagoChips` (solo contado), `ClientSelector` (`requireRealClient={isCredit}`, con `onSelectClient`/`direcciones` del hook de cliente), `NotasSection`. Advertencia de caja cerrada (el server igual valida y devuelve 400 — la advertencia es UX). Botón fijo "Guardar venta · $TOTAL" deshabilitado por `!canSave || saving`.

### Formato regional

Sin trabajo extra: `numToString`/`cantidadString` ya leen Locale/Decimales/SimboloMoneda del negocio activo.

## 3. Verificación

- `tsc` + lint + build.
- Manual (móvil): flujo completo contado y crédito (crédito sin cliente → bloqueado), edición de cantidad/precio en paso 2, creación rápida de producto en paso 1, caja cerrada → advertencia + error del server, redirect al detalle.

## 4. Pendientes / próximas decisiones

1. ¿Confirmas el rename a **`/venta/nueva-movil`** (kebab-case) en lugar de `nueva_movil`?
2. ¿Cómo llega el usuario? El prompt no lo dice. Opciones: enlace/botón en el bottom nav móvil, redirect automático por viewport en `/venta/nueva`, o solo URL directa por ahora. Propongo **solo URL directa** en este ciclo y decidir el acceso al validar el UX.
3. Actualizar `prompt-venta-nueva-movil.md` con una nota "auditado, ver plan" o dejarlo intacto como artefacto original (propongo dejarlo intacto; este plan es la fuente).
