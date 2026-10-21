import type { Negocio } from "@/types/database";

// Límite de Negocio.DatosTransferencia (varchar en BD).
export const DATOS_TRANSFERENCIA_MAX_LEN = 1000;

/** Texto de cuentas para transferencia del negocio, o "" si no hay. */
export function datosTransferencia(negocio: Pick<Negocio, "DatosTransferencia"> | null | undefined): string {
  return negocio?.DatosTransferencia?.trim() ?? "";
}

/** Una venta a crédito con saldo pendiente muestra las cuentas para transferir. */
export function mostrarDatosTransferencia(doc: { bCredito: boolean; Saldo: number }): boolean {
  return doc.bCredito && Number(doc.Saldo) > 0;
}

export interface CuentasSucursal {
  idNegocio: number;
  nombre: string | null;
  texto: string;
  saldo: number;
}

/**
 * Cuentas para transferir agrupadas por la sucursal de cada deuda (el link de
 * deuda es por cliente y abarca todas las sucursales). Una deuda sin IdNegocio
 * o de una sucursal que no está en la lista cae en la primera (principal).
 * Solo devuelve sucursales con datos de transferencia cargados.
 */
export function cuentasPorSucursal(
  deudas: { IdNegocio?: number | null; Saldo: number }[],
  sucursales: Pick<Negocio, "id" | "Nombre" | "DatosTransferencia">[],
): CuentasSucursal[] {
  const principal = sucursales[0];
  if (!principal) return [];
  const saldos = new Map<number, number>();
  for (const d of deudas) {
    const id = sucursales.some((n) => n.id === d.IdNegocio) ? d.IdNegocio! : principal.id;
    saldos.set(id, (saldos.get(id) ?? 0) + Number(d.Saldo));
  }
  return sucursales
    .filter((n) => saldos.has(n.id) && datosTransferencia(n))
    .map((n) => ({
      idNegocio: n.id,
      nombre: n.Nombre,
      texto: datosTransferencia(n),
      saldo: saldos.get(n.id)!,
    }));
}
