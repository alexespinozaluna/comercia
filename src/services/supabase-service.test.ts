import { describe, it, expect } from "vitest";
import { cleanJsonId } from "./supabase-service";

describe("cleanJsonId (prep de INSERT master-detail)", () => {
  it("quita id cuando es 0 (fila nueva) para que Postgres asigne el real", () => {
    const out = cleanJsonId({ id: 0, Direccion: "Calle 1", bPrincipal: true });
    expect(out).toEqual({ Direccion: "Calle 1", bPrincipal: true });
    expect("id" in out).toBe(false);
  });

  it("quita id cuando es undefined", () => {
    const out = cleanJsonId({ id: undefined, Nombre: "X" });
    expect(out).toEqual({ Nombre: "X" });
    expect("id" in out).toBe(false);
  });

  it("conserva un id real (> 0) → la fila es un UPDATE, no un INSERT", () => {
    const out = cleanJsonId({ id: 42, Nombre: "X" });
    expect(out).toEqual({ id: 42, Nombre: "X" });
  });

  it("no muta el objeto original", () => {
    const original = { id: 0, Nombre: "X" };
    cleanJsonId(original);
    expect(original).toEqual({ id: 0, Nombre: "X" });
  });

  it("deja intacto un objeto sin campo id", () => {
    const out = cleanJsonId({ Nombre: "X", Total: 100 });
    expect(out).toEqual({ Nombre: "X", Total: 100 });
  });

  it("conserva el resto de campos al quitar el id", () => {
    const out = cleanJsonId({ id: 0, a: 1, b: null, c: false, d: "x" });
    expect(out).toEqual({ a: 1, b: null, c: false, d: "x" });
  });
});
