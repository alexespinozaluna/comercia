# Datos para transferencia en ventas a crédito (2026-10-21)

## Objetivo
Cuando una venta es **a crédito y tiene saldo pendiente**, mostrar al cliente
la(s) cuenta(s) bancaria(s) del negocio para que pague por transferencia.

## Diseño
- Columna `Negocio."DatosTransferencia"` `varchar(1000) NOT NULL DEFAULT ''`
  (migración `20261021000000_negocio_datos_transferencia.sql`).
- **Texto libre multilínea**, no tabla: admite varias cuentas (separadas por una
  línea en blanco) y el formato de cada banco/país sin migraciones extra.
  Si a futuro se necesita estructura (p. ej. QR o copiar campo por campo), se
  migra a una tabla `NegocioCuenta`.
- Por **sucursal** (Negocio), igual que Locale/SimboloMoneda.
- Vacío = no se muestra en ningún lado.

## Dónde se muestra
Regla única `mostrarDatosTransferencia(doc)` = `bCredito && Saldo > 0`
(`src/lib/datos-transferencia.ts`):
- `/venta-detalle/[id]`: tarjeta `DatosTransferenciaCard` con botón **Copiar**.
- Ticket compartido (PNG, `src/lib/ticket.ts`): bloque "DATOS PARA TRANSFERENCIA" antes del pie.
- Link público de deuda `/p/deuda/[token]`: tarjeta al final (ya filtra deudas con saldo).

## Edición
`/configuracion` → tarjeta "Datos para transferencia" (textarea). Validación de
longitud en `PUT /api/negocio`. Solo roles de administración.

## Refactor asociado
`fetchNegocio(idNegocio)` (`src/lib/negocio-client.ts`) reemplaza el fetch+find
duplicado de `/api/negocio` en `ticket-share-sheet` y `venta-detalle`.

## Link de deuda multi-sucursal
El link `/p/deuda/[token]` es **por cliente** y abarca las deudas de todas las
sucursales. Antes mostraba siempre la primera sucursal del tenant; ahora:
- `/api/deudas/publica/[token]` devuelve `sucursales`: las sucursales a las que
  pertenecen las deudas (`v_deuda_detalle.IdNegocio`; null → principal), con
  solo campos públicos. `negocio` (encabezado/formato) = esa sucursal si es una
  sola, si no la principal.
- `cuentasPorSucursal(deudas, sucursales)` agrupa el saldo por sucursal y omite
  las que no tienen cuentas cargadas.
- Una sola sucursal → una tarjeta (igual que antes). Varias → una tarjeta por
  sucursal con subtítulo "Sucursal · monto".
- Se calcula al abrir el link: no requiere migración y corrige links ya compartidos.
- Descartado: guardar la sucursal en `LinkPublico.Metadata` (el link se reutiliza
  y el cliente puede deber en varias sucursales).
