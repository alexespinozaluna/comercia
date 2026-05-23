-- FASE 3: Control de Caja y Kardex (Stock)
-- Ejecutar en Supabase SQL Editor

-- 1. Tabla Caja
CREATE TABLE IF NOT EXISTS "Caja" (
    id BIGSERIAL PRIMARY KEY,
    "IdTenant" BIGINT NOT NULL DEFAULT 1,
    "IdUsuarioApertura" BIGINT NOT NULL,
    "FechaApertura" TIMESTAMP NOT NULL DEFAULT NOW(),
    "FechaCierre" TIMESTAMP,
    "MontoInicial" NUMERIC(18,2) NOT NULL DEFAULT 0,
    "MontoFinal" NUMERIC(18,2),
    "Estado" SMALLINT NOT NULL DEFAULT 1, -- 1 abierta, 0 cerrada
    "IdUsuarioCierre" BIGINT
);

-- 2. Tabla ProductoMovimiento (Kardex)
CREATE TABLE IF NOT EXISTS "ProductoMovimiento" (
    id BIGSERIAL PRIMARY KEY,
    "IdTenant" BIGINT NOT NULL DEFAULT 1,
    "IdProducto" BIGINT NOT NULL,
    "TipoMovimiento" SMALLINT NOT NULL,
    -- 1 = entrada (compra), 2 = salida (venta), 3 = ajuste (+), 4 = ajuste (-), 5 = devolucion
    "Cantidad" NUMERIC(18,4) NOT NULL,
    "StockAnterior" NUMERIC(18,4) NOT NULL,
    "StockNuevo" NUMERIC(18,4) NOT NULL,
    "IdDocumento" BIGINT,
    "IdUsuario" BIGINT,
    "Observacion" TEXT,
    "Fecha" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Indices
CREATE INDEX IF NOT EXISTS "IX_Caja_IdTenant" ON "Caja"("IdTenant");
CREATE INDEX IF NOT EXISTS "IX_Caja_Estado" ON "Caja"("Estado");
CREATE INDEX IF NOT EXISTS "IX_Caja_FechaApertura" ON "Caja"("FechaApertura");
CREATE INDEX IF NOT EXISTS "IX_ProductoMovimiento_IdTenant" ON "ProductoMovimiento"("IdTenant");
CREATE INDEX IF NOT EXISTS "IX_ProductoMovimiento_IdProducto" ON "ProductoMovimiento"("IdProducto");
CREATE INDEX IF NOT EXISTS "IX_ProductoMovimiento_IdDocumento" ON "ProductoMovimiento"("IdDocumento");
CREATE INDEX IF NOT EXISTS "IX_ProductoMovimiento_Fecha" ON "ProductoMovimiento"("Fecha");

-- 4. Funcion y trigger para Kardex (movimiento de stock al insertar DocumentoItem)
CREATE OR REPLACE FUNCTION fn_registrar_movimiento_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW."IdDocumento" IS NOT NULL THEN
        -- Verificar si es venta (Documento.IdTipoDocumento = 1)
        IF EXISTS (
            SELECT 1 FROM "Documento"
            WHERE id = NEW."IdDocumento"
            AND "IdTipoDocumento" = 1
            AND "Estado" = 1
        ) THEN
            INSERT INTO "ProductoMovimiento" (
                "IdTenant", "IdProducto", "TipoMovimiento", "Cantidad",
                "StockAnterior", "StockNuevo", "IdDocumento", "Fecha"
            )
            SELECT
                NEW."IdTenant",
                NEW."IdProducto",
                2, -- salida por venta
                NEW."Cantidad",
                p."Cantidad",
                p."Cantidad" - NEW."Cantidad",
                NEW."IdDocumento",
                NOW()
            FROM "Producto" p WHERE p.id = NEW."IdProducto";

            -- Actualizar stock del producto
            UPDATE "Producto"
            SET "Cantidad" = "Cantidad" - NEW."Cantidad"
            WHERE id = NEW."IdProducto";
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe para recrearlo
DROP TRIGGER IF EXISTS trg_movimiento_stock ON "DocumentoItem";

CREATE TRIGGER trg_movimiento_stock
AFTER INSERT ON "DocumentoItem"
FOR EACH ROW
EXECUTE FUNCTION fn_registrar_movimiento_stock();

-- 5. Funcion para verificar caja abierta por tenant
CREATE OR REPLACE FUNCTION fn_verificar_caja_abierta(p_id_tenant BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    v_caja_abierta BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM "Caja"
        WHERE "IdTenant" = p_id_tenant
        AND "Estado" = 1
    ) INTO v_caja_abierta;
    RETURN v_caja_abierta;
END;
$$ LANGUAGE plpgsql;
