# Comercia Web — Contexto del Proyecto

## Resumen

Sistema POS (punto de venta) web migrado desde .NET MAUI Blazor Hybrid.
Todo el texto de la UI está en **español (es-ES)**. El backend es **Supabase (PostgreSQL)**.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript 5 |
| UI | shadcn/ui con **Base UI** (NO Radix) |
| Estilos | Tailwind CSS 4 (config en `globals.css`, sin `tailwind.config.ts`) |
| Estado global | Zustand 5 |
| Animaciones | Framer Motion 12 |
| Backend | Supabase (PostgreSQL) vía `@supabase/supabase-js` |
| Auth | JWT custom con `jose` + `bcryptjs` (tabla `SistemaUsuario`) |
| Notificaciones | Sonner 2 |
| Fechas | date-fns 4 |
| Runtime | Node.js / Next.js server (API routes) |

### Regla crítica de shadcn/ui
**No usar la prop `asChild`** en ningún componente (SheetTrigger, DropdownMenuTrigger, etc.).
La versión actual usa Base UI, no Radix, y `asChild` no existe.

---

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL       # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Anon key (usada en frontend y API routes)
JWT_SECRET_KEY                 # Secreto para firmar JWT custom
```

---

## Estructura de directorios

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (ThemeProvider, AppShell, Toaster)
│   ├── page.tsx                  # Dashboard / Home (lista de ventas del día)
│   ├── globals.css               # Tailwind 4 + tokens CSS (oklch)
│   │
│   ├── login/page.tsx            # Login con JWT custom
│   │
│   ├── venta/
│   │   ├── page.tsx              # Lista de ventas (filtros avanzados)
│   │   └── nueva/page.tsx        # Redirect a venta-form/0
│   ├── venta-form/[id]/page.tsx  # POS: crear (id=0) o editar venta
│   ├── venta-detalle/[id]/page.tsx # Detalle de una venta con items
│   ├── venta-abono/page.tsx      # Formulario de abono a crédito
│   ├── venta-gasto/page.tsx      # Formulario de gasto (IdTipoDocumento=3)
│   ├── venta-lista/page.tsx      # Lista alternativa de ventas
│   ├── venta-eliminadas/page.tsx # Papelera (Estado=0)
│   │
│   ├── deuda/page.tsx            # Deudas agrupadas por cliente
│   ├── cliente/
│   │   ├── page.tsx              # Lista de clientes (+ modo select)
│   │   └── datos/[id]/page.tsx   # Crear/editar cliente con direcciones
│   ├── producto/
│   │   ├── page.tsx              # Grid de inventario
│   │   ├── datos/[id]/page.tsx   # Crear/editar producto
│   │   ├── ajustes/page.tsx      # Ajustes de stock (kardex manual)
│   │   └── kardex/[id]/page.tsx  # Historial de movimientos de un producto
│   │
│   ├── caja/page.tsx             # Apertura/cierre de caja
│   ├── configuracion/page.tsx    # Config del negocio (Negocio table)
│   ├── auditoria/page.tsx        # Auditoría de documentos
│   ├── bluetoothprinter/page.tsx # Config impresora Bluetooth
│   │
│   └── api/                      # API Routes (toda la lógica backend)
│       ├── auth/
│       │   ├── login/route.ts    # POST: autentica usuario, emite JWT (cookie httpOnly)
│       │   ├── logout/route.ts   # POST: borra cookie JWT
│       │   └── me/route.ts       # GET: devuelve usuario autenticado
│       ├── ventas/
│       │   ├── route.ts          # GET: lista ventas filtradas por fecha
│       │   ├── [id]/route.ts     # GET/PUT/DELETE: venta individual
│       │   └── eliminadas/route.ts # GET: ventas con Estado=0
│       ├── deudas/route.ts       # GET: ventas bCredito=true con Saldo>0
│       ├── abonos/route.ts       # POST: crear abono (IdTipoDocumento=2)
│       ├── gastos/
│       │   ├── route.ts          # POST: crear gasto (IdTipoDocumento=3)
│       │   └── [id]/route.ts     # PUT/DELETE: gasto individual
│       ├── clientes/
│       │   ├── route.ts          # GET: lista clientes con direcciones
│       │   └── [id]/route.ts     # GET/PUT/DELETE: cliente individual
│       ├── productos/
│       │   ├── route.ts          # GET: lista productos
│       │   └── [id]/route.ts     # GET/PUT/DELETE: producto individual
│       ├── kardex/
│       │   ├── route.ts          # GET: movimientos de stock
│       │   └── [id]/route.ts     # GET: movimientos de un producto
│       ├── ajustes/route.ts      # POST: ajuste manual de stock
│       ├── perdidas/route.ts     # POST: registrar baja/merma
│       ├── caja/
│       │   ├── route.ts          # GET: caja activa del tenant
│       │   ├── apertura/route.ts # POST: abrir caja
│       │   └── cierre/route.ts   # POST: cerrar caja
│       ├── metodo-pago/route.ts  # GET: métodos de pago
│       ├── negocio/route.ts      # GET/PUT: config del negocio
│       ├── ticket/[id]/route.ts  # GET: texto del ticket (vía RPC Supabase)
│       ├── tipo-movimiento/route.ts # GET: tipos de movimiento kardex
│       └── auditoria/
│           ├── documentos/route.ts # GET: auditoría de Documento
│           └── items/route.ts      # GET: auditoría de DocumentoItem
│
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx         # Shell principal: sidebar desktop + header + mobile nav
│   │   ├── nav-menu.tsx          # Menú lateral con grupos (Principal / Gestión) y roles
│   │   └── mobile-nav.tsx        # Barra de navegación inferior mobile
│   │
│   ├── ventas/
│   │   ├── balance-cards.tsx     # 6 tarjetas: Balance, Ventas, Efectivo, Pendiente, Abono, Gastos
│   │   ├── date-filter-bar.tsx   # Selector de periodo (Dia/Semana/Mes/Año) con rangos
│   │   ├── venta-list-item.tsx   # Fila de venta en lista (ingreso o gasto)
│   │   ├── quick-metric-cards.tsx # Métricas rápidas (variante compacta)
│   │   ├── cliente-selector-sheet.tsx # Sheet de búsqueda y selección de cliente
│   │   ├── loss-section.tsx      # Sección de bajas/mermas
│   │   └── pos/
│   │       ├── ProductSearch.tsx       # Grid de productos con barra de búsqueda y FAB canasta
│   │       ├── CartSummary.tsx         # Resumen del carrito: items, totales, guardar
│   │       ├── CartItemDetailSheet.tsx # Sheet para editar cantidad/precio de un item
│   │       ├── ClientSelector.tsx      # Selector de cliente dentro del carrito
│   │       └── ProductQuickCreate.tsx  # Sheet para crear producto rápido desde el POS
│   │
│   ├── kardex/
│   │   └── registro-baja-form.tsx # Formulario de baja/merma de stock
│   │
│   ├── shared/
│   │   ├── page-header.tsx       # Header de página con breadcrumbs y botón atrás
│   │   ├── loading-state.tsx     # Skeleton variants: skeleton-list, skeleton-cards, skeleton-form
│   │   ├── empty-state.tsx       # Estado vacío con icono, título y descripción
│   │   ├── status-badge.tsx      # Badge de estado: success/error/info/warning
│   │   ├── search-input.tsx      # Input de búsqueda con debounce
│   │   ├── error-handler.tsx     # ErrorBoundary global
│   │   ├── connection-status.tsx # Banner offline detector
│   │   ├── printer-dialog.tsx    # Dialog para imprimir ticket Bluetooth
│   │   ├── data-table-wrapper.tsx # Wrapper genérico para tablas
│   │   └── card-header-icon.tsx  # Header de card con icono y título
│   │
│   └── ui/                       # Componentes shadcn/ui generados
│       button, input, card, sheet, dialog, alert-dialog,
│       tabs, select, dropdown-menu, avatar, badge, separator,
│       skeleton, tooltip, sonner, switch, table, textarea,
│       label, calendar, popover, command, radio-group,
│       alert, input-group
│
├── services/                     # Capa de acceso a Supabase (server-side)
│   ├── supabase-service.ts       # getAll / getById / add / update / deleteItem genéricos
│   ├── documento-service.ts      # CRUD Documento + DocumentoItem vía RPC atómica
│   ├── cliente-service.ts        # CRUD Cliente + ClienteDireccion (diff-based)
│   ├── producto-service.ts       # CRUD Producto
│   ├── kardex-service.ts         # Lectura de ProductoMovimiento
│   ├── caja-service.ts           # Apertura / cierre / verificación de Caja
│   ├── negocio-service.ts        # Lectura/escritura Negocio
│   ├── auditoria-service.ts      # Lectura DocumentoAudit / DocumentoItemAudit
│   └── usuario-service.ts        # Autenticación: buscar usuario, verificar password
│
├── stores/
│   └── app-store.ts              # Zustand: filtros de fecha, refreshCounter, authUser
│
├── hooks/
│   ├── use-pos-transaction.ts    # Hook maestro del POS: productos, canasta, guardar venta
│   └── use-bluetooth-printer.ts  # Hook para impresión Bluetooth (Web Bluetooth API)
│
├── lib/
│   ├── supabase.ts               # Cliente Supabase frontend (anon key, para login)
│   ├── supabase-server.ts        # Singleton Supabase server (API routes, sin sesión)
│   ├── api-client.ts             # apiGet / apiPost / apiPut / apiDelete (fetch wrapper)
│   ├── api-auth.ts               # getAuthUser() — lee JWT de cookie en API routes
│   ├── auth-client.ts            # getCurrentUser() / logout() — llamadas desde el cliente
│   ├── jwt.ts                    # signJwt / verifyJwt con jose
│   ├── password.ts               # hashPassword / comparePassword con bcryptjs
│   ├── format.ts                 # numToString / fechaString / extraerIniciales / sbsLeft
│   ├── date-utils.ts             # obtenerRangosDeFechas (Dia/Semana/Mes/Año)
│   ├── theme.ts                  # Helpers de tema (dark/light)
│   ├── bluetooth-printer.ts      # Lógica Web Bluetooth: conectar, imprimir ESC/POS
│   └── utils.ts                  # cn() = clsx + tailwind-merge
│
├── types/
│   └── database.ts               # Interfaces TypeScript del schema (PascalCase = columnas DB)
│
└── middleware.ts                  # Protege rutas: redirige a /login si no hay JWT válido
```

---

## Base de datos (Supabase / PostgreSQL)

### Tablas principales

| Tabla | Descripción |
|---|---|
| `Documento` | Venta (1), Abono (2) o Gasto (3) según `IdTipoDocumento` |
| `DocumentoItem` | Líneas de `Documento`; `IdDocumentoRef` apunta a la venta al abonar |
| `Cliente` | Clientes del negocio |
| `ClienteDireccion` | Direcciones de entrega de un `Cliente` |
| `Producto` | Inventario con `Cantidad` (stock) |
| `MetodoPago` | Referencia de métodos de pago |
| `Negocio` | Config del negocio (fila única) |
| `Caja` | Control de apertura/cierre de caja por tenant |
| `ProductoMovimiento` | Kardex: movimientos de stock (venta, compra, ajuste, baja...) |
| `SistemaTenant` | Multi-tenant: cada negocio es un tenant |
| `SistemaUsuario` | Usuarios del sistema con rol y password hash (bcryptjs) |
| `DocumentoAudit` | Auditoría de cambios en `Documento` (INSERT/UPDATE/DELETE) |
| `DocumentoItemAudit` | Auditoría de cambios en `DocumentoItem` |

### Columnas transversales

- `IdTenant` (BIGINT): presente en todas las tablas de negocio
- `Estado` (SMALLINT): `1` = activo, `0` = eliminado lógico (soft delete)
- `FechaCreacion` (TIMESTAMP): generada automáticamente con `NOW()`

### Tipos de documento (`IdTipoDocumento`)
- `1` = Venta
- `2` = Abono (pago a crédito; `DocumentoItem.IdDocumentoRef` → venta original)
- `3` = Gasto

### Tipos de movimiento de stock (`TipoMovimiento` en `ProductoMovimiento`)
```typescript
VENTA = 1, COMPRA = 2, FABRICACION = 3,
MERMA_DANO = 4, VENCIMIENTO = 5, INVENTARIO_FISICO = 6
```

### Triggers relevantes

| Trigger | Tabla | Efecto |
|---|---|---|
| `trg_actualizar_direccion_entrega` | `Documento` | Rellena `DireccionEntrega` desde `ClienteDireccion` |
| `trg_actualizar_saldo_total_abono` | `DocumentoItem` | Recalcula `TotalAbono` y `Saldo` en `Documento` al abonar |
| `trg_movimiento_stock` | `DocumentoItem` | Registra kardex y descuenta `Producto.Cantidad` al vender |
| `trg_audit_documento` | `Documento` | Escribe en `DocumentoAudit` en cada INSERT/UPDATE/DELETE |
| `trg_audit_documento_item` | `DocumentoItem` | Escribe en `DocumentoItemAudit` |

### RPCs (funciones Supabase)

| RPC | Uso |
|---|---|
| `crear_venta_con_items(p_documento, p_items, p_id_tenant, p_id_usuario_creacion)` | Crea venta + items atómicamente |
| `modificar_venta_con_items(p_id_documento, p_documento, p_items_to_soft_delete, p_items_to_update, p_items_to_add, p_id_tenant)` | Actualiza venta con diff de items |
| `generate_ticket_text(venta_id, width)` | Genera texto para impresora térmica |
| `fn_verificar_caja_abierta(p_id_tenant)` | Devuelve BOOLEAN si hay caja abierta |

---

## Patrones de arquitectura

### Flujo de datos

```
Browser → API Route (Next.js) → Service Layer → Supabase Client → PostgreSQL
```

El frontend **nunca habla directamente a Supabase** (excepto el login).
Todas las operaciones van por `/api/*`.

### Autenticación

1. `POST /api/auth/login` → valida usuario en `SistemaUsuario` con bcryptjs → emite JWT en cookie `httpOnly`
2. `src/middleware.ts` → verifica JWT en cada request protegido → redirige a `/login` si inválido
3. `lib/api-auth.ts` → `getAuthUser()` lee el JWT de la cookie en cada API route
4. `lib/auth-client.ts` → `getCurrentUser()` llama a `GET /api/auth/me` desde el cliente

### Roles disponibles
`ADMIN` | `CAJERO` | `VENDEDOR` | `COBRANZA` | `SUPERVISOR`

El `NavMenu` y `MobileNav` filtran ítems según el rol del usuario autenticado.

### Supabase — dos clientes distintos

| Archivo | Uso | Sesión |
|---|---|---|
| `lib/supabase.ts` | Solo login (frontend) | Con sesión |
| `lib/supabase-server.ts` | API routes (singleton lazy) | Sin sesión (`persistSession: false`) |

### Guardado de venta (POS)

1. `hooks/use-pos-transaction.ts` maneja todo el estado del POS (canasta, cliente, fecha, crédito)
2. Al guardar llama a `POST /api/ventas` (crear) o `PUT /api/ventas/[id]` (editar)
3. El API route llama a `documentoService.crearVentaConItems()` o `modificarVentaConItems()`
4. Estos usan RPCs atómicas en Supabase
5. Los triggers de la BD actualizan stock, saldo y auditoría automáticamente

### Patrón diff-based para master-detail

`documento-service.ts` y `cliente-service.ts` usan diff para actualizar relaciones:
- Calculan `toDelete`, `toUpdate`, `toAdd` comparando estado actual vs nuevo
- En documentos: vía parámetros RPC; en clientes: operaciones individuales Supabase

### Estado global (Zustand)

```typescript
// src/stores/app-store.ts
{
  filterTipo: string          // "Dia" | "Semana" | "Mes" | "Ano"
  filterFechaInicio: string   // "yyyy-MM-dd"
  filterFechaFin: string      // "yyyy-MM-dd"
  filterIndex: number         // índice del rango seleccionado
  refreshCounter: number      // incrementar para forzar recarga de listas
  authUser: AuthUser | null   // usuario autenticado actual
}
```

El filtro de fechas también se persiste en `sessionStorage` con la clave `"HistoryState"`.

---

## Convenciones de código

### Nombrado
- **PascalCase** para nombres de columnas DB y tipos TypeScript (`IdCliente`, `bCredito`, `FechaEmision`)
- **camelCase** para variables y funciones JS/TS
- Prefijo `b` para booleanos que vienen de la BD (`bCredito`, `bActual`, `bPrincipal`)

### Formato de moneda
```typescript
numToString(value)        // "$ 37.500" (N0, sin decimales)
numToString(value, "N2")  // "$ 37.500,00" (N2, con 2 decimales)
// Locale: es-ES, separador de miles = punto, decimal = coma
```

### Fechas
```typescript
fechaString(new Date(doc.FechaEmision))  // "22/05/26"
// FechaEmision en DB es tipo `date` (sin hora), string ISO "yyyy-MM-dd"
```

### Rutas de navegación

| Ruta | Propósito |
|---|---|
| `/` | Dashboard (ventas del día) |
| `/venta/nueva` | Nueva venta (redirect a `/venta-form/0`) |
| `/venta-form/[id]` | POS — `id=0` crear, `id>0` editar |
| `/venta-detalle/[id]` | Ver detalle de una venta |
| `/venta-abono` | Abonar a una deuda (`?id=clienteId&tipo=2`) |
| `/venta-gasto` | Registrar gasto (`?id=0` crear, `?id>0` editar) |
| `/deuda` | Lista de deudores |
| `/cliente` | Lista de clientes (`?select=true` activa modo selección) |
| `/cliente/datos/[id]` | Crear/editar cliente |
| `/producto` | Grid de inventario |
| `/producto/datos/[id]` | Crear/editar producto |
| `/producto/kardex/[id]` | Historial de stock de un producto |
| `/producto/ajustes` | Ajustes manuales de stock |
| `/caja` | Control de caja |
| `/configuracion` | Config del negocio |
| `/auditoria` | Auditoría de documentos |
| `/bluetoothprinter` | Config impresora |

---

## Componentes POS (`src/components/ventas/pos/`)

El flujo del POS en `/venta-form/[id]` usa estos componentes orquestados por `use-pos-transaction.ts`:

```
VentaFormPage
├── ProductSearch          ← grid de productos + búsqueda + FAB "ver canasta"
│   └── (items del catálogo)
└── Sheet (CartSheet)
    └── CartSummary        ← items en canasta, totales, forma de pago, fecha, guardar
        ├── CartItemDetailSheet ← editar cantidad/precio de un item
        └── ClientSelector ← buscar y asignar cliente a la venta
```

`ProductQuickCreate` es un Sheet adicional para crear un producto nuevo sin salir del POS.

---

## Componentes shared reutilizables

| Componente | Props clave |
|---|---|
| `LoadingState` | `variant: "skeleton-list" \| "skeleton-cards" \| "skeleton-form"`, `count` |
| `EmptyState` | `icon?`, `title`, `description` |
| `StatusBadge` | `variant: "success" \| "error" \| "info" \| "warning"` |
| `SearchInput` | `value`, `onChange`, `debounceMs`, `placeholder` |
| `PageHeader` | `title`, `backHref?`, `breadcrumbs?`, `actions?` |

---

## Scripts

```bash
npm run dev     # servidor de desarrollo en http://localhost:3000
npm run build   # build de producción
npm run start   # iniciar servidor de producción
npm run lint    # ESLint
```

No hay tests automatizados en el proyecto.
