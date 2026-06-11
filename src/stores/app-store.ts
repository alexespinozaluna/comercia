import { create } from "zustand";
import { AuthUser } from "@/lib/auth-client";
import { toInputDate, getLocale, setLocale as setFormatLocale } from "@/lib/format";

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

  // Locale del negocio activo (es-CL, es-PE, …). Espeja el estado de
  // lib/format para que la UI pueda re-renderizar cuando cambia.
  locale: string;

  // Actions
  setFilter: (tipo: string, index: number, fechaInicio: string, fechaFin: string) => void;
  triggerRefresh: () => void;
  setAuthUser: (user: AuthUser | null) => void;
  setLocale: (locale: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  filterTipo: "Dia",
  filterFechaInicio: toInputDate(),
  filterFechaFin: toInputDate(),
  filterIndex: 0,

  refreshCounter: 0,
  authUser: null,
  locale: getLocale(),

  setFilter: (tipo, index, fechaInicio, fechaFin) =>
    set({ filterTipo: tipo, filterIndex: index, filterFechaInicio: fechaInicio, filterFechaFin: fechaFin }),

  triggerRefresh: () => set((state) => ({ refreshCounter: state.refreshCounter + 1 })),
  setAuthUser: (user) => set({ authUser: user }),
  setLocale: (locale) => {
    setFormatLocale(locale);
    set({ locale });
  },
}));