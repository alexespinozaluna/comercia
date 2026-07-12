# Vista `v_documento` (joins de Documento resueltos)

**Fecha:** 2026-07-12
**Estado:** ✅ Implementado y **migración `20260712000000_v_documento.sql` aplicada en BD (2026-07-12)**. Pendiente solo verificación en runtime.
**Objetivo:** reemplazar el embed de PostgREST (`Cliente(*)`, `MetodoPago(Nombre)`, `UsuarioCreacion(Nombre)`…) por una vista con los joins ya resueltos, y consumirla en la lista de documentos.

## La vista

```sql
CREATE VIEW v_documento AS
SELECT
    d.*,
    c."Nombre"  AS "NomCliente",
    mp."Nombre" AS "NomMetodoPago",
    su."Nombre" AS "NomUsuarioCreacion",
    sm."Nombre" AS "NomUsuarioModificacion",
    td."Nombre" AS "NomTipoDoc"
FROM "Documento" d
LEFT JOIN "Cliente"        c  ON c.id  = d."IdCliente"
LEFT JOIN "TipoDocumento"  td ON td.id = d."IdTipoDocumento"
LEFT JOIN "MetodoPago"     mp ON mp.id = d."IdMetodoPago"
LEFT JOIN "SistemaUsuario" su ON su.id = d."IdUsuarioCreacion"
LEFT JOIN "SistemaUsuario" sm ON sm.id = d."IdUsuarioModificacion";
GRANT SELECT ON v_documento TO anon, authenticated;
```

### Decisiones de diseño
- **`d.*` completo** + solo el `Nombre` de cada join, aliasado plano `Nom*` (convención de `v_deuda_detalle`). No se incluye `Cliente.*` / `MetodoPago.*` etc. → evita colisión de columnas y peso muerto (la app solo lee `.Nombre`).
- **Sin `WHERE` (IdTenant/Estado/fecha) ni `ORDER BY` dentro de la vista**: los pone cada consumidor. La vista es el join crudo, reutilizable.
- **No incluye `DocumentoItem`**: una vista plana no devuelve el array de ítems.
- Se une también `TipoDocumento` → `NomTipoDoc` (por si se quiere el nombre del tipo desde la BD; hoy la UI usa el catálogo TS `NOMBRE_TIPO_DOC`).
- `GRANT SELECT ... TO anon, authenticated` (mismo patrón que `v_deuda_detalle`); la app usa la anon key.

## Reshape en el service (opción a — UI sin cambios)

`documentoService.getVentas` pasa a leer `v_documento` (`.from("v_documento").select("*")`, mismos filtros y orden, todos sobre columnas de `Documento` presentes en la vista) y **reshapea** cada fila plana al shape anidado que ya consume el frontend, con `reshapeVDocumento`:

```
NomCliente             → Cliente: { Nombre }
NomMetodoPago          → MetodoPago: { Nombre }
NomUsuarioCreacion     → UsuarioCreacion: { Nombre }
NomUsuarioModificacion → UsuarioModificacion: { Nombre }
```

Así `doc.Cliente?.Nombre`, `doc.MetodoPago?.Nombre`, `doc.UsuarioCreacion?.Nombre` siguen funcionando sin tocar ningún componente (`venta-list-item`, `filter-sheet`, `home`, `venta-abono`, reportes…).

## Alcance

- **Migrado:** `getVentas` (lista `/api/ventas`, usada por home, reportes, filtros, lista de deudas del cliente).
- **NO migrado (a propósito):**
  - `getVentaConItem` (detalle `/api/ventas/[id]`): necesita el **array `DocumentoItem`**, que la vista plana no puede traer → sigue con el embed.
  - Otras listas (ventas eliminadas, saldo a favor) → migrables después con el mismo patrón si se quiere.

## Notas
- La vista solo se usa para **lectura**. Las escrituras (RPC `guardar_venta_con_items`, etc.) siguen contra la tabla `Documento`.
- `d.*` se expande al crear la vista: si `Documento` gana columnas nuevas, hay que **recrear la vista** (`DROP VIEW … ; CREATE VIEW …`) para que aparezcan.
- `NomTipoDoc` viaja en la fila pero hoy no se mapea a la UI (queda disponible para el futuro).
