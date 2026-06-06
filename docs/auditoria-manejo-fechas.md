# Auditoría — manejo de fechas (bug "-1 día")

Fecha: 2026-06-06
Alcance: revisión general del manejo de fechas en el frontend y fixes.

## Contexto

Supabase está en **UTC**; el cliente en es-CL (UTC-3/-4). El síntoma reportado
("-1 día" en listas) viene de construir fechas de columnas `date` con
`new Date("YYYY-MM-DD")`, que JS interpreta como **UTC medianoche** → en zona
negativa renderiza el **día anterior**.

`format.ts` ya tenía la solución (`parseDateOnly` para `date`, `toInputDate`
para inputs), pero no se usaba en todos lados.

## Clasificación

- `date` (FechaEmision, MaxFechaEmision): día de calendario → `toInputDate` al
  escribir, `parseDateOnly` al mostrar.
- `timestamptz` (FechaCreacion/Modificacion): instante → `nowIso`/`NOW()` al
  escribir, `new Date(iso)` al mostrar (correcto, trae zona).

## Hallazgos y fixes aplicados

| Archivo | Antes | Fix |
|---|---|---|
| `deuda/page.tsx` | `new Date(r.MaxFechaEmision)` | `parseDateOnly(...)` |
| `deuda-detalle/[idCliente]/page.tsx` | `new Date(d.FechaEmision)` | `parseDateOnly(...)` |
| `venta-eliminadas/page.tsx` | `new Date(d.FechaEmision)` | `parseDateOnly(...)` |
| `venta-abono/page.tsx` | `new Date(d.FechaEmision)` | `parseDateOnly(...)` |
| `saldo-favor/page.tsx` | `new Date(row.FechaEmision)` | `parseDateOnly(...)` |
| `p/deuda/[token]/page.tsx` | `new Date(d.FechaEmision)` | `parseDateOnly(...)` |
| `caja/historial/page.tsx` | `new Date().toISOString().split("T")[0]` (rangos por defecto) | `toInputDate()` (local) |
| `types/database.ts` | `MaxFechaEmision: Date` (incorrecto) | `: string` (lo que devuelve el JSON) |

## Lugares que YA estaban correctos (sin cambios)

- `venta-list-item.tsx` (home): `new Date(fecha + "T12:00:00")` (mediodía local).
- `venta-detalle`: `fechaCortaHora` usa `parseDateOnly`.
- `*.split("T")[0]` para poblar `<input type="date">` (venta-gasto, venta-abono,
  producto/datos): solo extrae el día del string almacenado, sin riesgo.
- Filtros de rango server-side (`documento-service`, `auditoria-service`):
  `new Date(fechaFin + "T00:00:00")` + `setDate(+1)` + `toISOString().split` →
  produce el string del día siguiente de forma robusta en el server (UTC). Se
  deja como está; no afecta el display.
- `FechaCreacion` con `new Date(iso)` (deuda-detalle): correcto (timestamptz).

## Verificación de esquema

`Documento.FechaCreacion` = `timestamp with time zone` (TIMESTAMPTZ, DEFAULT
`now()`, NOT NULL); `Documento.FechaEmision` = `date`. Confirma la
clasificación.

## Convención (añadida a AGENTS.md)

`date` → `toInputDate` / `parseDateOnly`. `timestamptz` → `nowIso` /
`new Date()`. Nunca `new Date("YYYY-MM-DD")` ni `toISOString().split` para días
de calendario.
