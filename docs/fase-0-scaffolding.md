# Fase 0: Scaffolding y Fundación

## Objetivo
Crear la base del proyecto Next.js con todas las dependencias, configuración y layout inicial.

## Tecnologías elegidas
- **Framework**: Next.js 16 (App Router) con TypeScript
- **UI**: shadcn/ui + Tailwind CSS (usa Base UI internamente, NO Radix)
- **Acceso a datos**: @supabase/supabase-js directo (sin API routes)
- **Estado**: Zustand (reemplaza RefreshService de MAUI)
- **Impresión**: Web Bluetooth API
- **Fechas**: date-fns con locale es-ES

## Ubicación del proyecto
`D:\Proyectos\comercia-web`

> **Nota importante**: El proyecto NO puede estar dentro de una ruta que contenga `#` (como `C#`) porque Tailwind CSS/Turbopack falla con `ERR_INVALID_ARG_VALUE` al interpretar `#` como null byte.

## Dependencias instaladas

### Core
- `next`, `react`, `react-dom`
- `typescript`, `@types/react`, `@types/node`

### UI
- `tailwindcss`, `@tailwindcss/postcss`
- shadcn/ui components: button, card, input, dialog, sheet, tabs, toast (sonner), radio-group, badge, avatar, separator, dropdown-menu, calendar, table, alert-dialog, command, popover, switch, textarea, alert, tooltip

### Datos y estado
- `@supabase/supabase-js`
- `zustand`
- `date-fns`

### Iconos
- `lucide-react`

## Estructura de archivos creados

```
src/
  app/
    layout.tsx          # Layout raíz (lang="es", AppShell, Toaster, ErrorBoundary, ConnectionStatus)
    page.tsx            # Home = VentasLista
    globals.css         # Estilos globales con Tailwind
  components/
    layout/
      app-shell.tsx     # Shell responsive: sidebar desktop + Sheet mobile + bottom nav
      nav-menu.tsx      # Menú lateral con 5 items
      mobile-nav.tsx     # Bottom nav fija (md:hidden)
  lib/
    supabase.ts         # Cliente singleton Supabase
    format.ts           # Formateo de moneda, fechas, iniciales
    date-utils.ts       # Rangos de fechas para filtros
    utils.ts            # Utilidad cn() para Tailwind
  types/
    database.ts         # Interfaces TypeScript
  services/
    supabase-service.ts # CRUD genérico
    producto-service.ts
    cliente-service.ts
    documento-service.ts
  stores/
    app-store.ts        # Zustand store global
```

## Variables de entorno (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://batvmattcpuzjrbniqdl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

## Layout raíz (`layout.tsx`)
- `lang="es"` en el `<html>`
- Fuente: Geist Sans
- Envuelve hijos en: `ConnectionStatus` > `ErrorBoundary` > `TooltipProvider` > `AppShell`
- `Toaster` de sonner con posición `bottom-left`

## App Shell (`app-shell.tsx`)
- **Desktop**: Sidebar fija de 56px con logo "Comercia" y `NavMenu`
- **Mobile**: Header con hamburguesa que abre un `Sheet` (slide-over) con `NavMenu`
- **Mobile bottom nav**: `MobileNav` fija abajo con 5 tabs
- El contenido principal tiene `pb-20 md:pb-4` para dejar espacio al bottom nav

## Navegación
5 items iguales en sidebar, Sheet y bottom nav:

| Label | Ruta | Icono |
|-------|------|-------|
| Balance | `/` | Store |
| Deudas | `/deuda` | BookOpen |
| Inventario | `/producto` | Package |
| Clientes | `/cliente` | User |
| Ventas | `/venta` | LayoutGrid |

## Lecciones aprendidas
- **shadcn/ui usa Base UI**, NO Radix. No usar `asChild` en SheetTrigger, DropdownMenuTrigger, etc.
- **`useSearchParams()` requiere Suspense** en Next.js App Router — el componente que lo usa debe estar envuelto en `<Suspense>`