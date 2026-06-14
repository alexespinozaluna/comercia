-- ============================================================================
-- Eliminar el ticket por SQL (obsoleto): generate_ticket_text + format_numero_locale
-- ----------------------------------------------------------------------------
-- El ticket ahora se genera en el frontend (lib/ticket.ts → canvas/PNG), que
-- respeta símbolo de moneda / decimales / locale del negocio. Las funciones SQL
-- ya no se llaman desde la app (se quitó el service getTicketText y la ruta
-- /api/ticket/[id]).
--   * generate_ticket_text  — armaba el texto del ticket térmico.
--   * format_numero_locale  — helper de formato usado SOLO por la anterior.
-- Se eliminan todas las sobrecargas existentes.
--
-- Idempotente.
-- ============================================================================

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('generate_ticket_text', 'format_numero_locale')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s;', fn);
  END LOOP;
END $$;
