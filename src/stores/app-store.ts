import { create } from "zustand";
import { AuthUser } from "@/lib/auth-client";
import {
  toInputDate,
  getLocale,
  getDecimales,
  getSimbolo,
  setLocale as setFormatLocale,
  setDecimales as setFormatDecimales,
  setSimbolo as setFormatSimbolo,
} from "@/lib/format";

interface AppState {
  // Filter state (persisted in sessionStorage)
  filterTipo: string;
  filterFechaInicio: string;
  filterFechaFin: string;
  filterIndex: number;

  // Refresh trigger (replaces RefreshService.OnRefresh)
  refreshCounter: number;

  // Auth user
  authUser: AuthUser | null;

  // Formato regional del negocio activo (locale + decimales + símbolo de
  // moneda ya resuelto). Espeja lib/format para que la UI re-renderice.
  locale: string;
  decimales: number;
  simbolo: string;

  // Actions
  setFilter: (tipo: string, index: number, fechaInicio: string, fechaFin: string) => void;
  triggerRefresh: () => void;
  setAuthUser: (user: AuthUser | null) => void;
  setFormato: (locale: string, decimales: number, simbolo: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  filterTipo: "Dia",
  filterFechaInicio: toInputDate(),
  filterFechaFin: toInputDate(),
  filterIndex: 0,

  refreshCounter: 0,
  authUser: null,
  locale: getLocale(),
  decimales: getDecimales(),
  simbolo: getSimbolo(),

  setFilter: (tipo, index, fechaInicio, fechaFin) =>
    set({ filterTipo: tipo, filterIndex: index, filterFechaInicio: fechaInicio, filterFechaFin: fechaFin }),

  triggerRefresh: () => set((state) => ({ refreshCounter: state.refreshCounter + 1 })),
  setAuthUser: (user) => set({ authUser: user }),
  setFormato: (locale, decimales, simbolo) => {
    setFormatLocale(locale);
    setFormatDecimales(decimales);
    setFormatSimbolo(simbolo);
    set({ locale, decimales, simbolo });
  },
}));