# Auditoria Tecnica - Comercia Web POS

**Fecha:** 2026-05-09
**Proyecto:** Comercia Web (Next.js POS)
**Rama:** master
**Base:** Migracion desde .NET MAUI Blazor Hybrid

---

## 1. Estructura de Datos

### 1.1 Entidades Principales y Relaciones

```
SistemaTenant (1) ──< SistemaUsuario (N)
     |
     └─── Filtra todas las tablas de negocio via IdTenant

Cliente (1) ──< ClienteDireccion (N)
     |               └── bPrincipal (direccion principal)
     |
     └───< Documento (N)  (IdCliente FK)
               |
               ├──< DocumentoItem (N)  (IdDocumento FK, CASCADE)
               |        └── IdProducto FK → Producto
               |        └── IdDocumentoRef (referencia a otro documento para abonos)
               |
               ├── IdMetodoPago FK → MetodoPago
               └── IdClienteDireccion FK → ClienteDireccion

Producto (1) ──< ProductoMovimiento (N)  [Kardex]
                      └── IdDocumento FK → Documento

Caja (1 registro por apertura)
     ├── IdUsuarioApertura FK → SistemaUsuario
     └── IdUsuarioCierre FK → SistemaUsuario

Negocio (1 fila, config global del negocio)

DocumentoAudit / DocumentoItemAudit (logs de auditoria)
     └── DataOld/DataNew como jsonb
```

### 1.2 Tipos de Documento (campo IdTipoDocumento)

| Valor | Tipo | Descripcion |
|-------|------|-------------|
| 1 | Venta | Registro de venta con items |
| 2 | Abono | Pago parcial sobre venta a credito |
| 3 | Gasto | Registro de gasto operativo |

### 1.3 Tipos de Movimiento Kardex (campo TipoMovimiento)

| Valor | Tipo | Descripcion |
|-------|------|-------------|
| 1 | Entrada | Compra / ingreso de stock |
| 2 | Salida | Venta (trigger auto) |
| 3 | Ajuste (+) | Ajuste positivo |
| 4 | Ajuste (-) | Ajuste negativo |
| 5 | Devolucion | Devolucion sobre venta |

### 1.4 Triggers y Funciones de BD

| Trigger | Tabla | Funcion | Efecto |
|---------|-------|---------|--------|
| `trg_movimiento_stock` | DocumentoItem (AFTER INSERT) | `fn_registrar_movimiento_stock()` | Si el Documento es tipo 1 (venta) y Estado=1: inserta ProductoMovimiento (salida) y decrementa Producto.Cantidad |
| `trg_actualizar_saldo` | DocumentoItem (UPDATE) | `fn_actualizar_saldo_total_abono()` | Actualiza Documento.Saldo y Documento.TotalAbono al modificar items de abono |
| `trg_audit_documento` | Documento | `fn_audit_documento()` | Inserta en DocumentoAudit con DataOld/DataNew (jsonb) |
| `trg_audit_documento_item` | DocumentoItem | `fn_audit_documento_item()` | Inserta en DocumentoItemAudit con DataOld/DataNew (jsonb) |

### 1.5 Convencion de Nombres en BD

- Columnas: **PascalCase** (ej: `IdCliente`, `bCredito`, `FechaCreacion`)
- Prefijo `b` para booleanos (ej: `bCredito`, `bPrincipal`)
- Prefijo `Id` para FKs (ej: `IdCliente`, `IdProducto`)
- Tablas: **PascalCase** sin prefijo (ej: `Documento`, `ClienteDireccion`)
- Soft delete: campo `Estado` (1 = activo, 0 = eliminado)

---

## 2. Arquitectura de Software

### 2.1 Estructura de Carpetas

```
src/
├── app/                          # Next.js App Router (paginas + API routes)
│   ├── api/                      # Backend API routes
│   │   ├── auth/                  # Login, logout, me (JWT cookie)
│   │   ├── ventas/                # CRUD ventas + eliminadas
│   │   ├── abonos/                # Registro de abonos
│   │   ├── gastos/                # CRUD gastos
│   │   ├── clientes/              # CRUD clientes
│   │   ├── productos/             # CRUD productos
│   │   ├── caja/                  # Apertura/cierre de caja
│   │   ├── deudas/                # Consulta deudas
│   │   ├── metodo-pago/           # Lectura metodos de pago
│   │   ├── negocio/               # Config negocio
│   │   ├── auditoria/             # Consulta logs auditoria
│   │   ├── kardex/                # Movimientos de stock
│   │   └── ticket/                # Generacion texto ticket (RPC)
│   ├── venta/                     # Dashboard principal (ventas del dia)
│   ├── venta-form/[id]/           # Crear/editar venta (POS)
│   ├── venta-detalle/[id]/        # Detalle de venta
│   ├── venta-abono/               # Registrar abono
│   ├── venta-gasto/               # Registrar gasto
│   ├── venta-eliminadas/          # Papelera de ventas
│   ├── cliente/                   # Lista de clientes (modo seleccion)
│   ├── cliente/datos/[id]/        # Crear/editar cliente
│   ├── producto/                  # Lista de productos
│   ├── producto-form/             # Crear/editar producto
│   ├── deuda/                     # Deudas por cliente
│   ├── caja/                      # Control de caja
│   ├── configuracion/             # Config negocio
│   ├── auditoria/                 # Logs de auditoria
│   ├── login/                     # Autenticacion
│   └── bluetoothprinter/          # Test impresora Bluetooth
├── components/
│   ├── layout/                    # AppShell, NavMenu, MobileNav
│   ├── shared/                    # PageHeader, SearchInput, EmptyState, etc.
│   ├── ventas/                    # BalanceCards, DateFilterBar, VentaListItem
│   └── ui/                        # 27 componentes shadcn/ui (Base UI)
├── hooks/
│   └── use-bluetooth-printer.ts   # Hook para impresora Bluetooth
├── lib/
│   ├── supabase.ts                # Cliente Supabase (anon key, frontend)
│   ├── supabase-server.ts         # Cliente Supabase server (singleton lazy)
│   ├── api-client.ts              # Helper HTTP (apiGet, apiPost, apiPut, apiDelete)
│   ├── api-auth.ts                # Extraer usuario JWT del request
│   ├── auth-client.ts             # Obtener usuario actual (client-side)
│   ├── jwt.ts                     # Crear/verificar tokens (jose, HS256)
│   ├── password.ts                # Hash/verify bcryptjs
│   ├── format.ts                  # Formateo numeros/fechas (es-ES)
│   ├── date-utils.ts              # Rangos de fechas para filtros
│   ├── bluetooth-printer.ts       # Servicio Web Bluetooth + ESC/POS
│   ├── theme.ts                   # Tokens de diseno
│   └── utils.ts                   # cn() helper
├── services/
│   ├── supabase-service.ts        # CRUD generico (getAll, getById, add, update, deleteItem)
│   ├── documento-service.ts       # Ventas con items (diff-based save)
│   ├── cliente-service.ts         # Clientes con direcciones (diff-based save)
│   ├── producto-service.ts        # CRUD simple productos
│   ├── caja-service.ts            # Apertura/cierre caja
│   ├── negocio-service.ts         # Config negocio
│   ├── kardex-service.ts          # Movimientos stock
│   ├── auditoria-service.ts       # Logs auditoria
│   └── usuario-service.ts         # Busqueda/validacion usuarios (usa supabase.ts frontend!)
├── stores/
│   └── app-store.ts               # Zustand store (filtros + carrito + auth)
├── types/
│   └── database.ts                # Interfaces TypeScript (PascalCase)
└── middleware.ts                  # Proteccion rutas con JWT
```

### 2.2 Conexion a Supabase

| Aspecto | Detalle |
|---------|---------|
| **Cliente Frontend** | `src/lib/supabase.ts` - `createClient()` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Solo lo usa `usuario-service.ts` para login. |
| **Cliente Server** | `src/lib/supabase-server.ts` - Singleton lazy con `autoRefreshToken: false` y `persistSession: false`. Lo usan todas las API routes. |
| **Patron** | Frontend **nunca** habla directo con Supabase. Todo pasa por API routes (`/api/*`). |
| **Auth** | JWT custom (`jose`, HS256) en cookie httpOnly `token`. No usa Supabase Auth. |
| **Multitenancy** | Todas las queries filtran por `IdTenant` extraido del JWT. |

### 2.3 Manejo de Estado en Frontend

| Aspecto | Implementacion |
|---------|---------------|
| **Estado global** | Zustand (`app-store.ts`) - store unico con filtros, carrito y auth |
| **Filtros** | `filterTipo`, `filterFechaInicio`, `filterFechaFin`, `filterIndex` - persistidos en `sessionStorage` por cada pagina |
| **Carrito (basket)** | `basketItems`, `basketClient`, `basketClientDireccion`, `basketIsCredit`, `basketFecha` |
| **Refresh** | `refreshCounter` - patron observer: se incrementa y los componentes re-fetch |
| **Draft persistencia** | `venta-form` usa `sessionStorage` key `ventaDraft` para preservar carrito al navegar a seleccion de cliente |
| **No cache** | No hay cache de datos del servidor. Cada navegacion re-fetch via `apiGet`. |

### 2.4 Flujo de Autenticacion

```
1. POST /api/auth/login { codigo, password }
   ├── usuario-service.findByCodigo(codigo)
   ├── usuario-service.validateLogin(codigo, password) → bcryptjs.verify
   ├── jwt.createToken({ id, codigo, nombre, rol, idTenant })
   └── Set-Cookie: token=<jwt>; HttpOnly; Max-Age=28800; Path=/

2. middleware.ts en cada request:
   ├── Lee cookie "token"
   ├── jwt.verifyToken(token)
   ├── Si invalido → API: JSON 401, Page: redirect /login
   └── Si valido → continua

3. API routes:
   ├── getCurrentUserFromRequest(req) → lee JWT de cookie
   ├── requireAuth(user) → lanza 401 si null
   └── requireRole(user, [...roles]) → lanza 403 si no tiene rol
```

### 2.5 Patron API Route (ejemplo tipico)

```typescript
// Cada API route sigue este patron:
export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  requireAuth(user);
  // ... usar user.idTenant para filtrar
  const data = await service.getAll(user.idTenant);
  return NextResponse.json({ data });
}
```

---

## 3. Flujo de Usuario Actual

### 3.1 Registrar una Venta

```
Pantalla: / (Dashboard) → Click "Nueva Venta"
        ↓
Pantalla: /venta-form/0 (crear) o /venta-form/{id} (editar)
        │
        ├── Fase 1: Seleccion de productos
        │   ├── Buscar productos (search input)
        │   ├── Click en producto → agregar al basket
        │   ├── Editar cantidad/precio en basket
        │   └── Total calculado automaticamente
        │
        ├── Fase 2: Datos de la venta
        │   ├── Seleccionar cliente → navega a /cliente?select=true
        │   │   └── Al seleccionar, setea basketClient en Zustand y vuelve
        │   ├── Seleccionar direccion de entrega (si cliente tiene direcciones)
        │   ├── Toggle credito/efectivo
        │   ├── Seleccionar metodo de pago
        │   └── Seleccionar fecha
        │
        ├── Validacion: Caja abierta (GET /api/caja)
        │
        └── Guardar:
            ├── POST /api/ventas (nueva) o PUT /api/ventas/{id} (editar)
            ├── documento-service.crearVentaConItems()
            │   ├── INSERT Documento
            │   ├── INSERT DocumentoItem[] (con rollback si falla)
            │   └── TRIGGER trg_movimiento_stock → decrementa stock
            ├── Limpiar basket (Zustand)
            └── Redirect a /
```

**Componentes UI involucrados:**
- `src/app/venta/page.tsx` - Dashboard con BalanceCards + lista
- `src/app/venta-form/[id]/page.tsx` - Formulario POS completo (502 lineas)
- `src/components/ventas/balance-cards.tsx` - Tarjetas de resumen financiero
- `src/components/ventas/date-filter-bar.tsx` - Barra de filtros de fecha
- `src/components/ventas/venta-list-item.tsx` - Item individual de venta
- Zustand store para basket y filtros

### 3.2 Agregar un Cliente Nuevo

```
Pantalla: /cliente → Click "Nuevo Cliente"
        ↓
Pantalla: /cliente/datos/0 (crear)
        │
        ├── Tab "Datos"
        │   ├── Nombre (requerido)
        │   ├── NroTelefono
        │   ├── TipoDocumento (select)
        │   ├── NroDocumento
        │   └── Comentario
        │
        ├── Tab "Direcciones"
        │   ├── Agregar direccion: Direccion, Telefono, Contacto, bPrincipal
        │   ├── Editar direccion existente
        │   └── Eliminar direccion
        │
        └── Guardar:
            ├── POST /api/clientes (nuevo) o PUT /api/clientes/{id} (editar)
            ├── cliente-service.saveClienteConDirecciones()
            │   ├── INSERT/UPDATE Cliente
            │   └── Diff de ClienteDireccion (insert/update/delete)
            └── Si venia de seleccion → set basketClient + redirect

Modo seleccion (/cliente?select=true):
    └── Al hacer click en un cliente → setBasketClient en Zustand
        → redirect a la URL de retorno (venta-form, etc.)
```

**Componentes UI involucrados:**
- `src/app/cliente/page.tsx` - Lista con modo seleccion
- `src/app/cliente/datos/[id]/page.tsx` - Formulario master-detail
- Zustand store para basketClient

---

## 4. Stack Tecnologico

| Tecnologia | Version | Detalle |
|------------|---------|---------|
| **Next.js** | 16.2.4 | App Router, React Server Components |
| **React** | 19.2.4 | Concurrent features, Suspense |
| **TypeScript** | ^5 | Strict mode |
| **Tailwind CSS** | ^4 | Utility-first CSS |
| **shadcn/ui** | ^4.6.0 (CLI) | Componentes UI - usa **Base UI** (NO Radix) |
| **@base-ui/react** | ^1.4.1 | Primitivas Base UI (shadcn v4) |
| **Zustand** | ^5.0.13 | Estado global |
| **@supabase/supabase-js** | ^2.105.3 | Cliente Supabase |
| **jose** | ^6.2.3 | JWT signing/verification |
| **bcryptjs** | ^3.0.3 | Hash de passwords |
| **date-fns** | ^4.1.0 | Utilidades de fecha |
| **framer-motion** | ^12.38.0 | Animaciones |
| **lucide-react** | ^1.14.0 | Iconos |
| **next-themes** | ^0.4.6 | Tema claro/oscuro |
| **cmdk** | ^1.1.1 | Command palette |
| **react-day-picker** | ^9.14.0 | Calendario |
| **sonner** | ^2.0.7 | Toast notifications |
| **class-variance-authority** | ^0.7.1 | Variantes de componentes |
| **tailwind-merge** | ^3.5.0 | Merge de clases Tailwind |
| **clsx** | ^2.1.1 | Conditional clases |

**Nota importante:** shadcn/ui v4 usa **Base UI** como primitiva, NO Radix. El prop `asChild` **no debe usarse** en ningun componente.

---

## 5. Puntos Criticos

### 5.1 Logica de BD Mezclada con Componentes UI

**Severidad: Alta**

El archivo `venta-form/[id]/page.tsx` tiene **502 lineas** con:
- Logica de carga de productos desde API
- Logica de calculo de totales y subtotales
- Logica de validacion de caja abierta
- Manejo de draft en sessionStorage
- Comunicacion con Zustand para basket
- Comunicacion con API routes para guardar
- Renderizado completo de UI (grilla de productos, basket, formularios)

No hay separacion entre logica de negocio y presentacion. Un custom hook o servicio frontend podria encapsular la logica del carrito.

### 5.2 Auth con Cliente Frontend Supabase

**Severidad: Alta**

`usuario-service.ts` usa el cliente Supabase **frontend** (`src/lib/supabase.ts`) con anon key. Esto significa:
- La tabla `SistemaUsuario` es accesible con la anon key de Supabase
- Los hashes de password estan protegidos solo por RLS (si esta configurado)
- El login no pasa por API route sino por el cliente directo

**Riesgo:** Si RLS no esta configurado correctamente en `SistemaUsuario`, cualquier usuario anonimo podria leer los hashes de password.

### 5.3 Sin Transacciones en Master-Detail

**Severidad: Media**

`documento-service.ts` y `cliente-service.ts` implementan el patron diff-based (comparar items actuales vs nuevos para determinar insert/update/delete) **sin transacciones** de BD:

```typescript
// crearVentaConItems - rollback manual
const { data, error } = await supabase.from("Documento").insert(ventaNoId)...;
if (error) throw ...;
// Si falla el insert de items, hace delete manual del padre
await deleteItem(TABLE, idReturn);
```

Si la aplicacion falla entre el INSERT del Documento y el INSERT de los Items, el registro padre queda huerfano. El rollback manual es una aproximacion pero no garantiza consistencia en escenarios de concurrencia.

### 5.4 Patron Refresh Manual (Sin Cache)

**Severidad: Media**

No hay cache de datos del servidor. Cada navegacion dispara un nuevo `apiGet`. El patron de refresh es manual:

```typescript
useAppStore.getState().triggerRefresh(); // incrementa counter
// Los componentes dependen de refreshCounter en su useEffect para re-fetch
```

Esto genera:
- Refetch innecesario al navegar entre paginas
- No hay optimistica updates (el usuario ve loading en cada accion)
- Potencial UX lenta en conexiones debiles

### 5.5 Tipado PascalCase vs JavaScript camelCase

**Severidad: Media-Baja**

Las interfaces en `database.ts` usan PascalCase (`IdCliente`, `bCredito`, `FechaCreacion`) para coincidir con las columnas de Supabase. Esto rompe la convencion de JavaScript/TypeScript (camelCase) y genera friccion cognitiva para desarrolladores nuevos en el proyecto. Sin embargo, mantener este patron es pragmatico porque evita mapeos manuales entre la BD y el frontend.

### 5.6 Componentes UI Monoliticos

**Severidad: Media**

- `venta-form/[id]/page.tsx` (502 lineas) - todo el flujo POS en un componente
- `venta-abono/page.tsx` - logica de abono tipo 1 y tipo 2 en un solo componente
- `deuda/page.tsx` - dos vistas completamente distintas (resumen y detalle) en un componente

Estos componentes manejan estado, efectos, llamadas API y renderizado sin separacion de responsabilidades.

### 5.7 API Routes con Logica Duplicada

**Severidad: Baja-Media**

Varias API routes repiten patrones similares:
- Verificacion de auth (`getCurrentUserFromRequest` + `requireAuth`)
- Filtro de tenant (`user.idTenant`)
- Manejo de errores (try/catch con `NextResponse.json({ error }, { status })`)
- Algunas routes llaman directamente a Supabase en vez de usar el service layer

No hay un middleware o wrapper que centralice auth+tenant+error handling a nivel de API route.

### 5.8 sessionStorage para Drafts

**Severidad: Baja**

`venta-form` usa `sessionStorage` con key `ventaDraft` para preservar el carrito al navegar a seleccion de cliente. Este patron es fragil:
- Se limpia al cerrar el navegador
- No hay sincronizacion entre tabs
- La serializacion/deserializacion es manual

### 5.9 Hardcoded de Secret JWT

**Severidad: Alta**

En `src/lib/jwt.ts`:
```typescript
const secret = process.env.JWT_SECRET_KEY || "comercia-default-secret-key-change-me";
```

Si la variable de entorno no esta configurada, el JWT usa un secreto por defecto que es conocido por cualquier persona que lea el codigo fuente. Esto permite falsificar tokens.

### 5.10 Impresion Bluetooth Incompleta

**Severidad: Baja**

La pagina de detalle de venta muestra un toast "Impresion Bluetooth no disponible en esta version" en vez de usar el hook `use-bluetooth-printer` que ya existe. La pagina `/bluetoothprinter` es un test/debug pero no esta integrada en el flujo principal.

---

## 6. Resumen de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19)                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────┐  │
│  │  Pages    │  │ Components│  │  Zustand  │  │  api-client   │  │
│  │ (App      │──│ (layout/  │  │  Store    │  │  (fetch wrap) │  │
│  │  Router)  │  │  shared/) │  │  (state)  │  │               │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────┬───────┘  │
│                                                       │          │
│  middleware.ts ── JWT verify ──┐                       │          │
│                                │                       │          │
└────────────────────────────────┼───────────────────────┼──────────┘
                                 │                       │
┌────────────────────────────────┼───────────────────────┼──────────┐
│                        API ROUTES (Next.js)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │          │
│  │   Auth   │  │  Ventas   │  │ Clientes │            │          │
│  │ (login/  │  │  Gastos   │  │ Productos│            │          │
│  │  logout) │  │  Abonos   │  │  Caja    │            │          │
│  └──────────┘  └──────────┘  └──────────┘            │          │
│       │              │             │                   │          │
│  api-auth.ts ── JWT verify ── requireRole             │          │
│       │              │             │                   │          │
└───────┼──────────────┼─────────────┼───────────────────┼──────────┘
        │              │             │                   │
        │     ┌────────┴─────────────┴───────────────┐   │
        │     │        SERVICE LAYER                  │   │
        │     │  documento-service (diff-based save)  │   │
        │     │  cliente-service (diff-based save)    │   │
        │     │  producto-service (simple CRUD)       │   │
        │     │  caja-service, negocio-service, etc.  │   │
        │     └────────────────┬──────────────────────┘   │
        │                      │                           │
        │              ┌──────┴──────┐                    │
        │              │  Supabase    │◄───────────────────┘
        │              │  Server      │   (anon key, no auth session)
        │              │  Client      │
        │              └──────┬──────┘
        │                     │
        │              ┌──────┴──────┐
        │              │ PostgreSQL   │
        │              │ (Supabase)  │
        │              │             │
        │              │ Triggers:   │
        │              │ - Stock     │
        │              │ - Saldo     │
        │              │ - Auditoria │
        │              └─────────────┘
        │
   ┌────┴────┐
   │  JWT    │  (jose, HS256, cookie httpOnly)
   │  Auth   │  SistemaUsuario table, bcryptjs
   └─────────┘
```

---

*Fin del informe de auditoria tecnica.*