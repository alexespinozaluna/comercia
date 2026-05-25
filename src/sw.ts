/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Inyectado por Serwist en build: assets estáticos a precachear.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // Solo precache de assets estáticos. Sin runtimeCaching: las rutas /api/*
  // y las de Supabase nunca se cachean (pasan directo a la red), y no hay
  // fallback offline — los datos del POS son siempre en línea.
});

serwist.addEventListeners();
