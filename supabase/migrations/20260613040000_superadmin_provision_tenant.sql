-- ============================================================================
-- SUPERADMIN + provisión de Tenant
-- ----------------------------------------------------------------------------
-- 1. Tenant de sistema ('system') donde vive el/los SUPERADMIN, aislado de los
--    tenants reales.
-- 2. RPC provisionar_tenant: crea atómicamente un tenant nuevo con su admin,
--    su sucursal principal y el catálogo de métodos de pago por defecto.
-- 3. Bootstrap del primer SUPERADMIN: plantilla manual (el hash bcrypt se genera
--    fuera de SQL; sin contraseña por defecto).
--
-- Doc: docs/propuesta-provision-tenant.md. Idempotente en lo que aplica.
-- ============================================================================

-- 1. Tenant de sistema ─────────────────────────────────────────────────────
INSERT INTO "SistemaTenant" ("Codigo", "Nombre", "Estado")
VALUES ('system', 'Sistema', 1)
ON CONFLICT ("Codigo") DO NOTHING;

-- 2. RPC de provisión ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.provisionar_tenant(
    p_codigo text,
    p_nombre text,
    p_admin_codigo text,
    p_admin_nombre text,
    p_admin_password_hash text,
    p_negocio_nombre text,
    p_locale text DEFAULT 'es-CL',
    p_decimales integer DEFAULT 0,
    p_simbolo text DEFAULT '',
    p_id_usuario_actor bigint DEFAULT NULL
) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_tenant_id bigint;
BEGIN
    -- Tenant
    INSERT INTO "SistemaTenant" ("Codigo", "Nombre", "Estado", "IdUsuarioCreacion")
    VALUES (trim(p_codigo), trim(p_nombre), 1, p_id_usuario_actor)
    RETURNING id INTO v_tenant_id;

    -- Sucursal principal
    INSERT INTO "Negocio" ("IdTenant", "Nombre", "Locale", "Decimales", "SimboloMoneda", "Estado", "IdUsuarioCreacion")
    VALUES (v_tenant_id, p_negocio_nombre, p_locale, p_decimales, COALESCE(p_simbolo, ''), 1, p_id_usuario_actor);

    -- Admin del tenant (ADMIN ve todas las sucursales → IdNegocio NULL)
    INSERT INTO "SistemaUsuario" ("IdTenant", "IdNegocio", "Codigo", "Nombre", "PasswordHash", "Rol", "Estado", "IdUsuarioCreacion")
    VALUES (v_tenant_id, NULL, trim(p_admin_codigo), trim(p_admin_nombre), p_admin_password_hash, 'ADMIN', 1, p_id_usuario_actor);

    -- Catálogo de métodos de pago por defecto (incluye Deuda con bDeuda=true)
    INSERT INTO "MetodoPago" ("IdTenant", "Nombre", "Simbolo", "bEfectivo", "bDeuda", "Estado", "IdUsuarioCreacion")
    VALUES
        (v_tenant_id, 'Efectivo',      '', true,  false, 1, p_id_usuario_actor),
        (v_tenant_id, 'Tarjeta',       '', false, false, 1, p_id_usuario_actor),
        (v_tenant_id, 'Transferencia', '', false, false, 1, p_id_usuario_actor),
        (v_tenant_id, 'Deuda',         '', false, true,  1, p_id_usuario_actor);

    RETURN v_tenant_id;
END;
$$;

-- 3. Bootstrap del primer SUPERADMIN ───────────────────────────────────────
-- Generar el hash bcrypt fuera de SQL y reemplazar <<HASH_BCRYPT>>:
--   node -e "console.log(require('bcryptjs').hashSync('TU_PASSWORD', 10))"
--
-- INSERT INTO "SistemaUsuario" ("IdTenant", "IdNegocio", "Codigo", "Nombre", "PasswordHash", "Rol", "Estado")
-- SELECT t.id, NULL, 'superadmin', 'Super Admin', '<<HASH_BCRYPT>>', 'SUPERADMIN', 1
-- FROM "SistemaTenant" t
-- WHERE t."Codigo" = 'system';
