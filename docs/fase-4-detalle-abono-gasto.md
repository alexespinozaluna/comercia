# Fase 4: VentaDetalle, VentaAbono, VentaGasto

## Objetivo
Implementar las páginas de detalle de venta, registro de abonos y registro de gastos.

## Archivos creados

### `src/app/venta-detalle/[id]/page.tsx`
Detalle de una venta con acciones.

**Datos mostrados**:
- Información general: fecha, tipo (Pagado/Crédito), cliente, dirección
- Items de la venta con cantidades y precios
- Total y saldo si es crédito

**Acciones disponibles**:
- **Compartir**: Genera imagen del receipt con Canvas API y usa Web Share API (o descarga PNG)
- **Imprimir**: Envía texto ESC/POS por Bluetooth si hay impresora conectada
- **Editar**: Navega a `/venta-form/[id]?referencia=/venta-detalle/[id]`
- **Abono**: Navega a `/venta-abono?id=[id]&tipo=1&pagina=/venta-detalle/[id]`
- **Eliminar**: Diálogo de confirmación (AlertDialog) → `documentoService.delete(id)`

**Receipt renderer** (`receipt-renderer.tsx`):
- Usa Canvas API para generar imagen PNG del ticket
- Ancho configurable (default 280px para impresoras térmicas)
- Formato: líneas separadoras, items alineados, totales, fecha, cliente
- Botón de compartir usa `navigator.share()` con fallback a descarga

**Nota**: La página recibe `referencia` como query param para saber a dónde volver después de editar/abonar.

### `src/app/venta-abono/page.tsx`
Formulario para registrar un abono (pago parcial) sobre una deuda.

**Dos modos** (controlado por parámetro `tipo`):
- **tipo=1**: Abono a una venta individual. Muestra Alert con referencia y saldo.
- **tipo=2**: Abono a múltiples deudas de un cliente. Muestra Card con cantidad de deudas y total.

**Parámetros URL**:
- `id`: ID de la venta (tipo=1) o ID del cliente (tipo=2)
- `tipo`: 1 o 2
- `pagina`: URL de retorno

**Algoritmo de distribución del pago** (puerto de `GenerarPagoAsync` del original):
1. El usuario ingresa un monto
2. Se valida que no exceda la deuda total
3. Se distribuye el pago entre las deudas en orden, cubriendo cada una hasta su saldo
4. Cada deuda genera un `DocumentoItem` con `IdDocumentoRef` apuntando a la deuda
5. Se crea un `Documento` con `IdTipoDocumento: 2` (abono)

**Envuelto en `<Suspense>`** porque usa `useSearchParams()`.

### `src/app/venta-gasto/page.tsx`
Formulario para registrar o editar un gasto.

**Parámetros URL**:
- `id`: ID del gasto (0 = nuevo)
- `UrlRef`: URL de retorno

**Campos**:
- Fecha (input date)
- Valor (input number)
- Concepto (input text)
- Método de pago (RadioGroup)

**Guardar**:
- Si `id > 0` → UPDATE en tabla Documento con `IdTipoDocumento: 3` (gasto)
- Si `id === 0` → INSERT

**Envuelto en `<Suspense>`** porque usa `useSearchParams()`.

### Componentes compartidos

#### `src/components/shared/payment-method-selector.tsx`
Selector de método de pago usando RadioGroup.

- Recibe `metodoPago: MetodoPago[]`, `selectedMetodo`, `onSelect`
- Renderiza un RadioGroup con los métodos disponibles
- Se usa tanto en VentaAbono como en VentaGasto

## Puerto desde el MAUI original

### VentaDetalle.razor
- Misma información mostrada (items, totales, cliente)
- Acciones equivalentes (editar, eliminar, abono)
- **Diferencia**: En MAUI se usaba SkiaSharp para generar imagen del receipt; aquí se usa Canvas API
- **Diferencia**: En MAUI se usaba `Share.Default.Request` para compartir; aquí se usa Web Share API con fallback

### VentaAbono.razor
- Algoritmo `GenerarPagoAsync` portado directamente
- Misma lógica de distribución proporcional del pago
- **Diferencia**: En MAUI usaba parámetros de navegación; aquí usa query params con useSearchParams

### VentaGasto.razor
- Mismos campos y validaciones
- **Diferencia**: En MAUI usaba inyección de dependencias para servicios; aquí usa imports directos