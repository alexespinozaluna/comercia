# Comercia Web — Arquitectura General

## Resumen
Comercia.Web es una aplicación POS (punto de venta) construida con Next.js App Router que migra la app original .NET MAUI Blazor Hybrid a una web responsive. Comparte el mismo backend Supabase.

## Stack tecnológico
| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript |
| UI | shadcn/ui + Tailwind CSS (Base UI internamente) |
| Estado | Zustand |
| Datos | @supabase/supabase-js directo (sin API routes) |
| Impresión | Web Bluetooth API |
| Iconos | Lucide React |
| Fechas | date-fns con locale es-ES |
| Notificaciones | Sonner (toast) |

## Estructura de directorios

```
src/
  app/                          # Páginas (App Router)
    layout.tsx                  # Layout raíz
    page.tsx                    # Home = VentasLista
    venta-lista/page.tsx        # Redirect a /
    venta/page.tsx              # VentasListaAll
    venta-form/[id]/page.tsx    # Crear/editar venta
    venta-detalle/[id]/page.tsx # Detalle de venta
    venta-abono/page.tsx        # Abono a deuda
    venta-gasto/page.tsx        # Gasto
    deuda/page.tsx              # Lista de deudas
    producto/page.tsx           # Lista de productos
    producto-form/page.tsx      # Crear/editar producto
    cliente/page.tsx            # Lista de clientes
    cliente/datos/[id]/page.tsx # Crear/editar cliente
    bluetoothprinter/page.tsx   # Prueba de impresora

  components/
    layout/
      app-shell.tsx             # Shell: sidebar + Sheet + bottom nav
      nav-menu.tsx              # Menú de navegación (5 items)
      mobile-nav.tsx            # Bottom nav fija (mobile)
    ventas/
      date-filter-bar.tsx       # Filtro de fechas
      balance-cards.tsx         # 4 tarjetas de balance
      venta-list-item.tsx       # Item de venta
      product-card.tsx          # Card de producto
      basket-detail.tsx         # Detalle de canasta
      basket-bar.tsx             # Barra sticky inferior
      payment-type-selector.tsx # Pagado/Crédito
      client-assignment.tsx     # Selector de cliente
      receipt-renderer.tsx     # Generación de ticket con Canvas
    deuda/
      deuda-detail.tsx          # Detalle de deuda por cliente
    shared/
      printer-dialog.tsx        # Diálogo de impresora Bluetooth
      error-handler.tsx          # Error boundary
      connection-status.tsx      # Banner offline

  lib/
    supabase.ts                 # Cliente singleton
    format.ts                   # Formateo moneda, fechas, iniciales
    date-utils.ts               # Rangos de fechas para filtros
    bluetooth-printer.ts         # Servicio Web Bluetooth
    utils.ts                    # cn() para Tailwind

  services/
    supabase-service.ts         # CRUD genérico
    producto-service.ts          # CRUD Producto
    cliente-service.ts           # CRUD Cliente + direcciones (master-detail)
    documento-service.ts         # CRUD Documento + items (master-detail con rollback)

  stores/
    app-store.ts                # Zustand: filtros, canasta, refresh

  types/
    database.ts                 # Interfaces TypeScript (PascalCase)

  hooks/
    use-bluetooth-printer.ts    # Hook React para Bluetooth
```

## Patrones clave

### CRUD genérico
`supabase-service.ts` provee `getAll`, `getById`, `add`, `update`, `deleteItem` para cualquier tabla. Los servicios específicos delegan a estas funciones.

### Master-detail con diff
`cliente-service` y `documento-service` implementan el patrón diff-based:
1. Buscar hijos actuales en DB
2. Comparar con los enviados
3. INSERT nuevos, UPDATE existentes, DELETE removidos

### CleanJsonId
Antes de insertar, se elimina `id: 0` o `id: undefined` para que Supabase auto-genere el ID.

### Estado con Zustand
- Filtros: persistidos en sessionStorage
- Canasta: estado local del formulario de venta
- Refresh counter: incrementado para señalar re-fetch

### Suspense boundaries
Todas las páginas con `useSearchParams()` envuelven su contenido en `<Suspense>` con fallback de carga.

### Web Bluetooth
- Módulo de bajo nivel (`bluetooth-printer.ts`) con estado mutable
- Hook React (`use-bluetooth-printer.ts`) que encapsula el módulo
- Diálogo (`printer-dialog.tsx`) para seleccionar dispositivo
- Escritura por chunks de 512 bytes para respetar MTU de BLE

## Convenciones

### Nombres de columnas
PascalCase (igual que las columnas Supabase): `IdCliente`, `bCredito`, `FechaEmision`, etc.

### Rutas
- Formularios de creación: `[entidad]/datos/0` o `entidad-form?id=0`
- Formularios de edición: `[entidad]/datos/[id]` o `entidad-form?id=[id]`
- Parámetros de retorno: `referencia` o `pagina` query param

### UI en español
Todos los textos de la interfaz están en español (es-ES).

### shadcn/ui con Base UI
**NO usar `asChild`** en SheetTrigger, DropdownMenuTrigger, etc. Base UI no lo soporta — estilizar el trigger directamente con `className`.