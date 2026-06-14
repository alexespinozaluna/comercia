import { describe, it, expect } from "vitest";
import { EMPTY_FILTER, contarFiltros, pasaFiltro, type VentaFilter } from "./filter-sheet";
import type { Documento } from "@/types/database";

// Factory mínima: solo los campos que lee pasaFiltro.
function venta(opts: {
  metodo?: number | null;
  usuario?: number | null;
  cliente?: number | null;
}): Documento {
  return {
    IdMetodoPago: opts.metodo ?? null,
    IdUsuarioCreacion: opts.usuario ?? null,
    IdCliente: opts.cliente ?? null,
  } as unknown as Documento;
}

describe("EMPTY_FILTER / contarFiltros", () => {
  it("EMPTY_FILTER no tiene nada seleccionado", () => {
    expect(EMPTY_FILTER).toEqual({ metodoPago: [], usuario: [], cliente: [] });
    expect(contarFiltros(EMPTY_FILTER)).toBe(0);
  });

  it("contarFiltros suma las selecciones de los tres tipos", () => {
    const f: VentaFilter = { metodoPago: [1, 2], usuario: [5], cliente: [9, 10] };
    expect(contarFiltros(f)).toBe(5);
  });
});

describe("pasaFiltro", () => {
  it("sin filtros activos, toda venta pasa", () => {
    expect(pasaFiltro(venta({ metodo: 1, usuario: 2, cliente: 3 }), EMPTY_FILTER)).toBe(true);
  });

  it("filtra por método de pago (OR dentro del tipo)", () => {
    const f: VentaFilter = { metodoPago: [1, 3], usuario: [], cliente: [] };
    expect(pasaFiltro(venta({ metodo: 1 }), f)).toBe(true);
    expect(pasaFiltro(venta({ metodo: 3 }), f)).toBe(true);
    expect(pasaFiltro(venta({ metodo: 2 }), f)).toBe(false);
  });

  it("un valor null se trata como -1 → no coincide con un filtro normal", () => {
    const f: VentaFilter = { metodoPago: [1], usuario: [], cliente: [] };
    expect(pasaFiltro(venta({ metodo: null }), f)).toBe(false);
  });

  it("se puede filtrar explícitamente por 'sin valor' usando -1", () => {
    const f: VentaFilter = { metodoPago: [-1], usuario: [], cliente: [] };
    expect(pasaFiltro(venta({ metodo: null }), f)).toBe(true);
  });

  it("AND entre tipos: debe cumplir todos los filtros activos", () => {
    const f: VentaFilter = { metodoPago: [1], usuario: [5], cliente: [] };
    expect(pasaFiltro(venta({ metodo: 1, usuario: 5 }), f)).toBe(true);
    expect(pasaFiltro(venta({ metodo: 1, usuario: 9 }), f)).toBe(false); // usuario no coincide
    expect(pasaFiltro(venta({ metodo: 2, usuario: 5 }), f)).toBe(false); // método no coincide
  });

  it("filtra por cliente", () => {
    const f: VentaFilter = { metodoPago: [], usuario: [], cliente: [7] };
    expect(pasaFiltro(venta({ cliente: 7 }), f)).toBe(true);
    expect(pasaFiltro(venta({ cliente: 8 }), f)).toBe(false);
  });
});
