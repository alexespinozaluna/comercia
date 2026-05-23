-- Migración: Tablas de autenticación y tenant
-- Ejecutar en Supabase SQL Editor

-- Tabla SistemaTenant
CREATE TABLE IF NOT EXISTS "SistemaTenant" (
    id BIGSERIAL PRIMARY KEY,
    "Codigo" VARCHAR(50) NOT NULL UNIQUE,
    "Nombre" VARCHAR(200) NOT NULL,
    "Estado" SMALLINT NOT NULL DEFAULT 1,
    "FechaCreacion" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Tenant default
INSERT INTO "SistemaTenant" ("Codigo", "Nombre")
VALUES ('default', 'Negocio Default')
ON CONFLICT ("Codigo") DO NOTHING;

-- Tabla SistemaUsuario
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

-- Índices
CREATE INDEX IF NOT EXISTS "IX_SistemaUsuario_Codigo"
    ON "SistemaUsuario"("Codigo");

CREATE INDEX IF NOT EXISTS "IX_SistemaUsuario_IdTenant"
    ON "SistemaUsuario"("IdTenant");

-- Usuario admin por defecto (password: admin123)
-- El hash se genera con bcryptjs, cost factor 10 (prefijo $2b$)
INSERT INTO "SistemaUsuario" ("IdTenant", "Codigo", "Nombre", "PasswordHash", "Rol", "Estado")
VALUES (
    1,
    'admin',
    'Administrador',
    '$2b$10$ZmywUjBsKt1eNtOXPtl0PO0H7v6hLYw/lEW7gSHf8tUm0fwj.LVw2',
    'ADMIN',
    1
)
ON CONFLICT DO NOTHING;

-- Usuario cajero por defecto (password: cajero123)
INSERT INTO "SistemaUsuario" ("IdTenant", "Codigo", "Nombre", "PasswordHash", "Rol", "Estado")
VALUES (
    1,
    'cajero',
    'Cajero Default',
    '$2b$10$jKpiWohC9xaITsSdCJPgoOkJe0xrLAy0MAQJDkqZlWW02Hu7zfGXy',
    'CAJERO',
    1
)
ON CONFLICT DO NOTHING;
