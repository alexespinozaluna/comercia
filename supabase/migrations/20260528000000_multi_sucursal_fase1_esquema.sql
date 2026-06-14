-- =====================================================================
-- MULTI-SUCURSAL — FASE 1: Esquema + Backfill
-- =====================================================================
-- Convierte el modelo a: Cuenta (SistemaTenant) → N Negocios (sucursales).
-- Introduce IdNegocio en las tablas operativas y la tabla ProductoStock
-- (catálogo compartido a nivel cuenta; stock por sucursal).
--
-- ALCANCE DE ESTA FASE (no rompe nada):
--   * Solo estructura + backfill de datos existentes.
--   * NO modifica triggers ni RPC. El stock SIGUE siendo Producto.Cantidad
--     hasta la Fase 3 (cuando fn_registrar_movimiento_stock pase a usar
--     ProductoStock). La app sigue leyendo Producto.Cantidad por ahora.
--   * NO toca código TypeScript (eso es Fase 2+).
--
-- Decisiones aplicadas (ver docs/propuesta-multi-sucursal.md):
--   * Productos: catálogo compartido (Producto, IdTenant) + stock por
--     sucursal (ProductoStock).
--   * Clientes compartidos; deuda por sucursal (Documento lleva IdNegocio).
--   * Por sucursal: Documento, DocumentoItem, Caja, ProductoMovimiento.
--
-- Idempotente: re-ejecutable sin error.
-- Backfill: a cada tenant con datos se le asegura un Negocio "Principal"
-- (MIN(id) de sus negocios) y todas las filas históricas se le asignan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Negocio: columna Estado (soft-delete) + índice por tenant
-- ---------------------------------------------------------------------
ALTER TABLE "Negocio" ADD COLUMN IF NOT EXISTS "Estado" SMALLINT NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS "IX_Negocio_IdTenant" ON "Negocio"("IdTenant");

-- ---------------------------------------------------------------------
-- 2. Asegurar un Negocio "Principal" por cada tenant que tenga datos
--    (incluye tenants en SistemaTenant y en cualquier tabla operativa,
--    para que el backfill de IdNegocio nunca quede en NULL).
-- ---------------------------------------------------------------------
INSERT INTO "Negocio" ("IdTenant", "Nombre", "Estado")
SELECT DISTINCT tt.t, 'Principal', 1
FROM (
  SELECT id AS t            FROM "SistemaTenant"
  UNION SELECT "IdTenant"   FROM "Documento"
  UNION SELECT "IdTenant"   FROM "Producto"
  UNION SELECT "IdTenant"   FROM "Caja"
  UNION SELECT "IdTenant"   FROM "ProductoMovimiento"
) tt
WHERE NOT EXISTS (SELECT 1 FROM "Negocio" n WHERE n."IdTenant" = tt.t);

-- ---------------------------------------------------------------------
-- 3. Columnas IdNegocio en tablas operativas (nullable por ahora)
-- ---------------------------------------------------------------------
ALTER TABLE "Documento"          ADD COLUMN IF NOT EXISTS "IdNegocio" BIGINT;
ALTER TABLE "DocumentoItem"      ADD COLUMN IF NOT EXISTS "IdNegocio" BIGINT;
ALTER TABLE "Caja"               ADD COLUMN IF NOT EXISTS "IdNegocio" BIGINT;
ALTER TABLE "ProductoMovimiento" ADD COLUMN IF NOT EXISTS "IdNegocio" BIGINT;

-- ---------------------------------------------------------------------
-- 4. Tabla ProductoStock — stock por sucursal (catálogo compartido)
--    Cantidad en NUMERIC(18,4) para alinear con ProductoMovimiento.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ProductoStock" (
    "IdProducto"  BIGINT        NOT NULL REFERENCES "Producto"(id),
    "IdNegocio"   BIGINT        NOT NULL REFERENCES "Negocio"(id),
    "IdTenant"    BIGINT        NOT NULL,
    "Cantidad"    NUMERIC(18,4) NOT NULL DEFAULT 0,
    "StockMinimo" NUMERIC(18,4),
    PRIMARY KEY ("IdProducto", "IdNegocio")
);
CREATE INDEX IF NOT EXISTS "IX_ProductoStock_Negocio" ON "ProductoStock"("IdNegocio");
CREATE INDEX IF NOT EXISTS "IX_ProductoStock_Tenant"  ON "ProductoStock"("IdTenant");

-- ---------------------------------------------------------------------
-- 5. Backfill de IdNegocio = negocio "Principal" (MIN id) del tenant
-- ---------------------------------------------------------------------
-- 5a. Documento
UPDATE "Documento" d
SET "IdNegocio" = pr.id_negocio
FROM (SELECT "IdTenant", MIN(id) AS id_negocio FROM "Negocio" GROUP BY "IdTenant") pr
WHERE d."IdTenant" = pr."IdTenant" AND d."IdNegocio" IS NULL;

-- 5b. DocumentoItem: hereda del documento padre cuando existe
UPDATE "DocumentoItem" di
SET "IdNegocio" = d."IdNegocio"
FROM "Documento" d
WHERE di."IdDocumento" = d.id AND di."IdNegocio" IS NULL;

-- 5c. DocumentoItem huérfano (sin documento): por tenant
UPDATE "DocumentoItem" di
SET "IdNegocio" = pr.id_negocio
FROM (SELECT "IdTenant", MIN(id) AS id_negocio FROM "Negocio" GROUP BY "IdTenant") pr
WHERE di."IdTenant" = pr."IdTenant" AND di."IdNegocio" IS NULL;

-- 5d. Caja
UPDATE "Caja" c
SET "IdNegocio" = pr.id_negocio
FROM (SELECT "IdTenant", MIN(id) AS id_negocio FROM "Negocio" GROUP BY "IdTenant") pr
WHERE c."IdTenant" = pr."IdTenant" AND c."IdNegocio" IS NULL;

-- 5e. ProductoMovimiento
UPDATE "ProductoMovimiento" m
SET "IdNegocio" = pr.id_negocio
FROM (SELECT "IdTenant", MIN(id) AS id_negocio FROM "Negocio" GROUP BY "IdTenant") pr
WHERE m."IdTenant" = pr."IdTenant" AND m."IdNegocio" IS NULL;

-- ---------------------------------------------------------------------
-- 6. Poblar ProductoStock desde Producto.Cantidad (al negocio Principal)
-- ---------------------------------------------------------------------
INSERT INTO "ProductoStock" ("IdProducto", "IdNegocio", "IdTenant", "Cantidad")
SELECT p.id, pr.id_negocio, p."IdTenant", COALESCE(p."Cantidad", 0)
FROM "Producto" p
JOIN (SELECT "IdTenant", MIN(id) AS id_negocio FROM "Negocio" GROUP BY "IdTenant") pr
  ON pr."IdTenant" = p."IdTenant"
ON CONFLICT ("IdProducto", "IdNegocio") DO NOTHING;

-- ---------------------------------------------------------------------
-- 7. NOT NULL + FK + índices (tras backfill; requiere que el paso 5 haya
--    cubierto todas las filas — garantizado por el paso 2).
-- ---------------------------------------------------------------------
ALTER TABLE "Documento"          ALTER COLUMN "IdNegocio" SET NOT NULL;
ALTER TABLE "DocumentoItem"      ALTER COLUMN "IdNegocio" SET NOT NULL;
ALTER TABLE "Caja"               ALTER COLUMN "IdNegocio" SET NOT NULL;
ALTER TABLE "ProductoMovimiento" ALTER COLUMN "IdNegocio" SET NOT NULL;

-- FKs → Negocio(id) (idempotente vía pg_constraint)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Documento_Negocio') THEN
    ALTER TABLE "Documento" ADD CONSTRAINT "FK_Documento_Negocio"
      FOREIGN KEY ("IdNegocio") REFERENCES "Negocio"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_DocumentoItem_Negocio') THEN
    ALTER TABLE "DocumentoItem" ADD CONSTRAINT "FK_DocumentoItem_Negocio"
      FOREIGN KEY ("IdNegocio") REFERENCES "Negocio"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Caja_Negocio') THEN
    ALTER TABLE "Caja" ADD CONSTRAINT "FK_Caja_Negocio"
      FOREIGN KEY ("IdNegocio") REFERENCES "Negocio"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ProductoMovimiento_Negocio') THEN
    ALTER TABLE "ProductoMovimiento" ADD CONSTRAINT "FK_ProductoMovimiento_Negocio"
      FOREIGN KEY ("IdNegocio") REFERENCES "Negocio"(id);
  END IF;
END $$;

-- Índices por IdNegocio
CREATE INDEX IF NOT EXISTS "IX_Documento_IdNegocio"          ON "Documento"("IdNegocio");
CREATE INDEX IF NOT EXISTS "IX_DocumentoItem_IdNegocio"      ON "DocumentoItem"("IdNegocio");
CREATE INDEX IF NOT EXISTS "IX_Caja_IdNegocio"               ON "Caja"("IdNegocio");
CREATE INDEX IF NOT EXISTS "IX_ProductoMovimiento_IdNegocio" ON "ProductoMovimiento"("IdNegocio");

-- =====================================================================
-- VERIFICACIÓN (ejecutar aparte tras correr la migración; deben dar 0)
-- =====================================================================
-- SELECT count(*) FROM "Documento"          WHERE "IdNegocio" IS NULL;
-- SELECT count(*) FROM "DocumentoItem"      WHERE "IdNegocio" IS NULL;
-- SELECT count(*) FROM "Caja"               WHERE "IdNegocio" IS NULL;
-- SELECT count(*) FROM "ProductoMovimiento" WHERE "IdNegocio" IS NULL;
-- Productos sin fila de stock en su negocio Principal (debe dar 0):
-- SELECT count(*) FROM "Producto" p
--   WHERE NOT EXISTS (SELECT 1 FROM "ProductoStock" s WHERE s."IdProducto" = p.id);
