import { DocumentoAudit, DocumentoItemAudit } from "@/types/database";
import { getSupabaseServer } from "@/lib/supabase-server";
import { toInputDate } from "@/lib/format";

const TABLE_DOC = "DocumentoAudit";
const TABLE_ITEM = "DocumentoItemAudit";

export const auditoriaService = {
  async getDocumentoAudits(
    tenantId: number,
    fechaInicio?: string,
    fechaFin?: string,
    operacion?: string
  ): Promise<DocumentoAudit[]> {
    let query = getSupabaseServer()
      .from(TABLE_DOC)
      .select("*")
      .eq("IdTenant", tenantId)
      .order("FechaAudit", { ascending: false });

    if (fechaInicio) query = query.gte("FechaAudit", fechaInicio);
    if (fechaFin) {
      const fechaFinEnd = new Date(fechaFin + "T00:00:00");
      fechaFinEnd.setDate(fechaFinEnd.getDate() + 1);
      const fechaFinNext = toInputDate(fechaFinEnd);
      query = query.lt("FechaAudit", fechaFinNext);
    }
    if (operacion) query = query.eq("Operacion", operacion);

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching DocumentoAudit: ${error.message}`);
    return (data ?? []) as DocumentoAudit[];
  },

  async getDocumentoItemAudits(
    tenantId: number,
    fechaInicio?: string,
    fechaFin?: string,
    operacion?: string
  ): Promise<DocumentoItemAudit[]> {
    let query = getSupabaseServer()
      .from(TABLE_ITEM)
      .select("*")
      .eq("IdTenant", tenantId)
      .order("FechaAudit", { ascending: false });

    if (fechaInicio) query = query.gte("FechaAudit", fechaInicio);
    if (fechaFin) {
      const fechaFinEnd = new Date(fechaFin + "T00:00:00");
      fechaFinEnd.setDate(fechaFinEnd.getDate() + 1);
      const fechaFinNext = toInputDate(fechaFinEnd);
      query = query.lt("FechaAudit", fechaFinNext);
    }
    if (operacion) query = query.eq("Operacion", operacion);

    const { data, error } = await query;
    if (error) throw new Error(`Error fetching DocumentoItemAudit: ${error.message}`);
    return (data ?? []) as DocumentoItemAudit[];
  },
};
