# Plan — Listado de Ajustes con filtro Fecha inicio / Fecha fin

**Fecha:** 2026-06-09
**Estado:** ✅ Implementado (2026-06-09). Ver sección final "Resultado".
**Alcance:** Análisis, propuesta y plan; implementado tras aprobación con las 3
decisiones abiertas resueltas.
**Módulo:** `src/app/producto/ajustes/` + API/servicio de kardex.
**Relacionado:** [[kardex-stock-fix]], `docs/fix-kardex-duplicacion-y-anulacion-2026-06-08.md`.

---

## 1. REPRO — Requerimiento

En `producto/ajustes` poder **listar los ajustes filtrando por rango de fechas**
(Fecha inicio / Fecha fin), como ya existe en el kardex por producto.

## 2. EXPLORE — Estado actual

**Página `src/app/producto/ajustes/page.tsx`:**
- Trae `GET /api/kardex` **sin parámetros** → todos los movimientos del tenant.
- Filtra en cliente `m.TipoMovimiento >= 3`.
- **No tiene filtro de fechas** (UI ni query).
- **No muestra el producto** de cada movimiento (solo tipo, fecha, observación,
  cantidad y stock). En un listado global de ajustes es un hueco real.

**API `GET /api/kardex` (`src/app/api/kardex/route.ts`) → `kardexService.getAll`:**
- Soporta `fechaInicio`, `fechaFin`, `tipo` (ya filtra por `Fecha` con `gte`/`lte`).
- **NO filtra por `IdNegocio`** → en multi-sucursal mezcla ajustes de todas las
  sucursales del tenant.
- Único consumidor del endpoint global es la página de ajustes (verificado por
  grep; `/api/kardex/[id]` lo usa el kardex por producto, es independiente).

**`/api/ajustes` (POST):** crea movimientos tipo **4** (Merma/Daño/Robo/Ajuste),
**5** (Vencimiento) y **6** (Inventario Físico). No crea tipo 3.

### Bugs / inconsistencias detectadas (a corregir de paso)

1. **Filtro `>= 3` incluye tipo 7 (Anulación venta).** Tipo 7 es la reversa de
   una venta, NO un ajuste de inventario; no debería aparecer en este listado.
   El conjunto correcto de "ajustes" es **{4, 5, 6}** (tipo 3 Fabricación queda
   reservado; hoy nadie lo genera, se puede incluir o no — decisión abierta).
2. **Fuga entre sucursales:** `getAll` no aplica `IdNegocio`.
3. **Fin de rango inclusivo:** `Fecha` es `timestamp`. Comparar `lte` contra
   `"YYYY-MM-DD"` lo trata como medianoche → **excluye los ajustes del propio
   día Fin**. (El kardex por producto tiene la misma deuda latente.) Hay que
   filtrar hasta el **fin del día** (`< FechaFin + 1 día`).
4. **Manejo de fechas (AGENTS.md):** usar `toInputDate()` para los inputs y no
   construir fechas con `new Date("YYYY-MM-DD")` en cliente.

## 3. PLAN — Propuesta

### Enfoque elegido: endpoint dedicado `GET /api/ajustes` (Opción B)

Se descarta extender `/api/kardex` (Opción A) porque dejaría la fuga de sucursal
y no resuelve el nombre de producto. Un `GET` en el route ya existente de ajustes
es semánticamente correcto, queda colocado junto al `POST`, y aísla el contrato.

#### 3.1 Servicio — `kardexService.getAjustes(...)`

Nuevo método (o `getAll` con params extra; se prefiere método aparte para no
tocar al consumidor actual hasta migrarlo):

```ts
getAjustes(
  tenantId: number,
  negocioId: number | null,
  fechaInicio?: string,   // "YYYY-MM-DD"
  fechaFin?: string,      // "YYYY-MM-DD" (inclusivo, fin de día)
  tipos: number[] = [4, 5, 6],
): Promise<ProductoMovimientoConProducto[]>
```

- `.eq("IdTenant", tenantId)`, y si `negocioId != null` → `.eq("IdNegocio", negocioId)`.
- `.in("TipoMovimiento", tipos)`.
- `gte("Fecha", fechaInicio)` y `lt("Fecha", fechaFin + 1 día)` (fin inclusivo).
- `select("*, Producto(Nombre)")` (join Supabase) para traer el nombre del
  producto y mostrarlo en cada fila. Tipo de retorno extiende `ProductoMovimiento`
  con `Producto?: { Nombre: string }`.
- Orden `Fecha` desc.

#### 3.2 API — `GET /api/ajustes`

En `src/app/api/ajustes/route.ts`, añadir `export async function GET(req)`:
- Auth: `getCurrentUserFromRequest` + `requireRole(["ADMIN","SUPERVISOR"])`
  (igual que el POST y que la página).
- Lee `fechaInicio`, `fechaFin`, opcional `tipo`/`tipos` de `searchParams`.
- Llama `kardexService.getAjustes(user.idTenant, user.idNegocio, ...)`.
- Devuelve `{ data }`.

#### 3.3 Página — `producto/ajustes/page.tsx`

- Estado `fechaInicio` / `fechaFin` con default **último mes** (igual que el
  kardex: `toInputDate(monthAgo)` … `toInputDate()`).
- Dos `<Input type="date">` (reutilizar el layout del kardex `[id]/page.tsx`).
- Cargar vía `GET /api/ajustes?fechaInicio=..&fechaFin=..` en vez de
  `/api/kardex` + filtro `>= 3` en cliente.
- Mostrar el **nombre del producto** (`m.Producto?.Nombre`) en cada tarjeta.
- (Opcional) chips de filtro por tipo (Todos / Baja / Inventario) como en el
  kardex.
- Contador "N ajustes" y `EmptyState` cuando no hay resultados en el rango.

### Decisiones abiertas / próximas decisiones

- **¿Incluir tipo 3 (Fabricación) en el conjunto de ajustes?** Hoy no se genera.
  Propuesto: dejarlo fuera por defecto; fácil de añadir al array `tipos`.
- **¿Sincronizar el fix de fin-de-día también en el kardex por producto?** Tiene
  la misma deuda; se puede aplicar el mismo criterio `lt(fin+1)` allí.
- **¿Filtro por producto** dentro del listado de ajustes (buscador)? Fuera de
  alcance de este requerimiento; anotado como mejora futura.

## 4. Plan de ejecución (orden)

1. **Servicio:** agregar `getAjustes` en `src/services/kardex-service.ts` (+ tipo
   de retorno con `Producto.Nombre`).
2. **API:** agregar `GET` en `src/app/api/ajustes/route.ts`.
3. **Página:** añadir filtros de fecha + carga desde `/api/ajustes` + nombre de
   producto en `src/app/producto/ajustes/page.tsx`.
4. **Verificar:** `npm run lint` y prueba manual (rango con/sin resultados, fin
   de día inclusivo, scoping por sucursal, que no aparezca tipo 7).
5. **DOC:** actualizar este archivo con el resultado y, si aplica, nota en
   memoria.
6. **COMMIT:** mensaje descriptivo (`feat: listado de ajustes con filtro de fechas`).

## 5. Archivos afectados

- `src/services/kardex-service.ts` — nuevo `getAjustes`.
- `src/app/api/ajustes/route.ts` — nuevo `GET`.
- `src/app/producto/ajustes/page.tsx` — filtros + carga + nombre de producto.
- (Sin cambios de BD: no requiere migración.)

---

## Resultado (implementado 2026-06-09)

Decisiones abiertas resueltas por el usuario:
- **Tipo 3 (Fabricación) INCLUIDO** → `TIPOS_AJUSTE = [3, 4, 5, 6]`.
- **Fix de fin-de-día APLICADO** en `getByProducto` y `getAjustes` (helper
  `endExclusive`: `lt(FechaFin + 1 día)` en vez de `lte`).
- **Búsqueda por producto AÑADIDA** (filtro en cliente por `ProductoNombre`).

Cambios:
- `src/types/database.ts` — nueva interfaz `ProductoMovimientoAjuste`
  (`ProductoMovimiento` + `ProductoNombre`).
- `src/services/kardex-service.ts` — helper `endExclusive`, `getByProducto` y
  `getAll` ahora usan fin-de-día inclusivo; nuevo `getAjustes(tenant, negocio,
  fechaInicio, fechaFin, tipos=[3,4,5,6])` que filtra por sucursal, rango de
  fechas y tipos, y resuelve el nombre de producto en una 2ª consulta (no hay
  FK para embedding).
- `src/app/api/ajustes/route.ts` — nuevo `GET` con `requireRole(["ADMIN",
  "SUPERVISOR"])`, lee `fechaInicio`/`fechaFin`/`tipo`.
- `src/app/producto/ajustes/page.tsx` — inputs de fecha (default último mes),
  buscador por producto, carga desde `/api/ajustes`, muestra el nombre del
  producto. Ya no usa `/api/kardex` + filtro `>= 3` (que incluía tipo 7).

Verificación: `npx tsc --noEmit` sin errores; `eslint` sin errores (1 warning
preexistente no relacionado en `route.ts`). Falta prueba manual en navegador.
