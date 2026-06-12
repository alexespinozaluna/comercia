/**
 * Terminología de la forma de venta usada en toda la UI.
 * Cambiar una etiqueta aquí la propaga a toggle, badges, ticket y mensajes
 * de validación. Fase 2 (overrides por Negocio):
 * ver docs/propuesta-terminologia-parametrizable.md
 */
const DEFAULTS = {
  /** Venta sin saldo pendiente (bCredito = false). */
  ventaPagada: "Pagado",
  /** Venta que deja saldo pendiente (bCredito = true). */
  ventaDeuda: "Deuda",
} as const;

export type Terminos = typeof DEFAULTS;

export function t(key: keyof Terminos): string {
  return DEFAULTS[key];
}

/** Etiqueta de la forma de venta según bCredito ("Pagado" / "Deuda"). */
export function labelFormaVenta(bCredito: boolean): string {
  return bCredito ? t("ventaDeuda") : t("ventaPagada");
}

/** Validación (toast): la venta con deuda exige un cliente real. */
export function msgDeudaRequiereCliente(): string {
  return `Las ventas con ${t("ventaDeuda").toLowerCase()} requieren un cliente`;
}

/** Validación (aviso inline del selector de cliente). */
export function msgDeudaRequiereSeleccionarCliente(): string {
  return `Las ventas con ${t("ventaDeuda").toLowerCase()} requieren seleccionar un cliente.`;
}
