# Propuesta: Cuenta → múltiples Negocios (sucursales)

> Estado: **propuesta aprobada, sin implementar**. Fecha: 2026-05-28.
> Decisiones cerradas con el equipo (ver §3). Este documento es la referencia para implementar por fases.

## 1. Objetivo

Que una **cuenta/empresa** pueda tener **una o varias sucursales** (negocios). El administrador puede crear negocios, y cualquier usuario navega por el **negocio seleccionado** mediante un **selector en la barra superior**. Toda la operación (ventas, abonos, gastos, caja, stock) queda acotada a la sucursal activa.

## 2. Modelo actual (punto de partida)

```
SistemaTenant (1 fila = "cuenta/empresa")
   ├── SistemaUsuario.IdTenant          usuarios de la cuenta
   ├── Negocio.IdTenant                 ← hoy se trata como 1 fila global (BUG)
   └── operativo .IdTenant              Documento, DocumentoItem, Producto,
                                        Cliente, ClienteDireccion, MetodoPago,
                                        Caja, ProductoMovimiento
```

- El JWT lleva `idTenant`; `getCurrentUserFromRequest` devuelve `APIUser { id, codigo, nombre, rol, idTenant }`.
- Todos los servicios filtran por `IdTenant` (+ `Estado = 1` soft-delete).
- **`Negocio` ya tiene `IdTenant`** (lo añade `migration-tenant.sql`) **pero el código nunca lo usa**:
  - `types/database.ts` interfaz `Negocio` omite `IdTenant`.
  - `negocio-service.ts` `get()`: `.from("Negocio").select("*").limit(1).single()` — sin filtro de tenant → primera fila global.
  - `negocio-service.ts` `update(id)`: por id, sin guard de tenant → IDOR potencial.
  - `/api/negocio` GET/PUT ignoran `user.idTenant`.
  - RPC `generate_ticket_text`: `FROM "Negocio" LIMIT 1` → todas las cuentas verían el mismo encabezado en el ticket.
- **No existe alta de empresa** en la app: sin `register`/`signup`, sin `POST /api/negocio`, sin gestión de usuarios. Todo se siembra por SQL manual (`migration-tenant.sql`).

## 3. Decisiones cerradas

| Tema | Decisión |
|------|----------|
| Productos / stock | **Catálogo compartido a nivel cuenta; stock por sucursal** |
| Clientes / deuda | **Clientes compartidos; deuda por sucursal** |
| Sucursal activa | **Re-emitir JWT al cambiar de sucursal** (`idNegocio` en el token) |
| Acceso usuario↔sucursal | Fase 1: todo usuario del tenant ve todas sus sucursales (restricción por usuario queda para fase opcional) |
| Precio por sucursal | **No** por ahora (precio compartido); override por sucursal queda como opción futura |

## 4. Modelo propuesto

`SistemaTenant` = **Cuenta/Empresa**. `Negocio` = **Sucursal**. Se introduce `IdNegocio` como dimensión por debajo del tenant para los datos operativos.

```
SistemaTenant ............... Cuenta / Empresa
   ├── SistemaUsuario ......... usuarios de la cuenta (IdTenant)
   └── Negocio (1..N) ......... SUCURSALES (IdTenant)   ← el admin las crea
          ├── Documento, DocumentoItem, Caja, ProductoMovimiento  (IdTenant + IdNegocio)
          └── ProductoStock ..... existencias por sucursal

Compartido a nivel cuenta (sin IdNegocio):
   Producto (catálogo), Cliente, ClienteDireccion, MetodoPago
```

### 4.1 Qué es por sucursal vs compartido

| Entidad | Ámbito | Cómo |
|---|---|---|
| `Documento` (ventas/abonos/gastos) | **Sucursal** | + `IdNegocio` |
| `DocumentoItem` | **Sucursal** | + `IdNegocio` |
| `Caja` | **Sucursal** | + `IdNegocio` |
| `ProductoMovimiento` (kardex) | **Sucursal** | + `IdNegocio` |
| `Producto` (catálogo: nombre, precios) | **Cuenta** | sin cambios; `Cantidad` se deprecia |
| `ProductoStock` (existencias) | **Sucursal** | tabla nueva |
| `Cliente`, `ClienteDireccion` | **Cuenta** | sin `IdNegocio` |
| `MetodoPago` | **Cuenta** | referencia |
| `Negocio` | entidad sucursal | `IdTenant` |

## 5. Esquema y migración

### 5.1 Tabla nueva: stock por sucursal

```sql
CREATE TABLE "ProductoStock" (
    "IdProducto"  BIGINT  NOT NULL REFERENCES "Producto"(id),
    "IdNegocio"   BIGINT  NOT NULL REFERENCES "Negocio"(id),
    "IdTenant"    BIGINT  NOT NULL,
    "Cantidad"    NUMERIC NOT NULL DEFAULT 0,
    "StockMinimo" NUMERIC,                 -- opcional
    PRIMARY KEY ("IdProducto", "IdNegocio")
);
CREATE INDEX "IX_ProductoStock_Negocio" ON "ProductoStock"("IdNegocio");
```

- `Producto.Cantidad` queda **obsoleta** (se mantiene un tiempo para no romper; luego se retira).

### 5.2 Columna `IdNegocio` en tablas operativas

```sql
ALTER TABLE "Documento"          ADD COLUMN "IdNegocio" BIGINT;
ALTER TABLE "DocumentoItem"      ADD COLUMN "IdNegocio" BIGINT;
ALTER TABLE "Caja"               ADD COLUMN "IdNegocio" BIGINT;
ALTER TABLE "ProductoMovimiento" ADD COLUMN "IdNegocio" BIGINT;
-- FK → "Negocio"(id) e índices por IdNegocio en cada una
```

`Negocio`: añadir `Estado SMALLINT NOT NULL DEFAULT 1` y (opcional) `Codigo`; índice por `IdTenant`.

### 5.3 Backfill (orden importa)

1. Por cada `SistemaTenant`, crear un `Negocio` "Principal" (reusar el `Negocio` existente del tenant 1 como su Principal).
2. `UPDATE` de `IdNegocio` en `Documento`, `DocumentoItem`, `Caja`, `ProductoMovimiento` al negocio Principal de su tenant.
3. Poblar `ProductoStock`: una fila por (producto, negocio Principal) con `Cantidad = Producto.Cantidad`.
4. Recién entonces: `SET NOT NULL` + FK + índices en las columnas `IdNegocio`.

## 6. RPC y triggers a reescribir (fase crítica)

| Objeto | Cambio |
|---|---|
| `guardar_venta_con_items` | nuevo `p_id_negocio`; lo escribe en `Documento` y `DocumentoItem` |
| `registrar_abono` | el abono hereda `IdNegocio` de la venta; FIFO tipo 2 (todas las deudas del cliente) **filtra por sucursal activa** |
| `modificar_abono` | mantiene `IdNegocio`; disponible calculado dentro de la sucursal |
| `generate_ticket_text` | lee `Negocio` por el `IdNegocio` del documento (deja de usar `LIMIT 1`) — **arregla el bug del ticket** |
| `fn_registrar_movimiento_stock` | actualiza `ProductoStock(IdProducto, IdNegocio)` en vez de `Producto.Cantidad`; `StockAnterior/StockNuevo` salen de ahí |
| funciones de caja (`fn_caja_arqueo`, apertura/cierre) | filtran por `IdNegocio` |
| `v_deuda_detalle`, `fn_deuda_resumen` | filtran/agrupan por `IdNegocio` (deuda por sucursal) |

## 7. Sesión: negocio activo en el JWT

- `JWTPayload` y `APIUser` ganan `idNegocio`.
- **Login**: elige el primer `Negocio` activo del tenant como default y lo firma en el token.
- **Cambio de sucursal**: `POST /api/sesion/negocio { idNegocio }` → valida que el negocio pertenece a `user.idTenant` → re-firma el token (cookie httpOnly, reinicia las 8h).
- `getCurrentUserFromRequest` devuelve `{ ..., idTenant, idNegocio }`.
- Todos los servicios añaden `.eq("IdNegocio", idNegocio)` además del filtro de tenant (defensa en profundidad).

## 8. Selector en la barra superior (UX)

- Dropdown en `app-shell.tsx` (junto al menú de usuario) con los negocios del tenant; el activo marcado.
- ADMIN ve **"+ Crear negocio"**.
- Al cambiar: `POST /api/sesion/negocio` → actualizar `authUser`/store → `triggerRefresh()` + `router.refresh()`.
- La **caja abierta es por sucursal**: al cambiar de negocio se re-evalúa el indicador de caja del header.
- `app-store` gana `negociosDisponibles: Negocio[]` y `negocioActivo: Negocio`.

## 9. Cambios por capa (resumen)

- **API**: `/api/negocio` pasa a **CRUD de sucursales** del tenant (`GET` lista, `POST` crear [ADMIN], `PUT` editar, soft-delete); nuevo `/api/sesion/negocio`; el resto de rutas inyectan `user.idNegocio` en los servicios.
- **Servicios**: cada método que hoy recibe `tenantId` recibe también `negocioId` y filtra; las llamadas RPC pasan `p_id_negocio`.
- **Alta de producto**: crea el producto (catálogo) y siembra `ProductoStock` en 0 para las sucursales existentes.
- **Alta de sucursal**: siembra `ProductoStock` en 0 para todos los productos del catálogo.
- **Listado de productos / kardex / ajustes de stock**: muestran/operan el stock de la **sucursal activa** (join `ProductoStock` por `IdNegocio`).
- **`/configuracion`**: se reconvierte en gestión de sucursales (lista + crear + editar c/u), reusando el form actual de datos del negocio.

## 10. Fases

1. **Esquema + backfill** ✅ aplicada:
   - `20260528000000_multi_sucursal_fase1_esquema.sql` — crea `ProductoStock`, `IdNegocio` + FK + índices, `Negocio.Estado`, un negocio "Principal" por tenant y backfill. No toca triggers/RPC ni código.
   - `20260528010000_multi_sucursal_fase1_fix_nullable.sql` — **corrección**: relaja `IdNegocio` a NULLABLE. El `NOT NULL` se aplicó demasiado pronto y rompía las escrituras (las RPC/inserts aún no envían `IdNegocio`). El `NOT NULL` vuelve en la Fase 3.
2. **JWT + selector + negocio tenant-aware** ✅ implementada (foundation): `idNegocio` en el token (`jwt.ts`/`api-auth.ts`/`auth-client.ts`), negocio por defecto en login, `POST /api/sesion/negocio` para cambiar de sucursal (re-emite token), `negocio-service` tenant-aware (`listByTenant`/`getById`/`getDefaultForTenant`/`update` con guard), `GET /api/negocio` devuelve la lista del tenant (corrige el bug `LIMIT 1`), selector en la barra superior (`negocio-selector.tsx`) y `/configuracion` edita la sucursal activa.
   - **El filtrado de lecturas por sucursal NO se hizo aquí**: se movió a la Fase 3, porque mientras las escrituras no pongan `IdNegocio` (filas con NULL en el intervalo), filtrar lecturas escondería los registros nuevos. La app sigue operando a nivel cuenta.
3. **Escrituras + RPC/triggers + lecturas por sucursal** — la parte crítica y de mayor riesgo. **Incluye:** poblar `IdNegocio` en las escrituras (`guardar_venta_con_items`, `registrar_abono`, `modificar_abono`, `ajustes`, `cajaService.abrirCaja`, trigger de stock), **filtrar las lecturas** por sucursal activa, re-backfill de filas creadas en el intervalo con `IdNegocio` NULL y **re-aplicar `NOT NULL`** en `Documento`/`DocumentoItem`/`Caja`/`ProductoMovimiento`.
4. **Gestión de sucursales** en `/configuracion` (crear/editar/desactivar, solo ADMIN).
5. *(Opcional)* **Acceso por usuario a sucursales** (`SistemaUsuarioNegocio`).

## 11. Riesgos y notas

- El grueso del esfuerzo/riesgo está en reescribir RPC/triggers atómicos (venta, abono FIFO, stock, arqueo). Hacerlo con backfill + pruebas por fase.
- Semántica de **deuda por cliente entre sucursales**: con la decisión tomada, el resumen de deuda es **por sucursal activa**. Si más adelante se quiere cobranza centralizada (agregada por cuenta), será un cambio en las vistas/`fn_deuda_resumen`.
- Re-emisión de token en cada cambio de sucursal (impacto menor).
- `Producto.Cantidad` obsoleta: planificar su retiro tras validar `ProductoStock`.
- Bug colateral que se resuelve: `Negocio` deja de ser global (`LIMIT 1`) y pasa a filtrarse por tenant/sucursal.

## 12. Pendiente de decidir más adelante (no bloquea fases 1–4)

- Precio por sucursal (override `ProductoNegocio`).
- Restricción de usuarios a sucursales concretas (fase 5).
- Cobranza centralizada (deuda agregada por cuenta) vs por sucursal.
