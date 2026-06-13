-- Sucursal activa por sesión.
--
-- El access token (JWT) es de 45 min y al refrescar se recomputan los claims
-- desde BD. Para un ADMIN (IdNegocio = NULL) eso devolvería siempre el default
-- del tenant, perdiendo la sucursal que eligió. Persistimos su elección aquí
-- para que sobreviva al refresh: refresh usa
--   IdNegocioActivo ?? SistemaUsuario.IdNegocio ?? default-del-tenant.

alter table "SistemaSesion"
  add column "IdNegocioActivo" bigint references "Negocio"(id);
