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
