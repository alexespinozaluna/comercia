# Fix Kardex — venta registrada como TipoMovimiento=2 (Compra)

**Fecha:** 2026-06-07
**Migración:** `supabase/migrations/20260607010000_corregir_tipo_movimiento_venta.sql`

## Síntoma

En el módulo de kardex (`/producto/kardex/[id]`) las **ventas** aparecían con la
etiqueta **"Compra"**, icono verde ↗ y signo **"+"**, a pesar de que el stock baja.
El filtro **"Ingresos"** mostraba las ventas y **"Salidas"** las ocultaba.

## Causa raíz

El trigger `fn_registrar_movimiento_stock` (definido en la migración
`20260528040000_multi_sucursal_fase3b_stock`) insertaba el movimiento de venta con
`TipoMovimiento = 2`. Pero en el catálogo `TipoMovimiento`:

| Id | Descripción | Operacion | Efecto |
|----|-------------|-----------|--------|
| 1 | Venta | SALIDA | Resta |
| **2** | **Compra** | **INGRESO** | **Suma** |

Es decir, se guardaba el código de **Compra** para un movimiento que es una **Venta**.
El descuento de stock siempre fue correcto (el trigger lo calcula a mano:
`v_stock - Cantidad`); lo único equivocado era la **clasificación** del movimiento,
que es la que usa el kardex para etiqueta, color, signo y filtro por `Operacion`.

> El mismo error vivía en el trigger legacy `docs/migration-caja-kardex.sql:61`, pero
> ese archivo está superado por la migración de Fase 3b; el trigger desplegado es el
> de `migrations/`, que es el que corrige esta migración.

## Solución

1. **Trigger:** se recrea `fn_registrar_movimiento_stock` escribiendo
   `TipoMovimiento = 1` (Venta / SALIDA).
2. **Backfill:** se reclasifican a `1` los movimientos `TipoMovimiento = 2` que están
   ligados a un `Documento` de venta (`IdTipoDocumento = 1`). Las compras reales
   (no ligadas a una venta) se conservan como tipo 2:

   ```sql
   UPDATE "ProductoMovimiento" pm
   SET "TipoMovimiento" = 1
   FROM "Documento" d
   WHERE pm."IdDocumento" = d.id
     AND d."IdTipoDocumento" = 1
     AND pm."TipoMovimiento" = 2;
   ```

## Estado

- [ ] Migración `20260607010000` **pendiente de aplicar** en Supabase.

## Notas / pendientes relacionados

- No existe hoy UI que genere movimientos de **Compra (2)** ni **Fabricación (3)**;
  las entradas de stock solo ocurren al dar de alta un producto. Si en el futuro se
  agrega compra de mercadería, deberá registrar `TipoMovimiento = 2`.
