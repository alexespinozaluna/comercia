-- Sesiones respaldadas en BD (refresh tokens) — Opción B.
-- Doc: docs/propuesta-sesiones-en-bd-refresh-tokens.md
--
-- El access token sigue siendo un JWT stateless (cookie `token`, 45 min). El
-- estado revocable vive aquí: un refresh token opaco se guarda HASHEADO
-- (sha256) y se rota en cada uso. Revocar = marcar RevocadoEn → logout real,
-- expulsión de usuarios desactivados y detección de reuso por `Familia`.

create table "SistemaSesion" (
  id              bigint generated always as identity primary key,
  "IdUsuario"     bigint not null references "SistemaUsuario"(id),
  "IdTenant"      bigint not null,
  "TokenHash"     text not null unique,      -- sha256 del refresh token opaco
  "Familia"       uuid not null,             -- cadena de rotación para detectar reuso
  "ExpiraEn"      timestamptz not null,      -- now() + 30d (con remember) / +8h (sin)
  "RevocadoEn"    timestamptz,               -- NULL = activo
  "UserAgent"     text,                      -- auditoría
  "Ip"            text,                      -- auditoría
  "FechaCreacion" timestamptz not null default now(),
  "UltimoUso"     timestamptz
);

-- Búsqueda de sesiones activas por usuario (logout-all, "sesiones activas").
create index on "SistemaSesion" ("IdUsuario") where "RevocadoEn" is null;
