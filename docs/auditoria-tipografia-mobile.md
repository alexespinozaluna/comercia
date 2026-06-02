# Auditoría de tipografía global — opciones para reducir tamaño en mobile

**Fecha:** 2026-06-01
**Proyecto:** Comercia Web (Next.js 16 + Tailwind v4)
**Alcance:** análisis read-only de estilos globales y escala tipográfica usada en la app. Sin cambios aplicados.

---

## 1. `src/app/globals.css`

- **Tailwind v4** (`@import "tailwindcss"` + bloques `@theme inline { ... }`).
- **No define `font-size` ni en `html` ni en `body`** — usa la escala default de Tailwind.
- **Sí tiene `@layer base`** (líneas 169–224), con:
  - `* { @apply border-border outline-ring/50; }`
  - `body { @apply bg-background text-foreground; }` — sin font-size
  - `html { @apply font-sans; scroll-behavior: smooth; }` — sin font-size
  - Utilidades `.status-success/warning/error/info` y focus-visible ring
- **Variables CSS custom** (en `@theme inline` y `:root`/`.dark`):
  - Colores semánticos (oklch): background, foreground, primary, secondary, muted, accent, destructive, success, warning, info, border, input, ring, popover, card, sidebar-*, chart-1..5
  - Brand: `--color-brand`, `--color-brand-light`, `--color-brand-dark`, `--color-brand-surface`, `--color-page-bg`
  - Radius: `--radius-sm/md/lg/xl/2xl/3xl/4xl` (8/12/16/20/24/28/32px), `--radius: 0.625rem`
  - Fonts: `--font-sans: var(--font-jakarta)`, `--font-mono`, `--font-heading`
  - Motion: `--ease-out`, `--ease-in-out`, `--duration-fast/normal/slow`
- **No hay `--text-xs/--text-sm/--text-base` redefinidos** — usa los defaults de Tailwind v4.

## 2. `tailwind.config.ts` / config

- **No existe el archivo** (Tailwind v4 → CSS-first via `@theme`).
- **No hay `fontSize` sobreescrito**, no hay breakpoints custom (defaults: `sm:640 / md:768 / lg:1024 / xl:1280 / 2xl:1536`).
- `postcss.config.mjs` solo carga `@tailwindcss/postcss`.
- `package.json`: `tailwindcss ^4`, `@tailwindcss/postcss ^4`.

## 3. Escala tipográfica usada (conteo en `src/`)

| Clase | Ocurrencias | Archivos |
|---|---:|---:|
| `text-xs` (12px) | **142** | 41 |
| `text-sm` (14px) | **141** | 57 |
| `text-base` (16px) | 24 | 20 |
| `text-lg` (18px) | 10 | 8 |
| `text-xl/2xl/3xl` | ~26 (total) | varios |
| **Arbitrarios `text-[Npx]`** | **~90** | 33 |

Dentro de los arbitrarios:
- `text-[10px]`: ~28 — labels uppercase, captions
- `text-[11px]`: ~38 — secundarios, badges, roles
- `text-[13px]`: ~3 — nombres usuario en menús
- `text-[15px]`: 2 — page title header
- `text-[16/17/18px]`: ~9 — montos destacados
- `text-[22/26/28px]`: ~5 — totales grandes

**Observación**: el proyecto ya es bastante compacto. `text-xs`+`text-sm` dominan (~50% de los hits tipográficos); las labels más chicas están escritas como `text-[10px]`/`text-[11px]` arbitrarios (no hay `text-2xs` definido).

## 4. Wrappers globales

- **`src/app/layout.tsx`** (root):
  - `<html className="${jakartaSans.variable} ${geistSans.variable} h-full antialiased">` — **sin clase de tamaño**
  - `<body className="min-h-full flex flex-col">` — **sin clase de tamaño**
- **`src/components/layout/app-shell.tsx`** (`<AppShell>`):
  - `<main className="flex-1 overflow-auto p-4 pb-20 md:pb-4 bg-page-bg">` — **sin clase de tamaño**
  - Header con `text-[15px]` propio para el título, pero no aplica nada al contenedor de `children`
- Páginas `/p/*` y `/login` saltan el AppShell — su layout es el `<div className="min-h-screen bg-page-bg">` de `src/app/p/layout.tsx` (sin tamaño tipográfico).

**Conclusión wrappers**: **ningún ancestro impone font-size**. El browser default (~16px en `html`) define el `1rem` que usan las utilidades de Tailwind.

---

## 5. Caminos para reducir tipografía en mobile

### A) Override de tokens `--text-*` con media query (recomendado)

```css
/* en globals.css */
@media (max-width: 767px) {
  :root {
    --text-xs: 0.7rem;
    --text-sm: 0.8rem;
    --text-base: 0.9rem;
    --text-lg: 1rem;
  }
}
```

- **Cubre**: ~317 hits (xs/sm/base/lg) automáticamente.
- **No afecta**: spacings (`p-*`, `m-*`, `gap-*`) → layout intacto.
- **No afecta**: los ~90 `text-[Npx]` arbitrarios → quedan en pixeles fijos (inconsistencia residual en cards de números grandes, page-title, etc.).
- **Riesgo**: bajo. Solo escala lo nombrado. Reversible en un archivo.

### B) Bajar `html { font-size }` en mobile

```css
@media (max-width: 767px) { html { font-size: 14px; } }
```

- **Cubre**: todo lo que esté en `rem` (tipografía nombrada **y** TODO el spacing de Tailwind v4, que también es `rem`).
- **Riesgo alto**: encoge spacings, alturas fijas (`h-9`, `w-[220px]` si fuera `rem`), `gap-*`. Puede romper grids y el sticky header de 52px.
- **No afecta** los `text-[Npx]` arbitrarios (siguen en pixeles absolutos).
- **No recomendado** sin un paso previo de fijar `--spacing` en px.

### C) Componente por componente (`text-xs md:text-sm` etc.)

- **Cubre**: todo, con control quirúrgico.
- **Costo**: ~400 cambios en 60+ archivos.
- **Riesgo**: alto por volumen de diff, no por mecánica.

---

## 6. Recomendación

**Camino A** como primera pasada: 5–10 líneas en `globals.css`, sin tocar componentes, sin afectar layout. Después de verlo en mobile, decidir si vale la pena ir por los `text-[Npx]` arbitrarios uno a uno (probablemente solo los 10–18px — los 22–28px de totales destacados quizá no quieras reducir).

Si se busca garantía absoluta de cero riesgo de layout shift, **Camino C** acotado solo a las 5–10 páginas más usadas en celular (`/`, `/deuda`, `/cliente`, `/producto`, `/caja`) cubre el 80% del valor con ~40 cambios.

## 7. Pendiente / próximas decisiones

- Decidir camino (A vs C, o combinación).
- Si A: definir si reducir también `text-base`/`text-lg` o solo `text-xs`/`text-sm`.
- Si A: política para los `text-[Npx]` arbitrarios — ¿dejar como excepciones intencionales o normalizar a tokens?
