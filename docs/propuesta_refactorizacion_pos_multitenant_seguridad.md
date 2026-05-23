# Propuesta de Refactorización — Comercia Web POS (Multitenant + Seguridad)

**Fecha**: 2026-05-05
**Autor**: Análisis Senior Fullstack
**Estado del esquema**: PostgreSQL 15.8 con triggers, auditoría automática y lógica de saldo en BD.

---

## 1. Objetivo

Transformar la aplicación actual en una plataforma POS moderna, escalable y multiempresa (multitenant), manteniendo la base de datos y lógica PostgreSQL que ya funciona, enfocada en:

- Ventas contado y crédito
- Control de deudas
- Clientes con múltiples direcciones
- Control de pagos
- Gestión de caja
- Seguridad y autenticación
- Roles y permisos
- Auditoría visible
- Trazabilidad de stock

---

## 2. Hallazgos del Esquema PostgreSQL Real

Tras analizar `db_only_squema.sql`, el esquema es más maduro de lo que refleja el código frontend.

### 2.1 Tablas descubiertas no mapeadas en el frontend

| Tabla | Uso real | Estado en frontend |
|-------|----------|-------------------|
| **`Negocio`** | Configuración del comercio (nombre, dirección, teléfono, logo). `generate_ticket_text` la usa como encabezado del ticket. | **Sin UI** |
| **`DocumentoAudit`** | Auditoría automática de INSERT/UPDATE/DELETE en `Documento` via trigger `fn_audit_documento()`. Captura `DataOld` y `DataNew` como `jsonb`. | **Sin UI** |
| **`DocumentoItemAudit`** | Auditoría automática de `DocumentoItem` via trigger `fn_audit_documento_item()`. | **Sin UI** |

### 2.2 Triggers y funciones existentes

| Nombre | Tipo | Qué hace |
|--------|------|----------|
| `actualizar_direccion_entrega()` | **Trigger BEFORE** | Al insertar/actualizar `Documento`, copia `Direccion` de `ClienteDireccion` a `Documento.DireccionEntrega`. |
| `fn_actualizar_saldo_total_abono()` | **Trigger AFTER** | Al insertar/eliminar/actualizar `DocumentoItem` con `IdDocumentoRef > 0`, recalcula `TotalAbono = SUM(MontoAbono)` y `Saldo = Total - TotalAbono`. |
| `actualizar_saldo_total_abono(id)` | **Procedimiento** | Fuerza recálculo manual de saldo/abono. |
| `fn_audit_documento()` | **Trigger AFTER** | INSERT/UPDATE/DELETE en `Documento` → inserta en `DocumentoAudit` con `to_jsonb()`. |
| `fn_audit_documento_item()` | **Trigger AFTER** | INSERT/UPDATE/DELETE en `DocumentoItem` → inserta en `DocumentoItemAudit`. |
| `generate_ticket_text(id, width)` | **Función** | Genera texto ESC/POS. Lee `Negocio` (encabezado) + `Documento`/`DocumentoItem` + `Cliente`. |
| `centertext(text, width)` | **Utilidad** | Centra texto con padding de espacios. |

### 2.3 Implicaciones clave

1. **Auditoría ya existe a nivel de BD**: La propuesta anterior decía "no hay auditoría". El esquema real tiene `DocumentoAudit` e `DocumentoItemAudit` llenándose automáticamente via triggers. Solo falta exponerla en UI.

2. **El saldo es calculado por trigger**: `fn_actualizar_saldo_total_abono()` recalcula `TotalAbono` y `Saldo` automáticamente. El frontend **no necesita** calcular ni persistir el saldo manualmente.

3. **`DireccionEntrega` se copia automáticamente**: El trigger `actualizar_direccion_entrega` la extrae de `ClienteDireccion`. El frontend no necesita enviarla explícitamente si envía `IdClienteDireccion`.

4. **`Negocio` es la tabla de configuración del comercio**: Sin UI para editarla, los tickets impresos no se personalizan.

5. **`id` es `bigint` en PostgreSQL**: Aunque Supabase serializa como `number`, si se va a multitenant los IDs se repetirán entre tenants. Recomendar cambio a `uuid` o `serial` con prefijo de tenant.

---

## 3. Problemas Detectados

## 3.1 Acceso directo a Supabase desde frontend

Actualmente el frontend accede directamente a Supabase usando anon key.

Problemas:

- Exposición de estructura de BD
- Riesgo de manipulación de datos
- Difícil aplicar seguridad real
- No existe validación centralizada
- Lógica duplicada en frontend
- Difícil escalar a multitenant

## 3.2 Lógica de negocio mezclada con UI

Ejemplos:

- Cálculo de saldos (aunque el trigger PostgreSQL ya lo hace, el frontend también calcula para mostrar)
- Distribución de abonos (algoritmo de reparto en el frontend)
- Reglas de negocio
- Control de stock (sin movimientos, solo un número)

## 3.3 No existe capa de seguridad

Actualmente:

- No hay autenticación
- No hay autorización
- No hay roles
- No hay sesiones controladas
- La auditoría de BD existe pero no es visible al usuario

## 3.4 No existe multitenancy

La estructura actual no permite múltiples negocios, tiendas ni separación de información.

---

## 4. Arquitectura Recomendada (Pragmática)

## 4.1 Principio rector

> **No reescribir lo que ya funciona. Agregar una puerta de seguridad, no un edificio nuevo.**

El esquema PostgreSQL ya tiene:
- Triggers de saldo funcionales
- Auditoría automática
- Copia automática de direcciones
- Generación de tickets

Mover todo a un backend NestJS sería tirar código probado a la basura.

## 4.2 Arquitectura propuesta

```text
┌─────────────────────────────────────────────┐
│  Frontend (Next.js 16 + App Router)         │
│  - UI con shadcn/ui                          │
│  - Estado con Zustand                        │
│  - NO accede directamente a Supabase         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Next.js API Routes (capa de seguridad)    │
│  - Validación JWT (Supabase Auth)          │
│  - Inyección de IdTenant                   │
│  - Validación de permisos                  │
│  - Lógica de negocio no en triggers        │
│    se mantiene en PostgreSQL               │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Supabase Client (service role key)        │
│  - Solo en servidor (API Routes)             │
│  - Acceso completo a PostgreSQL             │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  PostgreSQL 15                               │
│  - Triggers de saldo (mantener)             │
│  - Auditoría automática (mantener)           │
│  - RLS opcional por tenant                   │
└─────────────────────────────────────────────┘
```

### ¿Por qué Next.js API Routes en vez de NestJS?

| Aspecto | Next.js API Routes | NestJS |
|---------|-------------------|--------|
| **Tiempo de desarrollo** | Semanas | Meses |
| **Reutilización de código** | Servicios existentes se migran con copy-paste mínimo | Reescritura completa |
| **Auth** | Supabase Auth nativo (gratis, integrado) | Implementar JWT custom + bcrypt |
| **Deploy** | Vercel (ya funciona) | Necesita servidor/VPS/EC2 |
| **Operaciones** | Un equipo, un repo | Dos repos, dos deploys |
| **Escalabilidad** | Suficiente para 5-50 tenants | Necesario solo si >100 tenants con alta carga |

**Veredicto**: NestJS es técnicamente correcto pero operacionalmente suicida para la etapa actual. Evaluarlo solo cuando haya 50+ negocios pagando.

---

## 5. Stack Tecnológico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Frontend | Next.js 16 + TypeScript | App Router, mantener |
| UI | Tailwind CSS v4 + shadcn/ui (Base UI) | Mantener, ya modernizado |
| **Capa API** | **Next.js API Routes** | Nuevo. Reemplaza acceso directo a Supabase |
| **Auth** | **Supabase Auth** | Email/password, magic links, OAuth. No reinventar |
| DB | PostgreSQL (via Supabase) | Mantener triggers existentes |
| **ORM/Cliente** | **@supabase/supabase-js (service role)** | En API Routes, no en frontend |
| Estado | Zustand v5 | Mantener |
| Validación | Zod | Para validar inputs en API Routes |
| **Storage** | **Supabase Storage** | Para logo de negocio, documentos |

**Eliminados de la propuesta original**:
- ❌ NestJS (reemplazado por Next.js API Routes)
- ❌ Prisma ORM (no necesario, Supabase client es suficiente)
- ❌ Redis (overkill, PostgreSQL con índices es suficiente)
- ❌ Docker/Kubernetes (Vercel + Supabase ya funciona)
- ❌ App móvil nativa (web responsive/PWA es 10x más barato)

---

## 6. Auth y Seguridad

## 6.1 Supabase Auth (recomendado)

En vez de implementar JWT custom y bcrypt, usar Supabase Auth nativo:

```
Login (email + password)
  ↓
Supabase Auth valida
  ↓
Genera JWT (Supabase)
  ↓
Frontend almacena token en cookie httpOnly
  ↓
Cada request a /api/* envía token
  ↓
API Route valida JWT con supabase.auth.getUser()
  ↓
Obtiene IdTenant del usuario autenticado
  ↓
Inyecta IdTenant en cada query a PostgreSQL
```

### Tabla de usuarios

No crear `SistemaUsuario` con `PasswordHash` propio. En su lugar, extender `auth.users` de Supabase:

```sql
CREATE TABLE SistemaPerfil (
    Id UUID PRIMARY KEY REFERENCES auth.users(id),
    IdTenant BIGINT NOT NULL,
    Codigo VARCHAR(50) NOT NULL,
    Nombre VARCHAR(200) NOT NULL,
    Rol VARCHAR(50) NOT NULL DEFAULT 'CAJERO',
    Estado SMALLINT NOT NULL DEFAULT 1,
    FechaCreacion TIMESTAMP NOT NULL DEFAULT NOW()
);
```

Ventajas:
- No gestionar passwords
- Reset de password gratis
- Magic links
- OAuth (Google, etc.)
- Row Level Security opcional

## 6.2 Roles del Sistema

| Rol | Acceso |
|---|---|
| ADMIN | Acceso total: configura tenant, usuarios, caja, reportes |
| CAJERO | Ventas, pagos, abonos. NO anular ni eliminar |
| VENDEDOR | Ventas solamente. No accede a caja ni deudas |
| COBRANZA | Gestión de deudas, abonos. No ventas |
| SUPERVISOR | Reportes, auditoría, anulaciones. No ventas directas |

## 6.3 Permisos

Implementar en API Routes:

```typescript
// middleware/check-role.ts
export function requireRole(roles: string[]) {
  return async (req: NextRequest) => {
    const user = await getUserFromToken(req);
    const perfil = await getPerfil(user.id);
    if (!roles.includes(perfil.Rol)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    // Inyecta IdTenant en el request para las queries
    req.headers.set("x-tenant-id", perfil.IdTenant.toString());
  };
}
```

**Nota sobre RLS**: Aunque la instrucción original dice "no usar políticas de base de datos", se recomienda **reconsiderar** un RLS mínimo:

```sql
CREATE POLICY tenant_isolation ON Documento
  USING (IdTenant = current_setting('app.current_tenant')::bigint);
```

Esto actúa como red de seguridad si un API route olvida el `WHERE IdTenant = ...`. El middleware de API route ejecutaría `SET LOCAL app.current_tenant = ?` antes de cada query.

---

## 7. Multitenant

## 7.1 Estrategia: Shared Database + IdTenant

Todas las tablas de negocio llevarán `IdTenant`:

```sql
ALTER TABLE Producto ADD COLUMN IdTenant BIGINT NOT NULL DEFAULT 1;
ALTER TABLE Cliente ADD COLUMN IdTenant BIGINT NOT NULL DEFAULT 1;
ALTER TABLE ClienteDireccion ADD COLUMN IdTenant BIGINT NOT NULL DEFAULT 1;
ALTER TABLE Documento ADD COLUMN IdTenant BIGINT NOT NULL DEFAULT 1;
ALTER TABLE DocumentoItem ADD COLUMN IdTenant BIGINT NOT NULL DEFAULT 1;
ALTER TABLE MetodoPago ADD COLUMN IdTenant BIGINT NOT NULL DEFAULT 1;
ALTER TABLE Negocio ADD COLUMN IdTenant BIGINT NOT NULL DEFAULT 1;
```

### Tabla SistemaTenant

```sql
CREATE TABLE SistemaTenant (
    Id BIGSERIAL PRIMARY KEY,
    Codigo VARCHAR(50) NOT NULL UNIQUE,
    Nombre VARCHAR(200) NOT NULL,
    Estado SMALLINT NOT NULL DEFAULT 1,
    FechaCreacion TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Migración de IDs a UUID (recomendado)

Los IDs actuales son `bigint`. Para evitar colisiones entre tenants y facilitar backup/restore:

```sql
-- Para nuevas tablas o tablas con pocos registros
ALTER TABLE Producto ALTER COLUMN id SET DATA TYPE UUID USING gen_random_uuid();
```

**Alternativa pragmática**: Mantener `bigint` con `IdTenant` como composite key lógico. El API route siempre filtra por ambos.

---

## 8. Refactorización de Base de Datos

### 8.1 Tablas que ya existen y se mantienen

| Tabla | Cambios necesarios |
|-------|-------------------|
| `Producto` | Agregar `IdTenant`, `Estado SMALLINT DEFAULT 1`. Opcional: `LimiteStockMinimo`. |
| `Cliente` | Agregar `IdTenant`, `Estado SMALLINT DEFAULT 1`, `LimiteCredito NUMERIC(18,2) DEFAULT 0`. |
| `ClienteDireccion` | Agregar `IdTenant`. Cambiar `bPrincipal` a `EsPrincipal`. |
| `Documento` | Agregar `IdTenant`, `IdUsuarioCreacion`, `Estado SMALLINT DEFAULT 1`. Cambiar `IdCliente` a nullable (hoy `0` significa "sin cliente"). |
| `DocumentoItem` | Agregar `IdTenant`. |
| `MetodoPago` | Agregar `IdTenant`. |
| `Negocio` | Agregar `IdTenant`. Ya existe pero no tiene UI en el frontend. |
| `DocumentoAudit` | Agregar `IdTenant`, `IdUsuario`. Ya funciona via trigger. |
| `DocumentoItemAudit` | Agregar `IdTenant`, `IdUsuario`. Ya funciona via trigger. |

### 8.2 Nuevas tablas

#### FormaPago (catálogo)

Reemplaza/amplía `MetodoPago`:

```sql
CREATE TABLE FormaPago (
    Id SMALLSERIAL PRIMARY KEY,
    IdTenant BIGINT NOT NULL DEFAULT 1,
    Nombre VARCHAR(50) NOT NULL,
    Orden SMALLINT DEFAULT 0,
    Estado SMALLINT DEFAULT 1
);

-- Datos iniciales por tenant
INSERT INTO FormaPago (Nombre, Orden) VALUES
('EFECTIVO', 1),
('TRANSFERENCIA', 2),
('YAPE', 3),
('QR', 4),
('TARJETA', 5);
```

#### Caja

```sql
CREATE TABLE Caja (
    Id BIGSERIAL PRIMARY KEY,
    IdTenant BIGINT NOT NULL,
    IdUsuarioApertura BIGINT NOT NULL,
    FechaApertura TIMESTAMP NOT NULL DEFAULT NOW(),
    FechaCierre TIMESTAMP,
    MontoInicial NUMERIC(18,2) NOT NULL DEFAULT 0,
    MontoFinal NUMERIC(18,2),
    Estado SMALLINT NOT NULL DEFAULT 1, -- 1 abierta, 0 cerrada
    IdUsuarioCierre BIGINT
);
```

**Regla de negocio**: No se puede registrar una venta ni un abono sin caja abierta.

#### ProductoMovimiento (Kardex)

```sql
CREATE TABLE ProductoMovimiento (
    Id BIGSERIAL PRIMARY KEY,
    IdTenant BIGINT NOT NULL,
    IdProducto BIGINT NOT NULL,
    TipoMovimiento SMALLINT NOT NULL,
    -- 1 = entrada (compra)
    -- 2 = salida (venta)
    -- 3 = ajuste (+)
    -- 4 = ajuste (-)
    -- 5 = devolución
    Cantidad NUMERIC(18,4) NOT NULL,
    StockAnterior NUMERIC(18,4) NOT NULL,
    StockNuevo NUMERIC(18,4) NOT NULL,
    IdDocumento BIGINT,
    IdUsuario BIGINT,
    Observacion TEXT,
    Fecha TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Trigger recomendado**: Al insertar `DocumentoItem` (venta), crear automáticamente registro en `ProductoMovimiento`.

### 8.3 Tabla DocumentoPago (POSTERGADA)

La propuesta original recomendaba separar pagos en una tabla propia. **Se posterga** por estas razones:

1. El trigger `fn_actualizar_saldo_total_abono()` ya maneja la lógica de saldo perfectamente.
2. Cambiar el modelo de datos ahora rompería los triggers y requeriría replicar la lógica.
3. El algoritmo de distribución de abonos del frontend funciona; solo debe moverse al API route.

**Cuándo hacerlo**: Cuando la auditoría real exija historial de pagos independiente, o cuando se integre facturación electrónica.

---

## 9. API Routes (Next.js)

### 9.1 Endpoints propuestos

```
POST   /api/auth/login          -> Delegar a Supabase Auth
POST   /api/auth/logout         -> Limpiar cookies
POST   /api/auth/magic-link     -> Login sin password

GET    /api/negocio             -> Obtener config del negocio (del tenant)
PUT    /api/negocio             -> Actualizar config

GET    /api/clientes            -> Listar (con filtro tenant)
POST   /api/clientes            -> Crear (validar IdTenant)
PUT    /api/clientes/:id        -> Actualizar (diff-based)
DELETE /api/clientes/:id        -> Soft delete (Estado = 0)

GET    /api/productos           -> Listar
POST   /api/productos           -> Crear
PUT    /api/productos/:id       -> Actualizar
DELETE /api/productos/:id       -> Soft delete

GET    /api/ventas              -> Filtrar por fecha, tenant
POST   /api/ventas              -> Crear venta (master-detail)
GET    /api/ventas/:id          -> Detalle con items
PUT    /api/ventas/:id          -> Modificar (diff-based)
DELETE /api/ventas/:id          -> Soft delete (si TotalAbono = 0)

POST   /api/abonos              -> Crear abono/pago (distribución en API route)
GET    /api/deudas              -> Deudas por cobrar (agrupadas por cliente)

GET    /api/caja                -> Caja actual del usuario
POST   /api/caja/apertura       -> Abrir caja
POST   /api/caja/cierre         -> Cerrar caja

GET    /api/auditoria/documentos    -> Leer DocumentoAudit
GET    /api/auditoria/documento-items -> Leer DocumentoItemAudit
```

### 9.2 Patrón de API Route

```typescript
// app/api/ventas/route.ts
import { createRouteHandlerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

const ventaSchema = z.object({
  FechaEmision: z.string().date(),
  IdCliente: z.number().nullable(),
  bCredito: z.boolean(),
  Total: z.number().positive(),
  items: z.array(z.object({
    IdProducto: z.number(),
    Descripcion: z.string(),
    Cantidad: z.number().positive(),
    PrecioVenta: z.number().positive(),
  })).min(1),
});

export async function POST(request: Request) {
  const supabase = createRouteHandlerSupabaseClient({ cookies });

  // 1. Validar JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return new Response('Unauthorized', { status: 401 });

  // 2. Obtener perfil (IdTenant, Rol)
  const { data: perfil } = await supabase
    .from('SistemaPerfil')
    .select('IdTenant, Rol')
    .eq('Id', user.id)
    .single();

  if (!perfil) return new Response('Forbidden', { status: 403 });

  // 3. Validar rol
  if (!['ADMIN', 'CAJERO', 'VENDEDOR'].includes(perfil.Rol)) {
    return new Response('Forbidden', { status: 403 });
  }

  // 4. Validar body
  const body = await request.json();
  const result = ventaSchema.safeParse(body);
  if (!result.success) return new Response(JSON.stringify(result.error), { status: 400 });

  // 5. Verificar caja abierta
  const { data: caja } = await supabase
    .from('Caja')
    .select('id')
    .eq('IdTenant', perfil.IdTenant)
    .eq('Estado', 1)
    .single();
  if (!caja) return new Response('No hay caja abierta', { status: 400 });

  // 6. Insertar Documento + DocumentoItem (master-detail con rollback manual)
  // ... (misma lógica que documento-service.ts, con IdTenant inyectado)

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
```

---

## 10. Validaciones Importantes

### 10.1 Crédito

Validar en API Route:
- Cliente obligatorio (`IdCliente` no nulo y > 0)
- Cliente activo (`Estado = 1`)
- Límite de crédito no excedido (SUM de saldos del cliente + nueva venta <= LimiteCredito)
- Dirección obligatoria si el negocio lo exige

### 10.2 Pagos / Abonos

Validar en API Route:
- No exceder saldo del documento
- Documento activo (`Estado = 1`)
- Caja abierta
- Si pago > saldo, rechazar (la distribución va en la API, no en el frontend)

### 10.3 Eliminaciones

**No eliminar físicamente.** Usar `Estado = 0`.

Restricciones:
- Venta con abonos: no se puede eliminar
- Venta con items: soft delete
- Producto con movimientos: no se puede eliminar (solo desactivar)

---

## 11. Roadmap de Migración

### Fase 0 — Correcciones Inmediatas (1 semana)

**Impacto alto, costo bajo.**

1. **UI para `Negocio`**: Crear `/configuracion` para editar nombre, dirección, teléfono, logo del comercio.
2. **UI para Auditoría**: Crear `/auditoria` que lea `DocumentoAudit` e `DocumentoItemAudit`. La BD ya las llena.
3. **Fix `IdCliente = 0`**: Cambiar a nullable. Hoy `0` significa "sin cliente"; eso es un hack del origen .NET MAUI.
4. **Modernización UI**: Aplicar los cambios de estilo ya realizados (tema, cards, navegación).

### Fase 1 — Auth y API Routes (2 semanas)

**Puerta de seguridad.**

1. Activar **Supabase Auth** (email/password + magic links).
2. Crear tabla `SistemaPerfil` ligada a `auth.users`.
3. Crear **API Routes** base (`/api/clientes`, `/api/productos`, `/api/ventas`, `/api/login`).
4. Migrar `documento-service.ts`, `cliente-service.ts`, `producto-service.ts` a API routes.
5. Frontend deja de usar `supabase` directo; pasa a llamar `/api/*`.
6. Implementar middleware de **IdTenant** inyectado en cada query.

### Fase 2 — Multitenant y Permisos (2 semanas)

1. Agregar `IdTenant` a **todas** las tablas con `DEFAULT 1`.
2. Implementar **roles** (`ADMIN`, `CAJERO`, `VENDEDOR`, `COBRANZA`, `SUPERVISOR`).
3. Agregar **soft deletes** (`Estado SMALLINT DEFAULT 1` a todas las tablas).
4. Evaluar **RLS mínimo** como red de seguridad (`SET LOCAL app.current_tenant`).

### Fase 3 — Control de Caja y Stock (2 semanas)

1. Crear tabla `Caja`. Regla: sin caja abierta, no hay ventas ni abonos.
2. Crear tabla `ProductoMovimiento` (Kardex).
3. Trigger: al insertar venta, crear movimiento de salida automáticamente.
4. Trigger: al anular venta, crear movimiento de entrada (devolución).

### Fase 4 — Separar Pagos y Escalar (cuando sea necesario)

**Condición de entrada**: 20+ negocios pagando, o requerimiento de facturación electrónica.

1. Crear tabla `DocumentoPago`.
2. Reescribir trigger `fn_actualizar_saldo_total_abono()` para apuntar a `DocumentoPago`.
3. Migrar abonos históricos de `DocumentoItem` a `DocumentoPago`.
4. Evaluar **NestJS** solo si Next.js API Routes se vuelve cuello de botella.

---

## 12. Recomendación Final

### Lo que NO hacer ahora

- ❌ Migrar a NestJS (reemplazado por Next.js API Routes)
- ❌ Redis (PostgreSQL con índices es suficiente)
- ❌ Docker/Kubernetes (Vercel + Supabase funciona)
- ❌ Separar pagos inmediatamente (triggers actuales funcionan)
- ❌ App móvil nativa (PWA es más barato y suficiente)
- ❌ Reimplementar JWT/bcrypt (Supabase Auth es gratis y probado)
- ❌ Eliminar triggers PostgreSQL (mantenerlos, son código probado)

### Lo que SÍ hacer ahora

1. **Mostrar lo que ya tienes**: `Negocio`, `DocumentoAudit`, `DocumentoItemAudit`.
2. **Poner una puerta**: API Routes + Supabase Auth.
3. **Agregar `IdTenant`**: a todas las tablas.
4. **Mantener triggers**: `fn_actualizar_saldo_total_abono()`, `actualizar_direccion_entrega()`, auditoría.
5. **Control de caja**: sin esto no es un POS real.
6. **Kardex**: trazabilidad de stock.
7. **Roles**: `ADMIN`, `CAJERO`, `VENDEDOR`, `COBRANZA`, `SUPERVISOR`.

### Veredicto final

> El esquema PostgreSQL ya es más maduro de lo que refleja el frontend. Tiene auditoría, triggers de saldo, direcciones automáticas y generación de tickets. **No tires eso.**
>
> La refactorización inteligente es: agregar una capa de seguridad (API Routes + Supabase Auth), inyectar `IdTenant`, mantener los triggers, y mostrar lo que ya tienes.
>
> NestJS, Prisma, Redis y Docker son técnicamente correctos pero **prematuros**. Un POS que funciona hoy vale más que un POS perfecto en 6 meses.
