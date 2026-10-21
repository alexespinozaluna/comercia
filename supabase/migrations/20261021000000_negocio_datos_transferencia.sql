-- =====================================================================
-- Datos de transferencia por Negocio
-- =====================================================================
-- Texto libre con la(s) cuenta(s) bancaria(s) a las que el cliente puede
-- transferir para pagar una venta a crédito (titular, RUT, banco, tipo y
-- número de cuenta, correo). Se muestra en el detalle de la venta, en el
-- ticket y en el link público de deuda cuando hay saldo pendiente.
-- Vacío (default) = no se muestra nada.
--
-- Texto libre (no tabla) a propósito: admite varias cuentas y el formato
-- que use cada banco/país sin migraciones adicionales.
--
-- Idempotente: re-ejecutable sin error.
-- Base: docs/datos-transferencia-negocio-2026-10-21.md

ALTER TABLE "Negocio"
    ADD COLUMN IF NOT EXISTS "DatosTransferencia" varchar(1000) NOT NULL DEFAULT '';
