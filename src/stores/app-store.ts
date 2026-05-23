import { create } from "zustand";
import { AuthUser } from "@/lib/auth-client";

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

  // Actions
  setFilter: (tipo: string, index: number, fechaInicio: string, fechaFin: string) => void;
  triggerRefresh: () => void;
  setAuthUser: (user: AuthUser | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  filterTipo: "Dia",
  filterFechaInicio: new Date().toISOString().split("T")[0],
  filterFechaFin: new Date().toISOString().split("T")[0],
  filterIndex: 0,

  refreshCounter: 0,
  authUser: null,

  setFilter: (tipo, index, fechaInicio, fechaFin) =>
    set({ filterTipo: tipo, filterIndex: index, filterFechaInicio: fechaInicio, filterFechaFin: fechaFin }),

  triggerRefresh: () => set((state) => ({ refreshCounter: state.refreshCounter + 1 })),
  setAuthUser: (user) => set({ authUser: user }),
}));