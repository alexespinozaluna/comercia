import { create } from "zustand";
import { AuthUser } from "@/lib/auth-client";
import {
  toInputDate,
  getLocale,
  getDecimales,
  setLocale as setFormatLocale,
  setDecimales as setFormatDecimales,
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

  // Formato regional del negocio activo (es-CL, es-PE, … + decimales de
  // montos). Espeja el estado de lib/format para que la UI re-renderice.
  locale: string;
  decimales: number;

  // Actions
  setFilter: (tipo: string, index: number, fechaInicio: string, fechaFin: string) => void;
  triggerRefresh: () => void;
  setAuthUser: (user: AuthUser | null) => void;
  setFormato: (locale: string, decimales: number) => void;
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

  setFilter: (tipo, index, fechaInicio, fechaFin) =>
    set({ filterTipo: tipo, filterIndex: index, filterFechaInicio: fechaInicio, filterFechaFin: fechaFin }),

  triggerRefresh: () => set((state) => ({ refreshCounter: state.refreshCounter + 1 })),
  setAuthUser: (user) => set({ authUser: user }),
  setFormato: (locale, decimales) => {
    setFormatLocale(locale);
    setFormatDecimales(decimales);
    set({ locale, decimales });
  },
}));