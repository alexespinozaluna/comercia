# Comercia Web — Documentacion Tecnica

Sistema de punto de venta (POS) web para gestion de ventas al credito y contado, control de pagos, egresos e ingresos. Migrado desde .NET MAUI Blazor Hybrid a Next.js 16 App Router.

---

## 1. Vision General

| Aspecto | Descripcion |
|---------|-------------|
| **Framework** | Next.js 16 (App Router, RSC/Client mixed) |
| **Lenguaje** | TypeScript 5 |
| **Estilos** | Tailwind CSS v4 + shadcn/ui (Base UI / `base-nova`) |
| **Backend** | Supabase (PostgreSQL) via `@supabase/supabase-js` |
| **Estado** | Zustand v5 (sin middleware de persistencia) |
| **Iconos** | Lucide React |
| **Fechas** | date-fns (locale `es`) |
| **Toasts** | Sonner |
| **Temas** | next-themes (claro / oscuro / sistema) |

**Acceso a datos**: todas las operaciones CRUD pasan por **API Routes** de Next.js (`src/app/api/*`). El frontend nunca accede directamente a Supabase. Autenticación con **JWT custom** (`jose` + `bcapsule`) sobre tabla `SistemaUsuario`. Roles: `ADMIN`, `CAJERO`, `VENDEDOR`, `COBRANZA`, `SUPERVISOR`. Multitenant por `IdTenant`.

---

## 2. Base de Datos

### 2.1 Tablas

#### `Producto`
Almacena el catalogo de productos con precios y stock.

| Columna | Tipo TS | Descripcion |
|---------|---------|-------------|
| `id` | `number` | PK autoincremental |
| `FechaCreacion` | `string` | ISO 8601 |
| `Nombre` | `string` | Nombre del producto |
| `PrecioCosto` | `number \| null` | Costo de compra |
| `PrecioVenta` | `number` | Precio de venta al publico |
| `Cantidad` | `number \| null` | Stock disponible |
| `IdTenant` | `number` | FK -> `SistemaTenant.id` |
| `Estado` | `number` | Soft delete: `1` activo, `0` eliminado |

#### `ProductoMovimiento`
Trazabilidad de stock (Kardex).

| Columna | Tipo TS | Descripcion |
|---------|---------|-------------|
| `id` | `number` | PK autoincremental |
| `IdTenant` | `number` | FK -> `SistemaTenant.id` |
| `IdProducto` | `number` | FK -> `Producto.id` |
| `TipoMovimiento` | `number` | 1=Entrada, 2=Salida, 3=Ajuste+, 4=Ajuste-, 5=Devolucion |
| `Cantidad` | `number` | Unidades movidas |
| `StockAnterior` | `number` | Stock antes del movimiento |
| `StockNuevo` | `number` | Stock despues del movimiento |
| `IdDocumento` | `number \| null` | FK -> `Documento.id` |
| `IdUsuario` | `number \| null` | Usuario que genero el movimiento |
| `Observacion` | `string \| null` | Nota libre |
| `Fecha` | `string` | ISO 8601 |

#### `Cliente`
Maestro de clientes. Soporta multiples direcciones via `ClienteDireccion`.

| Columna | Tipo TS | Descripcion |
|---------|---------|-------------|
| `id` | `number` | PK autoincremental |
| `FechaCreacion` | `string` | ISO 8601 |
| `Nombre` | `string` | Nombre completo |
| `NroTelefono` | `string \| null` | Celular / telefono |
| `TipoDocumento` | `string \| null` | CI, RUT, Pasaporte, DNI |
| `NroDocumento` | `string \| null` | Numero de documento |
| `Comentario` | `string \| null` | Notas libres |
| `IdTenant` | `number` | FK -> `SistemaTenant.id` |
| `Estado` | `number` | Soft delete |

#### `ClienteDireccion`
Direcciones asociadas a un cliente. Solo una puede ser `bPrincipal=true`.

| Columna | Tipo TS | Descripcion |
|---------|---------|-------------|
| `id` | `number` | PK autoincremental |
| `Direccion` | `string` | Texto de la direccion |
| `Telefono` | `string \| null` | Telefono de contacto en esta direccion |
| `Contacto` | `string` | Nombre de contacto |
| `IdCliente` | `number` | FK -> `Cliente.id` |
| `bPrincipal` | `boolean` | Indica direccion principal |
| `IdTenant` | `number` | FK -> `SistemaTenant.id` |
| `Estado` | `number` | Soft delete |

#### `MetodoPago`
Catalogo de metodos de pago (Efectivo, Transferencia, etc.).

| Columna | Tipo TS | Descripcion |
|---------|---------|-------------|
| `id` | `number` | PK autoincremental |
| `FechaCreacion` | `string` | ISO 8601 |
| `Nombre` | `string` | Nombre del metodo |
| `Simbolo` | `string` | Simbolo identificador |
| `IdTenant` | `number` | FK -> `SistemaTenant.id` |
| `Estado` | `number` | Soft delete |

#### `Documento`
Registro principal de operaciones: ventas, abonos/pagos y gastos.

| Columna | Tipo TS | Descripcion |
|---------|---------|-------------|
| `id` | `number` | PK autoincremental |
| `FechaCreacion` | `string` | Fecha de creacion del registro |
| `FechaEmision` | `string` | Fecha operativa / contable |
| `Descripcion` | `string \| null` | Descripcion larga |
| `Concepto` | `string \| null` | Concepto corto |
| `Total` | `number` | Monto total del documento |
| `bCredito` | `boolean` | `true` = venta a credito |
| `IdCliente` | `number` | FK -> `Cliente.id` (0 si no aplica) |
| `IdClienteDireccion` | `number \| null` | FK -> `ClienteDireccion.id` |
| `DireccionEntrega` | `string \| null` | Direccion de entrega textual |
| `TotalAbono` | `number` | Suma de abonos recibidos sobre esta deuda |
| `IdTipoDocumento` | `number` | **1**=Venta, **2**=Abono/Pago, **3**=Gasto |
| `Saldo` | `number` | Deuda restante (cuando `bCredito=true`) |
| `IdMetodoPago` | `number \| null` | FK -> `MetodoPago.id` |
| `IdTenant` | `number` | FK -> `SistemaTenant.id` |
| `Estado` | `number` | Soft delete |
| `IdUsuarioCreacion` | `number \| null` | Usuario que creo el documento |

#### `DocumentoItem`
Lineas de detalle de cada documento. Items de venta, o lineas de abono referenciando deudas.

| Columna | Tipo TS | Descripcion |
|---------|---------|-------------|
| `id` | `number` | PK autoincremental |
| `IdProducto` | `number` | FK -> `Producto.id` (0 para abonos/gastos) |
| `Descripcion` | `string` | Nombre del producto o concepto de abono |
| `Cantidad` | `number` | Unidades |
| `PrecioVenta` | `number` | Precio unitario |
| `MontoAbono` | `number` | Abono aplicado a esta linea |
| `Total` | `number` | `Cantidad * PrecioVenta` |
| `IdDocumento` | `number` | FK -> `Documento.id` (padre) |
| `IdDocumentoRef` | `number \| null` | FK -> `Documento.id` original (para abonos) |
| `IdTenant` | `number` | FK -> `SistemaTenant.id` |

#### `Negocio`
Configuracion del negocio (una sola fila por tenant).

| Columna | Tipo TS | Descripcion |
|---------|---------|-------------|
| `id` | `number` | PK autoincremental |
| `Nombre` | `string` | Nombre del negocio |
| `Direccion` | `string \| null` | Direccion fiscal |
| `Telefono` | `string \| null` | Telefono de contacto |
| `Logo` | `string \| null` | URL del logo |
| `IdTenant` | `number` | FK -> `SistemaTenant.id` |

#### `SistemaUsuario`
Usuarios del sistema (auth local, no Supabase Auth).

| Columna | Tipo TS | Descripcion |
|---------|---------|-------------|
| `id` | `number` | PK autoincremental |
| `Codigo` | `string` | Login unico |
| `Nombre` | `string` | Nombre completo |
| `PasswordHash` | `string` | bcrypt |
| `Estado` | `number` | `1` activo |

#### `SistemaPerfil`
Perfil vinculado a `SistemaUsuario` (roles y tenant).

| Columna | Tipo TS | Descripcion |
|---------|---------|-------------|
| `Id` | `string` | UUID igual al `id` de `SistemaUsuario` |
| `IdTenant` | `number` | FK -> `SistemaTenant.id` |
| `Codigo` | `string` | Login (duplicado para conveniencia) |
| `Nombre` | `string` | Nombre completo |
| `Rol` | `string` | `ADMIN`, `CAJERO`, `VENDEDOR`, `COBRANZA`, `SUPERVISOR` |
| `Estado` | `number` | `1` activo |

#### `Caja`
Control de caja diaria.

| Columna | Tipo TS | Descripcion |
|---------|---------|-------------|
| `id` | `number` | PK autoincremental |
| `IdTenant` | `number` | FK -> `SistemaTenant.id` |
| `IdUsuarioApertura` | `number` | Usuario que abrio |
| `FechaApertura` | `string` | ISO 8601 |
| `FechaCierre` | `string \| null` | ISO 8601 |
| `MontoInicial` | `number` | Efectivo al abrir |
| `MontoFinal` | `number \| null` | Efectivo al cerrar |
| `Estado` | `number` | `1` abierta, `0` cerrada |
| `IdUsuarioCierre` | `number \| null` | Usuario que cerro |

#### `DocumentoAudit` / `DocumentoItemAudit`
Auditoria generada por triggers PostgreSQL.

| Columna | Descripcion |
|---------|-------------|
| `id` | PK autoincremental |
| `IdDocumento` / `IdDocumentoItem` | FK al registro auditado |
| `Operacion` | `INSERT`, `UPDATE`, `DELETE` |
| `Usuario` | `current_user` de PostgreSQL |
| `Fecha` | ISO 8601 |
| `DatosAnteriores` | JSON del registro antes del cambio |
| `DatosNuevos` | JSON del registro despues del cambio |

### 2.2 Relaciones

```
Cliente 1--N ClienteDireccion
Documento N--1 Cliente
Documento 1--N DocumentoItem
Documento N--1 MetodoPago
DocumentoItem N--1 Producto
DocumentoItem N--1 Documento (autorreferencia via IdDocumentoRef)
```

### 2.3 Funciones / RPC en PostgreSQL

| Nombre | Parametros | Retorno | Uso |
|--------|------------|---------|-----|
| `generate_ticket_text` | `venta_id: int`, `width: int` | `text` | Genera texto formateado ESC/POS para impresion termica. Llamado desde API route `/api/ticket/[id]`. |

### 2.4 Filtros de datos comunes

- **Ventas / Ingresos**: `IdTipoDocumento != 3`
- **Gastos**: `IdTipoDocumento == 3`
- **Deudas activas**: `bCredito == true && Saldo > 0`
- **Pagos / Abonos**: `IdTipoDocumento == 2`
- **Rango de fechas**: `FechaEmision >= inicio && FechaEmision <= fin`

---

## 3. Modulos Funcionales

### 3.1 Dashboard (`/`)

**Componentes clave**: `BalanceCards`, `DateFilterBar`, `VentaListItem`, Tabs (Ingresos / Gastos).

**Flujo**:
1. Al montar, restaura filtros de `sessionStorage` (clave `HistoryState`).
2. Carga ventas del periodo via API `GET /api/ventas?fechaIni=...&fechaFin=...`.
3. Separa ingresos (`IdTipoDocumento !== 3`) y gastos (`=== 3`).
4. Calcula metricas:
   - `totalEfectivo` = suma de ventas `!bCredito`
   - `totalAbono` = suma de `TotalAbono` de ventas `bCredito`
   - `totalGastos` = suma de documentos tipo 3
   - `balance` = `totalEfectivo + totalAbono - totalGastos`
5. Renderiza cards semaforizadas y lista de transacciones por tab.

### 3.2 Ventas — Listado (`/venta`)

**Flujo**:
1. Carga ventas filtradas por fecha via `GET /api/ventas`.
2. Muestra cards: Credito + `BalanceCards` (Balance, Efectivo, Abono, Gastos).
3. Buscador por `Concepto`, `Descripcion` o `Cliente.Nombre`.
4. Tabla con columnas: Concepto, Cliente, Fecha, Total.
5. Badges: `Credito` (azul) / `Pagado` (verde).
6. Click en fila -> `/venta-detalle/[id]`.

### 3.3 Venta Form — Crear / Editar (`/venta-form/[id]`)

**Flujo de dos pasos**:

**Paso 1 — Seleccion de productos**:
- Grid de productos con buscador en tiempo real.
- Click en card de producto -> agrega a canasta local (cantidad 1, o incrementa si ya existe).
- Badge en card indica cantidad actual en canasta.
- Card dashed al final navega a creacion rapida de producto.
- Barra flotante sticky inferior muestra: cantidad de items + total. Click avanza al paso 2.

**Paso 2 — Detalle de canasta**:
- Fecha de emision (`Input type="date"`).
- Forma de pago: `Pagado` / `Credito` (RadioGroup visual con cards).
- Lista de items: descripcion, controles +/-, precio editable inline, subtotal por linea, boton eliminar.
- Seccion de cliente:
  - Si es credito, requiere cliente obligatoriamente.
  - Navega a selector de cliente (`/cliente?select=true&returnTo=...`).
  - Si el cliente tiene direcciones, muestra `<select>` para elegir.
- Boton Guardar: construye objeto `Documento` + `DocumentoItem[]`.
  - Envia via `POST /api/ventas` (nuevo) o `PUT /api/ventas/[id]` (editar).
  - Valida caja abierta en el backend; rechaza si no hay caja.
  - Tras guardar: `triggerRefresh()` y redirige a `/`.

### 3.4 Venta Detalle (`/venta-detalle/[id]`)

**Flujo**:
1. Carga documento con items y cliente via `getVentaConItem(id)`.
2. Muestra card de resumen: tipo, concepto, fecha, cliente, direccion, total, saldo pendiente.
3. Tabla de items (producto, cantidad, precio unitario, total).
4. Acciones:
   - **Compartir**: llama `GET /api/ticket/[id]`, dibuja en Canvas 384px de ancho, exporta PNG.
   - **Imprimir**: placeholder UI (Bluetooth disponible en `/bluetoothprinter`).
   - **Editar**: si `TotalAbono === 0` y no es abono, navega a formulario.
   - **Abono**: si `bCredito && Saldo > 0`, navega a `/venta-abono?tipo=1&id=...`.
   - **Eliminar**: `AlertDialog` de confirmacion -> `DELETE /api/ventas/[id]` (soft delete).

### 3.5 Abono / Pago (`/venta-abono`)

**Parametros URL**: `?id=[cliente|documento]&tipo=[1|2]&pagina=[url_retorno]`

**Flujo**:
- `tipo=1`: Abono a un documento especifico. Muestra referencia y saldo.
- `tipo=2`: Abono general a deudas de un cliente. Muestra cantidad de deudas y suma de saldos.
- El usuario ingresa: fecha, monto, concepto, metodo de pago.
- **Algoritmo de distribucion**:
  ```
  remaining = monto ingresado
  for cada deuda ordenada:
      abono = min(remaining, deuda.Saldo)
      crear DocumentoItem con IdDocumentoRef = deuda.id
      remaining -= abono
  ```
- Crea `Documento` con `IdTipoDocumento = 2` e items asociados.
- Envia via `POST /api/abonos`. Valida caja abierta en backend.
- Luego `triggerRefresh()`.

### 3.6 Gasto (`/venta-gasto`)

**Parametros URL**: `?id=[id]&UrlRef=[retorno]`

**Flujo**:
- Formulario: Fecha, Valor, Concepto, Metodo de pago.
- Si `id > 0`: `PUT /api/gastos/[id]`.
- Si `id = 0`: `POST /api/gastos` con `IdTipoDocumento = 3`.
- Valida caja abierta en backend.
- Usa `Suspense` porque consume `useSearchParams`.

### 3.7 Deudas (`/deuda`)

**Flujo de dos niveles**:

**Nivel 1 — Resumen**:
- Carga documentos `bCredito=true && Saldo > 0`.
- Agrupa por `IdCliente` en memoria (`ResumenAbono`):
  - Nombre del cliente, cantidad de documentos, fecha ultima, suma de saldos.
- Card resumen: total por cobrar, numero de clientes y documentos.
- Buscador por nombre.
- Click en cliente -> Nivel 2.

**Nivel 2 — Detalle por cliente**:
- Muestra cards: Deuda (rojo) vs Abono recibido (verde).
- Lista de documentos pendientes con saldo. Si tuvo abonos previos, muestra total tachado.
- Click en documento -> `/venta-detalle/[id]`.
- Boton "Realizar Abono" -> `/venta-abono?tipo=2&id=[IdCliente]&pagina=deuda`.

### 3.8 Clientes (`/cliente` y `/cliente/datos/[id]`)

**Lista (`/cliente`)**:
- Carga via `GET /api/clientes`.
- Buscador por nombre.
- Cards con avatar (iniciales), nombre, telefono, cantidad de direcciones.
- Click -> formulario.

**Formulario (`/cliente/datos/[id]`)**:
- Tabs: "Datos" y "Direcciones".
- Datos: nombre (requerido), telefono, tipo/nro de documento, comentario. Campos opcionales ocultos tras toggle.
- Direcciones: lista dinamica (agregar/eliminar). Campos: Direccion, Contacto, Telefono, Switch `bPrincipal`.
- Guardar: `POST /api/clientes` o `PUT /api/clientes/[id]` (diff-based master-detail en backend).
- Eliminar: confirmacion AlertDialog -> `DELETE /api/clientes/[id]` (valida que no tenga documentos activos).

### 3.9 Productos (`/producto` y `/producto-form`)

**Lista (`/producto`)**:
- Grid responsive de cards con: icono de paquete, nombre, badge de stock (verde/rojo), precio.
- Buscador en tiempo real.
- Click -> edicion. Boton "Crear Producto" -> formulario.

**Formulario (`/producto-form`)**:
- Campos: Nombre (req), Precio Costo, Precio Venta (req), Cantidad.
- Guarda via `POST /api/productos` o `PUT /api/productos/[id]`.
- Eliminar: `DELETE /api/productos/[id]` (valida que no tenga movimientos en Kardex).
- Parametro `referencia` en URL determina ruta de retorno.

### 3.10 Impresora Bluetooth (`/bluetoothprinter`)

**Flujo**:
- Usa hook `useBluetoothPrinter` y servicio `bluetooth-printer.ts`.
- Detecta soporte del navegador (`navigator.bluetooth`).
- Boton "Buscar Dispositivos": filtra por UUID SPP (`00001101-0000-1000-8000-00805f9b34fb`).
- Conecta via GATT, obtiene caracteristica de escritura.
- Envio por chunks de 512 bytes.
- Comando ESC/POS de corte al final (`0x1d 0x56 0x42 0x00`).
- Puede imprimir texto libre o ticket por ID (llama RPC `generate_ticket_text`).

---

## 4. Capa de API (Next.js API Routes)

Todas las operaciones de backend pasan por API Routes. El frontend consume via `api-client.ts` (`apiGet`, `apiPost`, `apiPut`, `apiDelete`).

### 4.1 Auth (`/api/auth/*`)

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/auth/login` | `POST` | Valida `Codigo` + `Password` contra `SistemaUsuario`. Devuelve JWT (`jose`). |
| `/api/auth/logout` | `POST` | Limpia cookie `token`. |
| `/api/auth/me` | `GET` | Devuelve perfil del usuario autenticado desde JWT. |

### 4.2 Ventas (`/api/ventas`, `/api/ventas/[id]`)

| Metodo | Endpoint | Logica |
|--------|----------|--------|
| `GET` | `/api/ventas` | Filtros: fecha, `bCredito`, `IdCliente`. Inyecta `IdTenant`. |
| `POST` | `/api/ventas` | Valida caja abierta. Master-detail insert con rollback. |
| `GET` | `/api/ventas/[id]` | Documento + Cliente + DocumentoItem. |
| `PUT` | `/api/ventas/[id]` | Diff-based update de items. |
| `DELETE` | `/api/ventas/[id]` | Soft delete. Valida `TotalAbono === 0`. |

### 4.3 Abonos (`/api/abonos`)

| Metodo | Endpoint | Logica |
|--------|----------|--------|
| `POST` | `/api/abonos` | Valida caja abierta. Crea Documento tipo 2 + items. |

### 4.4 Gastos (`/api/gastos`, `/api/gastos/[id]`)

| Metodo | Endpoint | Logica |
|--------|----------|--------|
| `GET` | `/api/gastos` | Lista de gastos (filtrado por fecha). |
| `POST` | `/api/gastos` | Valida caja abierta. Crea Documento tipo 3. |
| `PUT` | `/api/gastos/[id]` | Update. |
| `DELETE` | `/api/gastos/[id]` | Soft delete. |

### 4.5 Clientes (`/api/clientes`, `/api/clientes/[id]`)

| Metodo | Endpoint | Logica |
|--------|----------|--------|
| `GET` | `/api/clientes` | `Cliente` + `ClienteDireccion`. Inyecta `IdTenant`. |
| `POST` | `/api/clientes` | Diff-based master-detail save. |
| `GET` | `/api/clientes/[id]` | Cliente + direcciones. |
| `PUT` | `/api/clientes/[id]` | Diff-based master-detail update. |
| `DELETE` | `/api/clientes/[id]` | Soft delete. Valida que no tenga documentos activos. |

### 4.6 Productos (`/api/productos`, `/api/productos/[id]`)

| Metodo | Endpoint | Logica |
|--------|----------|--------|
| `GET` | `/api/productos` | Lista con filtro `IdTenant`. |
| `POST` | `/api/productos` | Insert. |
| `PUT` | `/api/productos/[id]` | Update. |
| `DELETE` | `/api/productos/[id]` | Soft delete. Valida que no tenga movimientos en Kardex. |

### 4.7 Caja (`/api/caja`, `/api/caja/apertura`, `/api/caja/cierre`)

| Metodo | Endpoint | Logica |
|--------|----------|--------|
| `GET` | `/api/caja` | Devuelve caja abierta actual para el tenant. |
| `POST` | `/api/caja/apertura` | Abre caja con monto inicial. |
| `POST` | `/api/caja/cierre` | Cierra caja, calcula monto final. |

### 4.8 Otros endpoints

| Endpoint | Descripcion |
|----------|-------------|
| `/api/deudas` | Agrupacion de deudas por cliente. |
| `/api/metodo-pago` | Catalogo de metodos de pago. |
| `/api/negocio` | GET/PUT de configuracion `Negocio`. |
| `/api/auditoria/documentos` | Lista `DocumentoAudit`. |
| `/api/auditoria/items` | Lista `DocumentoItemAudit`. |
| `/api/ticket/[id]` | Genera texto ESC/POS via RPC. |
| `/api/kardex/[id]` | Movimientos de stock de un producto. |

---

## 5. Estado Global (Zustand)

**Archivo**: `src/stores/app-store.ts`

### Estado

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `filterTipo` | `string` | Criterio: Dia / Semana / Mes / Ano |
| `filterFechaInicio` | `string` | `yyyy-MM-dd` |
| `filterFechaFin` | `string` | `yyyy-MM-dd` |
| `filterIndex` | `number` | Indice del rango dentro del criterio |
| `basketItems` | `BasketItem[]` | Items en canasta de venta |
| `basketClient` | `Cliente \| null` | Cliente seleccionado en canasta |
| `basketClientDireccion` | `ClienteDireccion \| null` | Direccion seleccionada |
| `basketIsCredit` | `boolean` | Forma de pago en canasta |
| `basketFecha` | `string` | Fecha de emision en canasta |
| `refreshCounter` | `number` | Trigger de re-fetch para listas |

### Acciones principales

- `setFilter(tipo, index, ini, fin)` — Actualiza filtros de fecha.
- `addToBasket(item)` / `removeFromBasket(tempId)` / `updateBasketItem(tempId, updates)` — CRUD de canasta.
- `clearBasket()` — Limpia canasta y cliente asociado.
- `setBasketClient(cliente)` / `setBasketClientDireccion(direccion)` / `setBasketIsCredit(isCredit)` / `setBasketFecha(fecha)` — Setters.
- `triggerRefresh()` — Incrementa `refreshCounter`.

**Persistencia manual**: las paginas que usan filtros guardan/recuperan `HistoryState` desde `sessionStorage`. El store de Zustand no usa middleware de persistencia.

---

## 6. Componentes y UI

### Layout

| Componente | Descripcion |
|------------|-------------|
| `AppShell` | Shell responsive. Desktop: sidebar fija 60px. Mobile: header sticky con backdrop-blur + bottom nav. |
| `NavMenu` | Menu lateral con 5 items. Activo resaltado con fondo primario y sombra. |
| `MobileNav` | Bottom nav fija (`fixed bottom-0`). Indicador visual redondeado en item activo. |

### Ventas

| Componente | Descripcion |
|------------|-------------|
| `BalanceCards` | Grid de 4 metricas (Balance, Efectivo, Abono, Gastos) con iconos circulares semanticos. |
| `DateFilterBar` | Dos DropdownMenus: criterio (Dia/Semana/Mes/Ano) y rango especifico. Genera rangos con `date-fns`. |
| `VentaListItem` | Item clickeable con flechas de direccion (subida/bajada), badge Credito/Pagado, monto formateado. |

### Shared

| Componente | Descripcion |
|------------|-------------|
| `ErrorBoundary` | Captura errores de render. Fallback con boton "Reintentar". |
| `ConnectionStatus` | Banner fijo cuando `navigator.onLine === false`. |
| `PrinterDialog` | Dialog reutilizable para conectar/desconectar impresora Bluetooth. |

---

## 7. Utilidades

| Archivo | Funciones / Proposito |
|---------|----------------------|
| `src/lib/supabase.ts` | Cliente singleton de Supabase para frontend (solo login). |
| `src/lib/supabase-server.ts` | Cliente lazy singleton para API routes. Usa `NEXT_PUBLIC_SUPABASE_ANON_KEY`. |
| `src/lib/api-client.ts` | `apiGet`, `apiPost`, `apiPut`, `apiDelete` con fetch + JWT cookie. |
| `src/lib/api-middleware.ts` | `getCurrentUser`, `getPerfil`, `requireRole`, `injectTenant`. |
| `src/lib/password.ts` | `hashPassword` / `verifyPassword` con bcryptjs. |
| `src/lib/format.ts` | `numToString(value, formato)` -> `$ 37.500`; `fechaString` -> `dd/MM/yy HH:mm`; `extraerIniciales`; `sbsLeft` (truncate). |
| `src/lib/date-utils.ts` | `obtenerRangosDeFechas(criterio)` genera arreglos de `FiltroFecha` para el selector de periodos. |
| `src/lib/bluetooth-printer.ts` | Web Bluetooth: filtra UUID SPP, conecta GATT, escribe por chunks de 512 bytes, comando ESC/POS cut. |
| `src/lib/utils.ts` | `cn(...inputs)` = `twMerge(clsx(...))`. |
| `src/hooks/use-bluetooth-printer.ts` | Hook que sincroniza estado mutable del modulo Bluetooth con React. |

---

## 8. Patrones de Diseno

### 8.1 Service Layer + CRUD Generico
`supabase-service.ts` provee operaciones base. Los servicios especificos delegan para casos simples y agregan logica de dominio para master-detail.

### 8.2 Master-Detail Diff-Based Save
Usado en `saveClienteConDirecciones` y `modificarVentaConItems`:
1. Traer entidades hijas actuales de la DB.
2. Comparar con array enviado.
3. Clasificar: nuevas, actualizadas, eliminadas.
4. Ejecutar INSERT / UPDATE / DELETE (batch delete usa `.in("id", ids)`).

### 8.3 Master-Detail con Rollback Manual
Usado en `crearVentaConItems`:
1. INSERT padre -> obtener `id` generado.
2. INSERT hijos con FK.
3. Si falla -> DELETE padre para mantener consistencia.

### 8.4 CleanJsonId
Antes de INSERT, elimina propiedad `id` si es `0` o `undefined` para que PostgreSQL asigne autoincremental. Patron heredado de la version .NET MAUI.

### 8.5 Zustand como Refresh Service
`refreshCounter` actua como senal de re-fetch. Las paginas lo incluyen en dependencias de `useEffect` para recargar tras mutaciones.

### 8.6 Suspense para useSearchParams
Todas las paginas que consumen `useSearchParams` envuelven contenido en `<Suspense>` para evitar errores de prerender estatico.

### 8.7 Web Bluetooth con Estado de Modulo
`bluetooth-printer.ts` mantiene estado en variables de modulo (independiente de React). El hook sincroniza ese estado con el arbol de componentes.

### 8.8 shadcn/ui Base UI (sin `asChild`)
Triggers de Sheet, DropdownMenu, AlertDialog, etc. no usan `asChild`. Se estilizan directamente con `className`.

### 8.9 API Routes como capa de seguridad
Todas las operaciones CRUD pasan por API Routes de Next.js. El frontend usa `api-client.ts` (fetch + JWT cookie). Los API routes validan JWT, extraen `IdTenant` y `Rol`, inyectan filtros de tenant, y ejecutan queries con `getSupabaseServer()`. Ninguna pagina del frontend accede directamente a Supabase.

---

## 9. Referencias de Archivos

### Frontend

| Categoria | Ruta |
|-----------|------|
| Tipos | `src/types/database.ts` |
| Store | `src/stores/app-store.ts` |
| Supabase Client (frontend) | `src/lib/supabase.ts` |
| Supabase Server (API routes) | `src/lib/supabase-server.ts` |
| API Client | `src/lib/api-client.ts` |
| API Middleware | `src/lib/api-middleware.ts` |
| Password | `src/lib/password.ts` |
| CRUD Generico | `src/services/supabase-service.ts` |
| Servicio Documento | `src/services/documento-service.ts` |
| Servicio Cliente | `src/services/cliente-service.ts` |
| Servicio Producto | `src/services/producto-service.ts` |
| Servicio Caja | `src/services/caja-service.ts` |
| Servicio Kardex | `src/services/kardex-service.ts` |
| Dashboard | `src/app/page.tsx` |
| Login | `src/app/login/page.tsx` |
| Venta Form | `src/app/venta-form/[id]/page.tsx` |
| Venta Detalle | `src/app/venta-detalle/[id]/page.tsx` |
| Venta Abono | `src/app/venta-abono/page.tsx` |
| Venta Gasto | `src/app/venta-gasto/page.tsx` |
| Deudas | `src/app/deuda/page.tsx` |
| Clientes | `src/app/cliente/page.tsx` |
| Cliente Form | `src/app/cliente/datos/[id]/page.tsx` |
| Productos | `src/app/producto/page.tsx` |
| Producto Form | `src/app/producto-form/page.tsx` |
| Producto Kardex | `src/app/producto/kardex/[id]/page.tsx` |
| Caja | `src/app/caja/page.tsx` |
| Configuracion | `src/app/configuracion/page.tsx` |
| Auditoria | `src/app/auditoria/page.tsx` |
| Bluetooth | `src/app/bluetoothprinter/page.tsx` |
| App Shell | `src/components/layout/app-shell.tsx` |
| Impresora BLE | `src/lib/bluetooth-printer.ts` |

### API Routes

| Categoria | Ruta |
|-----------|------|
| Auth | `src/app/api/auth/login/route.ts`, `logout/route.ts`, `me/route.ts` |
| Ventas | `src/app/api/ventas/route.ts`, `[id]/route.ts` |
| Abonos | `src/app/api/abonos/route.ts` |
| Gastos | `src/app/api/gastos/route.ts`, `[id]/route.ts` |
| Clientes | `src/app/api/clientes/route.ts`, `[id]/route.ts` |
| Productos | `src/app/api/productos/route.ts`, `[id]/route.ts` |
| Deudas | `src/app/api/deudas/route.ts` |
| Metodo Pago | `src/app/api/metodo-pago/route.ts` |
| Caja | `src/app/api/caja/route.ts`, `apertura/route.ts`, `cierre/route.ts` |
| Negocio | `src/app/api/negocio/route.ts` |
| Auditoria | `src/app/api/auditoria/documentos/route.ts`, `items/route.ts` |
| Ticket | `src/app/api/ticket/[id]/route.ts` |
| Kardex | `src/app/api/kardex/[id]/route.ts` |
