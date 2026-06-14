import { describe, it, expect } from "vitest";
import {
  t,
  labelFormaVenta,
  msgDeudaRequiereCliente,
  msgDeudaRequiereSeleccionarCliente,
} from "./terminologia";

describe("terminologia", () => {
  it("t() devuelve las etiquetas por defecto", () => {
    expect(t("ventaPagada")).toBe("Pagado");
    expect(t("ventaDeuda")).toBe("Deuda");
  });

  it("labelFormaVenta: true → Deuda, false → Pagado", () => {
    expect(labelFormaVenta(true)).toBe("Deuda");
    expect(labelFormaVenta(false)).toBe("Pagado");
  });

  it("los mensajes de validación usan el término de deuda en minúscula", () => {
    expect(msgDeudaRequiereCliente()).toBe("Las ventas con deuda requieren un cliente");
    expect(msgDeudaRequiereSeleccionarCliente()).toBe(
      "Las ventas con deuda requieren seleccionar un cliente.",
    );
  });
});
