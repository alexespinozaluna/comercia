import { describe, it, expect } from "vitest";
import {
  TipoDoc,
  flagsTipoDoc,
  esIngreso,
  esEgreso,
  esAbono,
  afectaCaja,
  afectaKardex,
  generaDeuda,
  signoTipoDoc,
} from "./tipo-documento";

describe("tipo-documento", () => {
  it("los IDs del catálogo son fijos 1-6 (no renumerar)", () => {
    expect(TipoDoc).toEqual({
      VENTA: 1,
      ABONO: 2,
      GASTO: 3,
      SALDO_FAVOR: 4,
      AJUSTE: 5,
      ABONO_FAVOR: 6,
    });
  });

  it("Venta: ingreso, afecta caja y kardex, genera deuda, signo +1", () => {
    expect(flagsTipoDoc(TipoDoc.VENTA)).toEqual({
      ingreso: true,
      egreso: false,
      afectaCaja: true,
      afectaKardex: true,
      generaDeuda: true,
      esAbono: false,
      signo: 1,
    });
  });

  it("Gasto: egreso, signo -1, no genera deuda ni mueve kardex", () => {
    expect(esEgreso(TipoDoc.GASTO)).toBe(true);
    expect(esIngreso(TipoDoc.GASTO)).toBe(false);
    expect(signoTipoDoc(TipoDoc.GASTO)).toBe(-1);
    expect(afectaKardex(TipoDoc.GASTO)).toBe(false);
  });

  it("Abono cuenta como abono e ingreso y afecta caja, pero no kardex", () => {
    expect(esAbono(TipoDoc.ABONO)).toBe(true);
    expect(esIngreso(TipoDoc.ABONO)).toBe(true);
    expect(afectaCaja(TipoDoc.ABONO)).toBe(true);
    expect(afectaKardex(TipoDoc.ABONO)).toBe(false);
  });

  it("Ajuste/Baja: solo kardex, neutro (signo 0), no toca caja ni ingreso", () => {
    expect(afectaKardex(TipoDoc.AJUSTE)).toBe(true);
    expect(afectaCaja(TipoDoc.AJUSTE)).toBe(false);
    expect(esIngreso(TipoDoc.AJUSTE)).toBe(false);
    expect(signoTipoDoc(TipoDoc.AJUSTE)).toBe(0);
  });

  it("Abono con saldo a favor: es abono pero NO ingreso ni efectivo (signo 0)", () => {
    expect(esAbono(TipoDoc.ABONO_FAVOR)).toBe(true);
    expect(esIngreso(TipoDoc.ABONO_FAVOR)).toBe(false);
    expect(afectaCaja(TipoDoc.ABONO_FAVOR)).toBe(false);
    expect(signoTipoDoc(TipoDoc.ABONO_FAVOR)).toBe(0);
  });

  it("Saldo a favor (captura): ingreso en efectivo, sin deuda ni kardex", () => {
    expect(esIngreso(TipoDoc.SALDO_FAVOR)).toBe(true);
    expect(afectaCaja(TipoDoc.SALDO_FAVOR)).toBe(true);
    expect(generaDeuda(TipoDoc.SALDO_FAVOR)).toBe(false);
    expect(afectaKardex(TipoDoc.SALDO_FAVOR)).toBe(false);
  });

  it("id desconocido: flags undefined y helpers con fallback seguro", () => {
    expect(flagsTipoDoc(999)).toBeUndefined();
    expect(esIngreso(999)).toBe(false);
    expect(esEgreso(999)).toBe(false);
    expect(signoTipoDoc(999)).toBe(0);
  });
});
