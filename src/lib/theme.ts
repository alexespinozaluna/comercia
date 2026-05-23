/**
 * Design tokens programáticos para Comercia Web.
 * Se usan como referencia cuando Tailwind no cubre el caso.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  "4xl": 64,
} as const;

export const radius = {
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  "2xl": "24px",
} as const;

export const font = {
  heading: "600 14px/1.25 system-ui, -apple-system, sans-serif",
  body: "400 13px/1.5 system-ui, -apple-system, sans-serif",
  label: "500 12px/1.4 system-ui, -apple-system, sans-serif",
  caption: "400 11px/1.4 system-ui, -apple-system, sans-serif",
} as const;

export const motion = {
  fast: "100ms",
  normal: "200ms",
  slow: "300ms",
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  easeInOut: "cubic-bezier(0.45, 0, 0.55, 1)",
} as const;

export const z = {
  base: 0,
  dropdown: 50,
  sticky: 100,
  header: 200,
  modal: 300,
  toast: 400,
  tooltip: 500,
} as const;

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;
