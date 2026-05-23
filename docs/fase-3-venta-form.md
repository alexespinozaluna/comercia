# Fase 3: VentaForm (página más compleja)

## Objetivo
Implementar el formulario de venta con dos modos: selección de productos (grilla) y detalle/canasta.

## Archivos creados

### `src/app/venta-form/[id]/page.tsx`
Página con ruta dinámica `[id]`. Es la página más compleja de la app.

**Dos modos de visualización**:

1. **Modo selección** (default): Grid de productos con búsqueda, cards clickeables
2. **Modo detalle/canasta**: Formulario completo con items, cliente, método de pago

El cambio entre modos se controla con el estado local `showBasket`.

**Flujo de datos**:
- Al montar → carga productos (`productoService.getAll()`), métodos de pago (`documentoService.getMetodoPago()`)
- `basketItems` se maneja con estado local (NO el store global) para permitir cancelar sin efecto
- Al guardar → construye objeto `Documento` con `DocumentoItem[]` y llama `documentoService.crearVentaConItems()`
- Al guardar exitosamente → `triggerRefresh()` + `router.push("/")`

**Validaciones**:
- Al menos 1 item en la canasta
- Si es crédito (`bCredito: true`) → requiere cliente seleccionado
- Total se calcula automáticamente de los items

**Ruta**: `/venta-form/0` = nueva venta, `/venta-form/[id]` = editar venta existente

### Componentes

#### `src/components/ventas/product-card.tsx`
Card clickeable para un producto en la grilla de selección.

- Muestra nombre, precio, cantidad disponible
- Click → agrega a la canasta con cantidad 1
- Si ya existe en la canasta → incrementa cantidad
- Grid responsive: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`

#### `src/components/ventas/basket-detail.tsx`
Vista de detalle de la canasta/canasta con:
- Lista de items con cantidad, precio, total por línea
- Botones +/- para ajustar cantidad
- Botón eliminar item
- Sección de fecha con input type="date"
- Sección de tipo de pago (Pagado/Crédito) con RadioGroup
- Sección de cliente con selector

#### `src/components/ventas/basket-bar.tsx`
Barra sticky inferior que muestra:
- Contador de items
- Total formateado
- Botón para cambiar a modo detalle

#### `src/components/ventas/payment-type-selector.tsx`
RadioGroup para seleccionar:
- **Pagado** (bCredito = false) — venta al contado
- **Crédito** (bCredito = true) — venta a crédito, genera deuda

#### `src/components/ventas/client-assignment.tsx`
Componente para asignar cliente a la venta:
- Búsqueda por nombre
- Lista de clientes coincidentes
- Al seleccionar → carga direcciones del cliente
- Permite seleccionar dirección de entrega

## Puerto desde VentaForm.razor
La lógica de esta página es puerto directo del `VentaForm.razor` del MAUI original:

- Grid de productos con búsqueda → mismo patrón
- Canasta con +/- y eliminación → mismo patrón
- Tipo de pago (Pagado/Crédito) → mismo patrón
- Asignación de cliente con direcciones → mismo patrón
- Validación de crédito requiere cliente → misma regla de negocio

## Diferencias con el original
- En MAUI se usaba `RefreshService` para actualizar la lista; aquí se usa `useAppStore().triggerRefresh()`
- En MAUI la canasta era un estado del componente; aquí igual pero con `_tempId` para keys
- En MAUI el formulario estaba en una sola página Razor; aquí se divide en componentes