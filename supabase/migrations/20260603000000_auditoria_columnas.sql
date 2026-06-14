-- =====================================================================
-- AUDITORÍA — columnas IdUsuarioCreacion / FechaCreacion /
--             IdUsuarioModificacion / FechaModificacion + FKs + índices
-- =====================================================================
-- Establece la convención de auditoría en todas las tablas mutables.
-- Pobla los campos desde el código de la app (helper auditCreate /
-- auditUpdate); esta migración SOLO agrega estructura y FKs.
--
-- Grupos:
--   * Mutables (4 columnas): Cliente, ClienteDireccion, Producto,
--     Categoria, Negocio, MetodoPago, SistemaTenant, SistemaUsuario,
--     Documento, DocumentoItem, ProductoStock.
--   * Inmutables (solo 2 columnas — IdUsuarioCreacion + FechaCreacion):
--     ProductoMovimiento, LinkPublico.
--   * No tocar (semántica propia): Caja (apertura/cierre),
--     DocumentoAudit / DocumentoItemAudit (son la auditoría).
--     A Caja se le agregan SOLO las FKs a SistemaUsuario.
--
-- Idempotente: re-ejecutable sin error.
-- Base: docs/plan-auditoria-columnas.md (Fase 1)
--
-- PRE-CHECK opcional (correr aparte si se sospecha de huérfanos):
--   SELECT 'Documento' tabla, count(*) FROM "Documento"
--     WHERE "IdUsuarioCreacion" IS NOT NULL
--       AND "IdUsuarioCreacion" NOT IN (SELECT id FROM "SistemaUsuario")
--   UNION ALL
--   SELECT 'ProductoMovimiento', count(*) FROM "ProductoMovimiento"
--     WHERE "IdUsuario" IS NOT NULL
--       AND "IdUsuario" NOT IN (SELECT id FROM "SistemaUsuario")
--   UNION ALL
--   SELECT 'Caja apertura', count(*) FROM "Caja"
--     WHERE "IdUsuarioApertura" NOT IN (SELECT id FROM "SistemaUsuario")
--   UNION ALL
--   SELECT 'Caja cierre', count(*) FROM "Caja"
--     WHERE "IdUsuarioCierre" IS NOT NULL
--       AND "IdUsuarioCierre" NOT IN (SELECT id FROM "SistemaUsuario");
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Grupo A — Mutables: agregar 4 columnas a cada tabla
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Cliente','ClienteDireccion','Producto','Categoria','Negocio',
    'MetodoPago','SistemaTenant','SistemaUsuario','Documento',
    'DocumentoItem','ProductoStock'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD COLUMN IF NOT EXISTS "IdUsuarioCreacion"     bigint,
         ADD COLUMN IF NOT EXISTS "FechaModificacion"     timestamptz,
         ADD COLUMN IF NOT EXISTS "IdUsuarioModificacion" bigint;', t);
    -- FechaCreacion ya existe en todas estas tablas (DEFAULT now() NOT NULL).
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2. Grupo B — Inmutables: solo IdUsuarioCreacion (FechaCreacion ya existe)
--    LinkPublico ya tiene FechaCreacion. ProductoMovimiento usa "Fecha" en
--    lugar de "FechaCreacion" — se mantiene como está; solo agregamos
--    IdUsuarioCreacion vía renombre en migración separada (Fase 2).
-- ---------------------------------------------------------------------
ALTER TABLE public."LinkPublico"
  ADD COLUMN IF NOT EXISTS "IdUsuarioCreacion" bigint;

-- ---------------------------------------------------------------------
-- 3. FKs a SistemaUsuario(id) — todas las columnas usuario del modelo
-- ---------------------------------------------------------------------
DO $$
BEGIN
  -- Grupo A: IdUsuarioCreacion + IdUsuarioModificacion
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Cliente_UsuarioCreacion') THEN
    ALTER TABLE public."Cliente" ADD CONSTRAINT "FK_Cliente_UsuarioCreacion"
      FOREIGN KEY ("IdUsuarioCreacion") REFERENCES public."SistemaUsuario"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Cliente_UsuarioModificacion') THEN
    ALTER TABLE public."Cliente" ADD CONSTRAINT "FK_Cliente_UsuarioModificacion"
      FOREIGN KEY ("IdUsuarioModificacion") REFERENCES public."SistemaUsuario"(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ClienteDireccion_UsuarioCreacion') THEN
    ALTER TABLE public."ClienteDireccion" ADD CONSTRAINT "FK_ClienteDireccion_UsuarioCreacion"
      FOREIGN KEY ("IdUsuarioCreacion") REFERENCES public."SistemaUsuario"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ClienteDireccion_UsuarioModificacion') THEN
    ALTER TABLE public."ClienteDireccion" ADD CONSTRAINT "FK_ClienteDireccion_UsuarioModificacion"
      FOREIGN KEY ("IdUsuarioModificacion") REFERENCES public."SistemaUsuario"(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Producto_UsuarioCreacion') THEN
    ALTER TABLE public."Producto" ADD CONSTRAINT "FK_Producto_UsuarioCreacion"
      FOREIGN KEY ("IdUsuarioCreacion") REFERENCES public."SistemaUsuario"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Producto_UsuarioModificacion') THEN
    ALTER TABLE public."Producto" ADD CONSTRAINT "FK_Producto_UsuarioModificacion"
      FOREIGN KEY ("IdUsuarioModificacion") REFERENCES public."SistemaUsuario"(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Categoria_UsuarioCreacion') THEN
    ALTER TABLE public."Categoria" ADD CONSTRAINT "FK_Categoria_UsuarioCreacion"
      FOREIGN KEY ("IdUsuarioCreacion") REFERENCES public."SistemaUsuario"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Categoria_UsuarioModificacion') THEN
    ALTER TABLE public."Categoria" ADD CONSTRAINT "FK_Categoria_UsuarioModificacion"
      FOREIGN KEY ("IdUsuarioModificacion") REFERENCES public."SistemaUsuario"(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Negocio_UsuarioCreacion') THEN
    ALTER TABLE public."Negocio" ADD CONSTRAINT "FK_Negocio_UsuarioCreacion"
      FOREIGN KEY ("IdUsuarioCreacion") REFERENCES public."SistemaUsuario"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Negocio_UsuarioModificacion') THEN
    ALTER TABLE public."Negocio" ADD CONSTRAINT "FK_Negocio_UsuarioModificacion"
      FOREIGN KEY ("IdUsuarioModificacion") REFERENCES public."SistemaUsuario"(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_MetodoPago_UsuarioCreacion') THEN
    ALTER TABLE public."MetodoPago" ADD CONSTRAINT "FK_MetodoPago_UsuarioCreacion"
      FOREIGN KEY ("IdUsuarioCreacion") REFERENCES public."SistemaUsuario"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_MetodoPago_UsuarioModificacion') THEN
    ALTER TABLE public."MetodoPago" ADD CONSTRAINT "FK_MetodoPago_UsuarioModificacion"
      FOREIGN KEY ("IdUsuarioModificacion") REFERENCES public."SistemaUsuario"(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SistemaTenant_UsuarioCreacion') THEN
    ALTER TABLE public."SistemaTenant" ADD CONSTRAINT "FK_SistemaTenant_UsuarioCreacion"
      FOREIGN KEY ("IdUsuarioCreacion") REFERENCES public."SistemaUsuario"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SistemaTenant_UsuarioModificacion') THEN
    ALTER TABLE public."SistemaTenant" ADD CONSTRAINT "FK_SistemaTenant_UsuarioModificacion"
      FOREIGN KEY ("IdUsuarioModificacion") REFERENCES public."SistemaUsuario"(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SistemaUsuario_UsuarioCreacion') THEN
    ALTER TABLE public."SistemaUsuario" ADD CONSTRAINT "FK_SistemaUsuario_UsuarioCreacion"
      FOREIGN KEY ("IdUsuarioCreacion") REFERENCES public."SistemaUsuario"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SistemaUsuario_UsuarioModificacion') THEN
    ALTER TABLE public."SistemaUsuario" ADD CONSTRAINT "FK_SistemaUsuario_UsuarioModificacion"
      FOREIGN KEY ("IdUsuarioModificacion") REFERENCES public."SistemaUsuario"(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Documento_UsuarioCreacion') THEN
    ALTER TABLE public."Documento" ADD CONSTRAINT "FK_Documento_UsuarioCreacion"
      FOREIGN KEY ("IdUsuarioCreacion") REFERENCES public."SistemaUsuario"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Documento_UsuarioModificacion') THEN
    ALTER TABLE public."Documento" ADD CONSTRAINT "FK_Documento_UsuarioModificacion"
      FOREIGN KEY ("IdUsuarioModificacion") REFERENCES public."SistemaUsuario"(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_DocumentoItem_UsuarioCreacion') THEN
    ALTER TABLE public."DocumentoItem" ADD CONSTRAINT "FK_DocumentoItem_UsuarioCreacion"
      FOREIGN KEY ("IdUsuarioCreacion") REFERENCES public."SistemaUsuario"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_DocumentoItem_UsuarioModificacion') THEN
    ALTER TABLE public."DocumentoItem" ADD CONSTRAINT "FK_DocumentoItem_UsuarioModificacion"
      FOREIGN KEY ("IdUsuarioModificacion") REFERENCES public."SistemaUsuario"(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ProductoStock_UsuarioCreacion') THEN
    ALTER TABLE public."ProductoStock" ADD CONSTRAINT "FK_ProductoStock_UsuarioCreacion"
      FOREIGN KEY ("IdUsuarioCreacion") REFERENCES public."SistemaUsuario"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ProductoStock_UsuarioModificacion') THEN
    ALTER TABLE public."ProductoStock" ADD CONSTRAINT "FK_ProductoStock_UsuarioModificacion"
      FOREIGN KEY ("IdUsuarioModificacion") REFERENCES public."SistemaUsuario"(id);
  END IF;

  -- Grupo B: solo IdUsuarioCreacion
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_LinkPublico_UsuarioCreacion') THEN
    ALTER TABLE public."LinkPublico" ADD CONSTRAINT "FK_LinkPublico_UsuarioCreacion"
      FOREIGN KEY ("IdUsuarioCreacion") REFERENCES public."SistemaUsuario"(id);
  END IF;

  -- Grupo C: solo FKs (sin agregar columnas — Caja ya tiene apertura/cierre)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Caja_UsuarioApertura') THEN
    ALTER TABLE public."Caja" ADD CONSTRAINT "FK_Caja_UsuarioApertura"
      FOREIGN KEY ("IdUsuarioApertura") REFERENCES public."SistemaUsuario"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Caja_UsuarioCierre') THEN
    ALTER TABLE public."Caja" ADD CONSTRAINT "FK_Caja_UsuarioCierre"
      FOREIGN KEY ("IdUsuarioCierre") REFERENCES public."SistemaUsuario"(id);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. Índices por cada columna usuario (filtros / joins frecuentes)
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  -- Grupo A — los dos índices (creación y modificación)
  FOREACH t IN ARRAY ARRAY[
    'Cliente','ClienteDireccion','Producto','Categoria','Negocio',
    'MetodoPago','SistemaTenant','SistemaUsuario','Documento',
    'DocumentoItem','ProductoStock'
  ] LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I("IdUsuarioCreacion");',
      'IX_' || t || '_IdUsuarioCreacion', t);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I("IdUsuarioModificacion");',
      'IX_' || t || '_IdUsuarioModificacion', t);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS "IX_LinkPublico_IdUsuarioCreacion" ON public."LinkPublico"("IdUsuarioCreacion");
CREATE INDEX IF NOT EXISTS "IX_Caja_IdUsuarioApertura"        ON public."Caja"("IdUsuarioApertura");
CREATE INDEX IF NOT EXISTS "IX_Caja_IdUsuarioCierre"          ON public."Caja"("IdUsuarioCierre");

-- =====================================================================
-- VERIFICACIÓN (ejecutar aparte tras correr la migración)
-- =====================================================================
-- Confirmar que cada tabla del Grupo A tiene las 4 columnas:
--   SELECT table_name, column_name FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name IN ('Cliente','ClienteDireccion','Producto','Categoria',
--                        'Negocio','MetodoPago','SistemaTenant','SistemaUsuario',
--                        'Documento','DocumentoItem','ProductoStock')
--     AND column_name IN ('IdUsuarioCreacion','FechaCreacion',
--                         'IdUsuarioModificacion','FechaModificacion')
--   ORDER BY 1,2;
--
-- Confirmar FKs creadas:
--   SELECT conname FROM pg_constraint WHERE conname LIKE 'FK_%_Usuario%' ORDER BY 1;
