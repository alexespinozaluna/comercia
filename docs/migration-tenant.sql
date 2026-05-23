-- FASE 2: Migracion Multitenant + Soft Deletes
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar IdTenant a tablas de negocio (default 1 = tenant existente)
ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "IdTenant" BIGINT NOT NULL DEFAULT 1;
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "IdTenant" BIGINT NOT NULL DEFAULT 1;
ALTER TABLE "ClienteDireccion" ADD COLUMN IF NOT EXISTS "IdTenant" BIGINT NOT NULL DEFAULT 1;
ALTER TABLE "Documento" ADD COLUMN IF NOT EXISTS "IdTenant" BIGINT NOT NULL DEFAULT 1;
ALTER TABLE "DocumentoItem" ADD COLUMN IF NOT EXISTS "IdTenant" BIGINT NOT NULL DEFAULT 1;
ALTER TABLE "MetodoPago" ADD COLUMN IF NOT EXISTS "IdTenant" BIGINT NOT NULL DEFAULT 1;
ALTER TABLE "Negocio" ADD COLUMN IF NOT EXISTS "IdTenant" BIGINT NOT NULL DEFAULT 1;

-- 2. Agregar Estado (soft delete) a tablas de negocio
ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "Estado" SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "Estado" SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE "ClienteDireccion" ADD COLUMN IF NOT EXISTS "Estado" SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE "Documento" ADD COLUMN IF NOT EXISTS "Estado" SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE "DocumentoItem" ADD COLUMN IF NOT EXISTS "Estado" SMALLINT NOT NULL DEFAULT 1;

-- 3. Agregar IdUsuarioCreacion a Documento
ALTER TABLE "Documento" ADD COLUMN IF NOT EXISTS "IdUsuarioCreacion" BIGINT;

-- 4. Tablas de auth (si no existen)
CREATE TABLE IF NOT EXISTS "SistemaTenant" (
    id BIGSERIAL PRIMARY KEY,
    "Codigo" VARCHAR(50) NOT NULL UNIQUE,
    "Nombre" VARCHAR(200) NOT NULL,
    "Estado" SMALLINT NOT NULL DEFAULT 1,
    "FechaCreacion" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "SistemaUsuario" (
    id BIGSERIAL PRIMARY KEY,
    "IdTenant" BIGINT NOT NULL DEFAULT 1,
    "Codigo" VARCHAR(50) NOT NULL,
    "Nombre" VARCHAR(200) NOT NULL,
    "PasswordHash" VARCHAR(500) NOT NULL,
    "Rol" VARCHAR(50) NOT NULL DEFAULT 'CAJERO',
    "Estado" SMALLINT NOT NULL DEFAULT 1,
    "FechaCreacion" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT "FK_SistemaUsuario_Tenant" FOREIGN KEY ("IdTenant")
        REFERENCES "SistemaTenant"(id)
);

-- 5. Tenant default
INSERT INTO "SistemaTenant" ("Codigo", "Nombre")
VALUES ('default', 'Negocio Default')
ON CONFLICT ("Codigo") DO NOTHING;

-- 6. Usuarios default
INSERT INTO "SistemaUsuario" ("IdTenant", "Codigo", "Nombre", "PasswordHash", "Rol", "Estado")
VALUES (1, 'admin', 'Administrador', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN', 1)
ON CONFLICT DO NOTHING;

INSERT INTO "SistemaUsuario" ("IdTenant", "Codigo", "Nombre", "PasswordHash", "Rol", "Estado")
VALUES (1, 'cajero', 'Cajero Default', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'CAJERO', 1)
ON CONFLICT DO NOTHING;

-- 7. Indices para performance
CREATE INDEX IF NOT EXISTS "IX_Producto_IdTenant" ON "Producto"("IdTenant");
CREATE INDEX IF NOT EXISTS "IX_Producto_Estado" ON "Producto"("Estado");
CREATE INDEX IF NOT EXISTS "IX_Cliente_IdTenant" ON "Cliente"("IdTenant");
CREATE INDEX IF NOT EXISTS "IX_Cliente_Estado" ON "Cliente"("Estado");
CREATE INDEX IF NOT EXISTS "IX_Documento_IdTenant" ON "Documento"("IdTenant");
CREATE INDEX IF NOT EXISTS "IX_Documento_Estado" ON "Documento"("Estado");
CREATE INDEX IF NOT EXISTS "IX_DocumentoItem_IdTenant" ON "DocumentoItem"("IdTenant");
CREATE INDEX IF NOT EXISTS "IX_DocumentoItem_Estado" ON "DocumentoItem"("Estado");
CREATE INDEX IF NOT EXISTS "IX_SistemaUsuario_Codigo" ON "SistemaUsuario"("Codigo");
CREATE INDEX IF NOT EXISTS "IX_SistemaUsuario_IdTenant" ON "SistemaUsuario"("IdTenant");
