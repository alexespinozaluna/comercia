import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  // Sin service worker en desarrollo.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // @serwist/next siempre añade una key `webpack` a la config (aunque esté
  // deshabilitado). En `next dev` (Turbopack) eso dispara el error
  // "webpack config + Turbopack". Una config de Turbopack vacía lo silencia;
  // se ignora bajo `next build --webpack`, donde el SW sí se genera.
  turbopack: {},
};

export default withSerwist(nextConfig);
