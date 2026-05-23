# Fase 7: Responsividad mobile y polish

## Objetivo
Mejorar la experiencia móvil con touch targets adecuados, error boundary, detector de conectividad y refinamientos responsive.

## Implementaciones

### Touch targets
Apple y Google recomiendan un mínimo de 44px para elementos táctiles.

**Cambios en `src/components/ui/button.tsx`**:

| Tamaño | Antes | Después |
|--------|-------|---------|
| default | `h-8` (32px) | `h-10` (40px) |
| xs | `h-6` (24px) | `h-7` (28px) |
| sm | `h-7` (28px) | `h-9` (36px) |
| lg | `h-9` (36px) | `h-11` (44px) |
| icon | `size-8` (32px) | `size-10` (40px) |
| icon-xs | `size-6` (24px) | `size-7` (28px) |
| icon-sm | `size-7` (28px) | `size-9` (36px) |
| icon-lg | `size-9` (36px) | `size-11` (44px) |

**Cambios en `src/components/ui/input.tsx`**:
- `h-8` → `h-10` (32px → 40px)
- `px-2.5 py-1` → `px-3 py-2` (padding aumentado)

### Error boundary — `src/components/shared/error-handler.tsx`
Componente class-based (requerido por React para error boundaries).

**Comportamiento**:
- Captura errores de renderizado en el árbol de componentes hijos
- Muestra fallback: "Ocurrió un error" + mensaje del error + botón "Reintentar"
- Acepta `fallback` prop personalizado
- Botón "Reintentar" resetea el estado del error boundary

**Integración en `layout.tsx`**:
```tsx
<ConnectionStatus />
<ErrorBoundary>
  <TooltipProvider>
    <AppShell>{children}</AppShell>
  </TooltipProvider>
</ErrorBoundary>
```

### Detector de conectividad — `src/components/shared/connection-status.tsx`
Banner que aparece cuando el navegador detecta que está offline.

**Comportamiento**:
- Escucha eventos `online`/`offline` del `window`
- Cuando está online → renderiza `null` (invisible)
- Cuando está offline → banner rojo fijo arriba: "Sin conexión a internet" con ícono WifiOff
- `z-[100]` para estar por encima de todo

**Justificación**: La app usa exclusivamente Supabase (no hay BD local ni sync offline). Perder conectividad significa que la app no puede funcionar — el banner da feedback inmediato.

### Navegación móvil — ya implementada en Fase 0
- **Bottom nav fija** (`mobile-nav.tsx`): 5 tabs, `fixed bottom-0`, `md:hidden`
- **Sidebar desktop** (`app-shell.tsx`): visible en `md:` y superior
- **Sheet móvil** (`app-shell.tsx`): hamburguesa abre drawer con NavMenu
- Contenido principal: `pb-20 md:pb-4` (espacio para bottom nav en mobile)

### Grids responsive — ya implementados en fases anteriores

| Página | Clases | Breakpoints |
|--------|--------|-------------|
| BalanceCards | `grid-cols-2 md:grid-cols-4` | 2 cols mobile, 4 cols desktop |
| Producto grid | `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` | 2/3/4 cols |
| VentaForm products | `grid-cols-2 md:grid-cols-3` | 2/3 cols |
| VentaAll grid | `grid-cols-2 md:grid-cols-5` | 2/5 cols |

### Suspense boundaries — Fase 4
Todas las páginas que usan `useSearchParams()` están envueltas en `<Suspense>`:

- `producto-form/page.tsx` → `ProductoFormContent` envuelta en Suspense
- `venta-abono/page.tsx` → `VentaAbonoContent` envuelta en Suspense
- `venta-gasto/page.tsx` → `VentaGastoContent` envuelta en Suspense

## Verificación final
Build exitoso con todas las 13 rutas compilando sin errores:
```
○ /                    (Static)
○ /bluetoothprinter    (Static)
○ /cliente             (Static)
ƒ /cliente/datos/[id]  (Dynamic)
○ /deuda               (Static)
○ /producto            (Static)
○ /producto-form       (Static)
○ /venta               (Static)
○ /venta-abono         (Static)
ƒ /venta-detalle/[id]  (Dynamic)
ƒ /venta-form/[id]     (Dynamic)
○ /venta-gasto         (Static)
○ /venta-lista         (Static)
```