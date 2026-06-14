-- ============================================================================
-- MÉTODO DE PAGO "Deuda" por tenant
-- ----------------------------------------------------------------------------
-- Las ventas a crédito (IdTipoDocumento = 1, bCredito = true) no llevaban
-- método de pago (IdMetodoPago NULL). Para que el reporte de ingresos las
-- agrupe explícitamente como "Deuda" (y no como "NINGUNO"), se crea un método
-- real "Deuda" por tenant y se asigna a las ventas a crédito.
--
-- El método "Deuda" se OCULTA de los selectores de pago: el backend
-- (documentoService.getMetodoPago) lo excluye por Nombre, de modo que el cajero
-- nunca puede elegir "Deuda" como forma de pago al cobrar.
--
-- Idempotente: se puede re-ejecutar sin duplicar ni revertir nada.
-- ============================================================================

-- 1. Crear "Deuda" para cada tenant que ya tenga métodos de pago, si no existe.
INSERT INTO public."MetodoPago" ("Nombre", "Simbolo", "bEfectivo", "Estado", "IdTenant")
SELECT 'Deuda', '', false, 1, t."IdTenant"
FROM (SELECT DISTINCT "IdTenant" FROM public."MetodoPago") t
WHERE NOT EXISTS (
  SELECT 1
  FROM public."MetodoPago" m
  WHERE m."IdTenant" = t."IdTenant"
    AND m."Nombre" = 'Deuda'
);

-- 2. Backfill: ventas a crédito existentes sin método → método "Deuda" del
--    tenant. Solo toca documentos activos de tipo 1 a crédito sin método, así
--    que los reportes históricos quedan consistentes.
UPDATE public."Documento" d
SET "IdMetodoPago" = m.id
FROM public."MetodoPago" m
WHERE m."IdTenant" = d."IdTenant"
  AND m."Nombre" = 'Deuda'
  AND d."IdTipoDocumento" = 1
  AND d."bCredito" = true
  AND d."IdMetodoPago" IS NULL
  AND d."Estado" = 1;
