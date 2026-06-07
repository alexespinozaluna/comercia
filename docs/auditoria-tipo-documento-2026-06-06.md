# Auditoría feature "TipoDoc" (catálogo de tipos de documento) — 2026-06-06

Solo análisis. No se cambió código. Objetivo: decidir qué **mantener / quitar /
postergar** para simplificar sin romper nada, en una feature que toca cálculos
de dinero (balance, caja, deudas).

> 📌 **Decisión tomada (2026-06-06):** ver §8. Prevalece sobre la recomendación
> "Opción A" de §5. Resumen: la **BD se mantiene como catálogo** (con flags) y
> **TS sigue mandando** el comportamiento por ahora; en el futuro, cuando haya
> tipos nuevos, **mandará la BD**.

Estado git: la feature está commiteada en `dd01c08` (Fases 1–3); la migración
**no** está aplicada a la BD todavía.

---

## 1. Metodología y evidencia

Verificado con `grep` sobre `src/` y `npx tsc --noEmit` (no se asumió nada):

- **`tsc --noEmit` pasa** (exit 0).
- **0 literales numéricos** de `IdTipoDocumento` (regex `=== n`, `: n`, `?? n`,
  `"IdTipoDocumento", n`) → toda la lectura/escritura usa `TipoDoc.*`.
- **Reads van por el rol `anon`** (`supabase-server.ts` usa
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- Inventario de consumidores de cada símbolo del módulo (abajo).

### Mapa de uso real

| Símbolo | ¿Quién lo consume? | Veredicto |
|---|---|---|
| `TipoDoc` (constantes) | ~20 sitios (services, hooks, API routes, páginas) | **Vivo / núcleo** |
| `esEgreso` | `page.tsx` ×2, `venta-list-item.tsx`, `venta-detalle/[id]` | **Vivo** |
| `esAbono` | `venta-detalle/[id]` (routing de borrado) | **Vivo** |
| `esIngreso`, `afectaCaja`, `afectaKardex`, `generaDeuda`, `signoTipoDoc` | nadie | **Muerto** |
| `flagsTipoDoc`, `TipoDocFlags`, `FLAGS` | solo se usan entre sí para alimentar los helpers | **Interno / colapsable** |
| `NOMBRE_TIPO_DOC` | nadie | **Muerto** |
| `documentoService.getTipoDocumento()` | solo `/api/tipo-documento` | **Muerto (cadena)** |
| `GET /api/tipo-documento` | ningún `fetch`/`apiGet` en el front | **Muerto** |
| `interface TipoDocumento` (database.ts) | solo el `getTipoDocumento` muerto | **Muerto (cadena)** |
| Columnas flag en BD (`bIngreso`…`Signo`) | nadie las lee (la app usa el mirror TS) | **Decorativas** |

---

## 2. Hallazgos confirmados

**H1 — Doble fuente de verdad de los flags (confirmado).**
Los flags existen dos veces: en la semilla de la tabla BD (`bIngreso`, `bEgreso`,
…) y hardcodeados en `FLAGS` de `src/lib/tipo-documento.ts`. La app **solo
consume el mirror TS** (síncrono, en el cálculo del balance que corre por
render). Las columnas flag de la BD **no se leen en ningún lado** → son
decorativas y constituyen una trampa de *drift*: alguien podría editar el flag en
la BD esperando un efecto que nunca ocurre (o viceversa).

**H2 — Helpers sin uso (confirmado).**
Se usan únicamente `esEgreso` y `esAbono`. `esIngreso`, `afectaCaja`,
`afectaKardex`, `generaDeuda` y `signoTipoDoc` no tienen consumidores.

**H3 — Endpoint + servicio + interface muertos (confirmado).**
No hay ningún `fetch`/`apiGet("/api/tipo-documento")`. La cadena
`/api/tipo-documento` → `getTipoDocumento()` → `interface TipoDocumento` está
completa pero sin consumidor. El display de tipos en UI **ni siquiera usa**
`NOMBRE_TIPO_DOC` (también muerto): la UI deriva etiquetas con sus propias
banderas locales (`isGasto`, `isSaldoFavor`, etc.).

> Nota: `tipoDocumento`/`TipoDocumento` en `cliente/datos/[id]` y
> `api/clientes/*` es el **tipo de documento del Cliente** (CI/RUT/DNI), sin
> relación con esta feature. No confundir.

**H4 — Sin literales y tsc OK (confirmado).** Ver §1.

**H5 — GRANT / privilegios.**
- El endpoint muerto (`getTipoDocumento`, SELECT sobre `TipoDocumento` con rol
  `anon`) necesitaría GRANT SELECT a `anon` para funcionar. Como se recomienda
  eliminarlo, el punto es **irrelevante**.
- La **FK** de `Documento.IdTipoDocumento` **no requiere GRANT** al rol que
  inserta: según el comportamiento estándar de PostgreSQL, los chequeos de
  integridad referencial (RI) se ejecutan con un permiso interno y no exigen al
  rol `anon` SELECT/REFERENCES sobre la tabla padre. Además, varias escrituras
  pasan por RPCs (que en este proyecto suelen ser SECURITY DEFINER). Por tanto la
  FK no rompería inserciones. *(Si se aplica, conviene confirmarlo una vez en
  staging.)*

---

## 3. Inventario: mantener / quitar / postergar

### ✅ Mantener (valor real, en uso)
- **`TipoDoc` (constantes 1–6).** Elimina los números mágicos en ~20 sitios.
  Riesgo nulo. Es el núcleo de la feature.
- **`esEgreso` y `esAbono`** como helpers — pero **reimplementados con checks
  `TipoDoc`** (sin `FLAGS`). Agrupan en un solo lugar el significado de "egreso"
  y "abono" (este último es multi-tipo: ABONO + ABONO_FAVOR), lo que mejora
  legibilidad en los call sites.

### ❌ Quitar (superficie muerta y/o drift)
- **Columnas flag en BD** (`bIngreso`, `bEgreso`, `bAfectaCaja`, `bAfectaKardex`,
  `bGeneraDeuda`, `bEsAbono`, `Signo`): nunca se leen → drift. (La migración no
  está aplicada, así que es solo editar el archivo SQL.)
- **`FLAGS`, `TipoDocFlags`, `flagsTipoDoc`**: maquinaria que solo alimenta dos
  helpers; al colapsar a checks explícitos desaparece junto con el drift.
- **Helpers sin uso**: `esIngreso`, `afectaCaja`, `afectaKardex`, `generaDeuda`,
  `signoTipoDoc`.
- **`NOMBRE_TIPO_DOC`**: sin consumidor.
- **`documentoService.getTipoDocumento()`** y **`GET /api/tipo-documento`**:
  cadena muerta.
- **`interface TipoDocumento`** (database.ts): solo la usaba el método muerto.

### 🕒 Postergar (YAGNI hoy, reintroducir si aparece la necesidad)
- **Lógica dirigida por flags desde la BD** (Fase 3 "completa"): solo aporta si
  algún día los tipos deben ser configurables en runtime o por tenant. Hoy son
  semántica fija del sistema.
- **Mostrar el nombre del tipo en UI desde el catálogo**: si se necesita, volver
  a añadir un `NOMBRE_TIPO_DOC` (o `Codigo`/`Nombre` del catálogo). Que se quite
  ahora no cierra la puerta.
- **Tabla `TipoDocumento` + FK** (ver §5, opción B): integridad referencial. No
  es superficie muerta —es integridad activa— pero es **opcional** y exige
  aplicar la migración con datos limpios.

---

## 4. Riesgo por acción

| Acción | Toca dinero | Riesgo | Mitigación |
|---|---|---|---|
| Quitar cadena muerta (endpoint, service, interface, helpers sin uso, `NOMBRE_TIPO_DOC`) | No | **Nulo** | `tsc` ya prueba que no hay consumidores |
| Colapsar `FLAGS` → checks `TipoDoc` en `esEgreso`/`esAbono` | Indirecto (define el split ingresos/gastos del balance y el routing de borrado de abonos) | **Bajo** | Es refactor 1:1 (ver §5); verificar equivalencia + prueba manual de balance y de "eliminar abono" |
| Quitar columnas flag del SQL | No (migración sin aplicar) | **Nulo en BD** | Si algún día se aplicó, requeriría `DROP COLUMN` en migración nueva |
| **Mantener** tabla + FK (opción B) | No (la FK es integridad, no cálculo) | **Bajo** | El pre-check de huérfanos aborta si hay datos fuera de 1–6; FK permite NULL |
| Quitar tabla + FK entera (opción A) | No | **Bajo** | Se pierde integridad a nivel BD; las escrituras ya están centralizadas y solo setean 1–6 |

Punto clave: **ninguna de las acciones recomendadas cambia un cálculo**, siempre
que la reimplementación de `esEgreso`/`esAbono` sea equivalente (lo es, ver §5).

---

## 5. Recomendación: versión mínima limpia

Equivalencia que habilita el colapso sin cambiar comportamiento:

- `FLAGS.egreso` es `true` **solo** para `GASTO` ⇒ `esEgreso(id) === (id === TipoDoc.GASTO)`.
- `FLAGS.esAbono` es `true` para `ABONO` y `ABONO_FAVOR` ⇒
  `esAbono(id) === (id === TipoDoc.ABONO || id === TipoDoc.ABONO_FAVOR)`.

### `src/lib/tipo-documento.ts` mínimo (objetivo)

```ts
// Catálogo de tipos de Documento. IDs FIJOS (espejan SQL/RPCs/vistas). No renumerar.
export const TipoDoc = {
  VENTA: 1,
  ABONO: 2,
  GASTO: 3,
  SALDO_FAVOR: 4,
  AJUSTE: 5,
  ABONO_FAVOR: 6,
} as const;

export type TipoDocId = (typeof TipoDoc)[keyof typeof TipoDoc];

/** Egreso = gasto (define el split ingresos/gastos del balance). */
export const esEgreso = (id: number): boolean => id === TipoDoc.GASTO;

/** Abono = pago que reduce el Saldo de una venta (abono normal o con saldo a favor). */
export const esAbono = (id: number): boolean =>
  id === TipoDoc.ABONO || id === TipoDoc.ABONO_FAVOR;
```

Los call sites **no cambian** (`!esEgreso(...)`, `esAbono(...)` siguen igual).

### Variante DB

- **Opción A — solo capa de app (la más limpia, recomendada).** Eliminar también
  la migración/tabla/endpoint/servicio/interface. Cero superficie muerta, cero
  drift, **sin migración que aplicar ni mantener**. El sistema vivió siempre sin
  FK en este campo y las escrituras están centralizadas (solo setean 1–6).
- **Opción B — A + tabla mínima con FK (si se valora integridad en BD).**
  Mantener una tabla `TipoDocumento` reducida a **id + Nombre + Codigo + campos
  base de auditoría** (sin columnas flag) y la FK `Documento.IdTipoDocumento`.
  Da integridad referencial a costa de aplicar la migración con datos limpios.

> Recomendación: **Opción A**. Es la que cumple "sin drift ni superficie muerta"
> al 100 %. Si el equipo prefiere blindar el dato a nivel BD, **B** es aceptable
> y de bajo riesgo, pero deja una migración por aplicar y mantener.

### Qué se elimina exactamente (resumen accionable)
1. `src/app/api/tipo-documento/route.ts` (carpeta completa).
2. `documentoService.getTipoDocumento()` en `src/services/documento-service.ts`
   (y su import de `TipoDocumento`).
3. `interface TipoDocumento` en `src/types/database.ts`.
4. En `src/lib/tipo-documento.ts`: `NOMBRE_TIPO_DOC`, `TipoDocFlags`, `FLAGS`,
   `flagsTipoDoc`, `esIngreso`, `afectaCaja`, `afectaKardex`, `generaDeuda`,
   `signoTipoDoc`; reimplementar `esEgreso`/`esAbono` como arriba.
5. Opción A: borrar `supabase/migrations/20260607000000_tipo_documento_catalogo.sql`.
   Opción B: editar esa migración para quitar las columnas flag de la tabla y de
   la semilla (dejar id/Nombre/Codigo/auditoría + FK).

---

## 6. Plan de implementación (para una tarea futura; AGENTS.md)

> No ejecutado aquí (esta tarea es solo análisis).

- **REPRO/EXPLORE**: ya hecho en este documento (inventario + `tsc`).
- **PLAN**: aplicar §5 (Opción A salvo decisión contraria).
- **IMPLEMENT**:
  1. Reducir `lib/tipo-documento.ts` al mínimo (constantes + 2 helpers).
  2. Borrar endpoint, `getTipoDocumento`, `interface TipoDocumento`.
  3. (A) borrar la migración / (B) recortar la migración.
  4. `npx tsc --noEmit` + `npm run lint`.
- **DOC**: actualizar `docs/analisis-tabla-tipo-documento.md` (marcar Fase 3
  flags/BD como descartada por YAGNI) y la memoria del proyecto.
- **COMMIT**: un commit de simplificación; mencionar que es refactor sin cambio
  de comportamiento.
- **Verificación manual mínima** (toca dinero): balance home (efectivo/abono/
  gastos), lista ingresos vs gastos, y "eliminar abono" en venta-detalle.

---

## 7. Conclusión

La feature cumplió su objetivo útil: **matar los números mágicos** vía `TipoDoc`.
El resto (mirror de flags, helpers extra, endpoint/servicio/interface, columnas
flag en BD, `NOMBRE_TIPO_DOC`) es **superficie muerta o fuente de drift** y puede
quitarse sin tocar ningún cálculo. La versión mínima limpia es: `TipoDoc` +
`esEgreso`/`esAbono` (con checks explícitos), y —opcionalmente— una tabla mínima
con FK si se quiere integridad a nivel BD.

---

## 8. Decisión (2026-06-06)

Tras revisar el análisis, se decide **no** aplicar la "Opción A" de §5, sino una
variante de la **Opción B con visión de futuro**:

### Diseño elegido
- **La BD `TipoDocumento` se mantiene como catálogo completo** (incluidas las
  columnas flag) **+ FK** en `Documento`. Es la **futura fuente de verdad**.
- **Por ahora manda TS**: `TipoDoc` (IDs) + `esEgreso`/`esAbono` definen el
  comportamiento. La BD es catálogo/integridad; la app **no** lee sus flags aún.
- **Futuro**: cuando se agreguen tipos nuevos, se invierte → la app carga el
  catálogo (flags) desde la BD y se retira la lógica equivalente de TS. El punto
  de entrada para ese cambio ya queda listo (ver "Seam" abajo).
- **Drift aceptado conscientemente**: mientras tanto, los flags viven en la BD y
  en TS. Para minimizarlo, en TS la lógica se reduce a 2 predicados derivados (no
  una tabla de flags completa) — ver checklist.

### Seam del futuro — CONSERVAR
Se conservan a propósito, aunque hoy no tengan consumidor, porque son el punto de
entrada del futuro "BD manda":
- `GET /api/tipo-documento`
- `documentoService.getTipoDocumento()`
- `interface TipoDocumento` (database.ts)

### Limpieza acordada (PENDIENTE de implementar — no ejecutada en esta tarea)
1. En `src/lib/tipo-documento.ts`: quitar `FLAGS`, `TipoDocFlags`, `flagsTipoDoc`
   y reescribir los helpers como checks explícitos:
   ```ts
   export const esEgreso = (id: number): boolean => id === TipoDoc.GASTO;
   export const esAbono  = (id: number): boolean =>
     id === TipoDoc.ABONO || id === TipoDoc.ABONO_FAVOR;
   ```
2. Quitar helpers sin uso: `esIngreso`, `afectaCaja`, `afectaKardex`,
   `generaDeuda`, `signoTipoDoc`.
3. Quitar `NOMBRE_TIPO_DOC` (en el futuro el nombre vendrá de la BD).
4. **No** tocar: `TipoDoc`, `esEgreso`, `esAbono`, la migración/tabla/FK, ni el
   seam.

### Tareas operativas que siguen pendientes
- **Aplicar la migración** `20260607000000_tipo_documento_catalogo.sql` a la BD
  (no hay CLI Supabase → SQL editor / `psql`). Mientras no se aplique, la tabla
  no existe y el seam devolvería error si se invocara.
- Cuando se haga la limpieza del punto anterior: `npx tsc --noEmit` + `npm run
  lint` + verificación manual (balance, "eliminar abono").

### Plan del futuro "BD manda" (cuando aparezcan tipos nuevos)
1. Cargar el catálogo (con flags) una vez y cachearlo (no en el cálculo síncrono
   del balance por render).
2. Derivar `esEgreso`/`esAbono`/etc. de los flags de la BD.
3. Retirar de TS los predicados derivados; `TipoDoc` puede permanecer para IDs
   simbólicos en escrituras.
