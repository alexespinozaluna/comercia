# Fase 5: Deuda, Producto, Cliente

## Objetivo
Implementar las páginas CRUD de deudas, productos y clientes.

## Archivos creados

### `src/app/deuda/page.tsx` — Lista de deudas
Muestra deudas agrupadas por cliente con toggle de detalle inline.

**Flujo**:
- Carga ventas con `bCredito=true` y `Saldo > 0`
- Agrupa por `IdCliente` usando `ResumenAbono`
- Para cada grupo: nombre del cliente, total deuda, cantidad de ventas
- Click en un grupo → muestra las ventas individuales con sus saldos
- Botón "Abonar" → navega a `/venta-abono?id=[idCliente]&tipo=2&pagina=/deuda`

### `src/app/producto/page.tsx` — Lista de productos
Grid de productos con búsqueda.

**Flujo**:
- Carga todos los productos con `productoService.getAll()`
- Filtro por nombre en tiempo real
- Grid responsive: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- Click en producto → navega a `/producto-form?id=[id]&referencia=producto`
- Botón "+" → navega a `/producto-form?referencia=producto`

### `src/app/producto-form/page.tsx` — Formulario de producto
Crear o editar un producto.

**Parámetros URL**:
- `id`: ID del producto (0 = nuevo)
- `referencia`: URL de retorno (default: "producto")

**Campos**:
- Nombre (requerido)
- Precio Costo (opcional)
- Precio Venta (requerido)
- Cantidad (opcional)

**Guardar**:
- Si `id > 0` → `productoService.update()`
- Si `id === 0` → `productoService.add()`

**Envuelto en `<Suspense>`** porque usa `useSearchParams()`.

### `src/app/cliente/page.tsx` — Lista de clientes
Lista con búsqueda en tiempo real.

**Flujo**:
- Carga clientes con direcciones usando `clienteService.getAllWithDirecciones()`
- Filtro por nombre
- Click en cliente → navega a `/cliente/datos/[id]`
- Botón "+" → navega a `/cliente/datos/0`

### `src/app/cliente/datos/[id]/page.tsx` — Formulario de cliente
Formulario con tabs: Datos + Direcciones.

**Ruta dinámica**: `[id]` — 0 = nuevo, >0 = editar

**Tab Datos**:
- Nombre (requerido)
- "Ver más campos" toggle para: Celular, Tipo Documento (select: CI/RUT/Pasaporte/DNI), Nro Documento, Comentario
- Botones Guardar y Cerrar
- Si es edición → botón Eliminar con AlertDialog de confirmación

**Tab Direcciones**:
- Lista de direcciones con campos: Dirección, Contacto, Teléfono
- Switch `bPrincipal` (solo una puede ser principal)
- Botón "Agregar Dirección" añade una vacía
- Botón eliminar (ícono Trash2) por dirección

**Guardar**:
- `clienteService.saveClienteConDirecciones(idCliente, cliente)`
- Este servicio hace diff-based save (agrega nuevas, actualiza existentes, elimina las removidas)

**Eliminación**:
- `clienteService.delete(id)` con confirmación AlertDialog

### Componentes

#### `src/components/deuda/deuda-detail.tsx`
Componente inline de detalle de deuda por cliente.

- Recibe array de `Documento` (ventas con saldo)
- Muestra cada venta: concepto, fecha, saldo
- Botón "Abonar" por venta individual → `/venta-abono?id=[id]&tipo=1&pagina=/deuda`

## Puerto desde el MAUI original

### DeudaPage.razor
- Mismo patrón de agrupación por cliente
- **Diferencia**: En MAUI se usaba `Radzen.DataGrid`; aquí se usa toggle inline

### ProductoPage.razor / ProductoForm.razor
- Mismos campos y validaciones
- **Diferencia**: Grid de productos era `RadzenCard`; aquí es grid CSS con product-card

### ClientePage.razor / ClienteDatosPage.razor
- Mismo patrón de tabs (Datos + Direcciones)
- **Diferencia**: En MAUI usaba `RadzenTabs`; aquí shadcn Tabs
- **Diferencia**: El diff de direcciones se maneja en `clienteService.saveClienteConDirecciones()`, igual que en C#