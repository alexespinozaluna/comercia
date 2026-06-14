import { describe, it, expect } from "vitest";
import { PERMISOS } from "./permisos";
import { ROLES_VALIDOS } from "@/types/usuario";

describe("PERMISOS", () => {
  it("ADMINISTRACION = ADMIN + SUPERVISOR (operaciones sensibles)", () => {
    expect([...PERMISOS.ADMINISTRACION].sort()).toEqual(["ADMIN", "SUPERVISOR"]);
  });

  it("VENTAS_Y_CATALOGO incluye al VENDEDOR pero no a COBRANZA", () => {
    expect(PERMISOS.VENTAS_Y_CATALOGO).toContain("VENDEDOR");
    expect(PERMISOS.VENTAS_Y_CATALOGO).not.toContain("COBRANZA");
  });

  it("COBRANZA incluye COBRANZA pero no VENDEDOR", () => {
    expect(PERMISOS.COBRANZA).toContain("COBRANZA");
    expect(PERMISOS.COBRANZA).not.toContain("VENDEDOR");
  });

  it("CUALQUIER_OPERADOR equivale a todos los roles válidos", () => {
    expect([...PERMISOS.CUALQUIER_OPERADOR].sort()).toEqual([...ROLES_VALIDOS].sort());
  });

  it("ningún grupo otorga acceso a SUPERADMIN (operador del SaaS)", () => {
    for (const grupo of Object.values(PERMISOS)) {
      expect(grupo).not.toContain("SUPERADMIN");
    }
  });
});
