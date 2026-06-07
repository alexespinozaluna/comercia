-- =====================================================================
-- TipoDocumento — catálogo de tipos de Documento (Fase 1)
-- =====================================================================
-- Normaliza Documento."IdTipoDocumento" (hoy un bigint suelto sin FK) en una
-- tabla de referencia GLOBAL (sin IdTenant, como MetodoPago), con:
--   * Campos base de auditoría (convención del proyecto): id, FechaCreacion,
--     IdUsuarioCreacion, FechaModificacion, IdUsuarioModificacion + FKs.
--   * Catálogo: Nombre, Codigo.
--   * Flags de comportamiento: bIngreso, bEgreso, bAfectaCaja, bAfectaKardex,
--     bGeneraDeuda, bEsAbono, Signo.
--
-- IDs FIJOS 1..6: ya viven cableados en RPCs/vistas/triggers y en el código TS,
-- por lo que NO se pueden renumerar. PK manual (sin IDENTITY) porque el catálogo
-- es cerrado y se siembra con ids explícitos.
--
-- Esta migración NO cambia comportamiento: solo agrega estructura + semilla + FK.
-- Idempotente: re-ejecutable sin error.
-- Base: docs/analisis-tabla-tipo-documento.md (Fase 1)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabla
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."TipoDocumento" (
    -- === Campos base (convención de auditoría) ===
    id                       bigint PRIMARY KEY,
    "FechaCreacion"          timestamptz DEFAULT now() NOT NULL,
    "IdUsuarioCreacion"      bigint,
    "FechaModificacion"      timestamptz,
    "IdUsuarioModificacion"  bigint,
    -- === Catálogo ===
    "Nombre"                 varchar NOT NULL,
    "Codigo"                 varchar NOT NULL,
    -- === Flags de comportamiento ===
    "bIngreso"               boolean  DEFAULT false NOT NULL,
    "bEgreso"                boolean  DEFAULT false NOT NULL,
    "bAfectaCaja"            boolean  DEFAULT false NOT NULL,
    "bAfectaKardex"          boolean  DEFAULT false NOT NULL,
    "bGeneraDeuda"           boolean  DEFAULT false NOT NULL,
    "bEsAbono"               boolean  DEFAULT false NOT NULL,
    "Signo"                  smallint DEFAULT 0     NOT NULL,
    "Orden"                  smallint DEFAULT 0     NOT NULL,
    "Estado"                 smallint DEFAULT 1     NOT NULL
);

-- Codigo único (slug estable para lookups simbólicos)
CREATE UNIQUE INDEX IF NOT EXISTS "TipoDocumento_Codigo_key"
  ON public."TipoDocumento" ("Codigo");

-- ---------------------------------------------------------------------
-- 2. FKs de auditoría a SistemaUsuario (mismo patrón que el resto)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_TipoDocumento_UsuarioCreacion') THEN
    ALTER TABLE public."TipoDocumento" ADD CONSTRAINT "FK_TipoDocumento_UsuarioCreacion"
      FOREIGN KEY ("IdUsuarioCreacion") REFERENCES public."SistemaUsuario"(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_TipoDocumento_UsuarioModificacion') THEN
    ALTER TABLE public."TipoDocumento" ADD CONSTRAINT "FK_TipoDocumento_UsuarioModificacion"
      FOREIGN KEY ("IdUsuarioModificacion") REFERENCES public."SistemaUsuario"(id);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. Semilla (IDs fijos). ON CONFLICT → re-ejecutable y actualiza flags.
-- ---------------------------------------------------------------------
INSERT INTO public."TipoDocumento"
  (id, "Nombre", "Codigo",
   "bIngreso", "bEgreso", "bAfectaCaja", "bAfectaKardex", "bGeneraDeuda", "bEsAbono",
   "Signo", "Orden")
VALUES
  (1, 'Venta',                   'VENTA',        true,  false, true,  true,  true,  false,  1, 1),
  (2, 'Abono',                   'ABONO',        true,  false, true,  false, false, true,   1, 2),
  (3, 'Gasto',                   'GASTO',        false, true,  true,  false, false, false, -1, 3),
  (4, 'Saldo a favor',           'SALDO_FAVOR',  true,  false, true,  false, false, false,  1, 4),
  (5, 'Ajuste/Baja',             'AJUSTE',       false, false, false, true,  false, false,  0, 5),
  (6, 'Abono con saldo a favor', 'ABONO_FAVOR',  false, false, false, false, false, true,   0, 6)
ON CONFLICT (id) DO UPDATE SET
  "Nombre"        = EXCLUDED."Nombre",
  "Codigo"        = EXCLUDED."Codigo",
  "bIngreso"      = EXCLUDED."bIngreso",
  "bEgreso"       = EXCLUDED."bEgreso",
  "bAfectaCaja"   = EXCLUDED."bAfectaCaja",
  "bAfectaKardex" = EXCLUDED."bAfectaKardex",
  "bGeneraDeuda"  = EXCLUDED."bGeneraDeuda",
  "bEsAbono"      = EXCLUDED."bEsAbono",
  "Signo"         = EXCLUDED."Signo",
  "Orden"         = EXCLUDED."Orden";

-- ---------------------------------------------------------------------
-- 4. FK en Documento.IdTipoDocumento → TipoDocumento(id)
--    NOT VALID primero (no bloquea filas existentes) y luego VALIDATE.
--    Pre-check: cualquier IdTipoDocumento no nulo debe estar en {1..6}.
-- ---------------------------------------------------------------------
DO $$
DECLARE huerfanos bigint;
BEGIN
  SELECT count(*) INTO huerfanos
  FROM public."Documento" d
  WHERE d."IdTipoDocumento" IS NOT NULL
    AND d."IdTipoDocumento" NOT IN (SELECT id FROM public."TipoDocumento");

  IF huerfanos > 0 THEN
    RAISE EXCEPTION 'Existen % Documento con IdTipoDocumento fuera del catálogo; revisar antes de crear la FK', huerfanos;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Documento_IdTipoDocumento_fkey') THEN
    ALTER TABLE public."Documento"
      ADD CONSTRAINT "Documento_IdTipoDocumento_fkey"
      FOREIGN KEY ("IdTipoDocumento") REFERENCES public."TipoDocumento"(id)
      NOT VALID;
    ALTER TABLE public."Documento" VALIDATE CONSTRAINT "Documento_IdTipoDocumento_fkey";
  END IF;
END $$;
