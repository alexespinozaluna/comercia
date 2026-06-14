import { describe, it, expect } from "vitest";
import { obtenerRangosDeFechas } from "./date-utils";

/** En todo rango la fecha de inicio no puede ser posterior a la de fin. */
function inicioAntesDeFin(rangos: { FechaInicio: Date; FechaFin: Date }[]) {
  return rangos.every((r) => r.FechaInicio.getTime() <= r.FechaFin.getTime());
}

/** Exactamente un rango marcado como el actual. */
function unSoloActual(rangos: { bActual: boolean }[]) {
  return rangos.filter((r) => r.bActual).length === 1;
}

describe("obtenerRangosDeFechas", () => {
  it("'Hoy' → un único rango actual de un solo día", () => {
    const r = obtenerRangosDeFechas("Hoy");
    expect(r).toHaveLength(1);
    expect(r[0].bActual).toBe(true);
    expect(r[0].FechaInicio.getTime()).toBe(r[0].FechaFin.getTime());
  });

  it("'Dia' → 30 días, el primero es el actual y van de más reciente a más antiguo", () => {
    const r = obtenerRangosDeFechas("Dia");
    expect(r).toHaveLength(30);
    expect(r[0].bActual).toBe(true);
    expect(unSoloActual(r)).toBe(true);
    // r[1] (ayer) es anterior a r[0] (hoy)
    expect(r[1].FechaInicio.getTime()).toBeLessThan(r[0].FechaInicio.getTime());
    expect(inicioAntesDeFin(r)).toBe(true);
  });

  it("'Semana' → 6 semanas que empiezan en domingo y terminan 6 días después", () => {
    const r = obtenerRangosDeFechas("Semana");
    expect(r).toHaveLength(6);
    expect(unSoloActual(r)).toBe(true);
    for (const sem of r) {
      expect(sem.FechaInicio.getDay()).toBe(0); // domingo
      const dias = Math.round(
        (sem.FechaFin.getTime() - sem.FechaInicio.getTime()) / 86_400_000,
      );
      expect(dias).toBe(6);
    }
  });

  it("'Mes' → 6 meses; cada rango va del día 1 al fin de mes", () => {
    const r = obtenerRangosDeFechas("Mes");
    expect(r).toHaveLength(6);
    expect(unSoloActual(r)).toBe(true);
    for (const mes of r) {
      expect(mes.FechaInicio.getDate()).toBe(1);
      expect(mes.FechaFin.getMonth()).toBe(mes.FechaInicio.getMonth());
      // el día siguiente al fin de mes cae en otro mes
      const siguiente = new Date(mes.FechaFin.getTime() + 86_400_000);
      expect(siguiente.getMonth()).not.toBe(mes.FechaFin.getMonth());
    }
  });

  it("'Ano' → 3 años, del 1 de enero al 31 de diciembre, descendentes", () => {
    const r = obtenerRangosDeFechas("Ano");
    expect(r).toHaveLength(3);
    expect(r[0].bActual).toBe(true);
    for (const anio of r) {
      expect(anio.FechaInicio.getMonth()).toBe(0);
      expect(anio.FechaInicio.getDate()).toBe(1);
      expect(anio.FechaFin.getMonth()).toBe(11);
      expect(anio.FechaFin.getDate()).toBe(31);
    }
    expect(r[1].FechaInicio.getFullYear()).toBe(r[0].FechaInicio.getFullYear() - 1);
  });

  it("criterio inválido lanza error", () => {
    expect(() => obtenerRangosDeFechas("Trimestre")).toThrow(/Criterio no válido/);
  });
});
