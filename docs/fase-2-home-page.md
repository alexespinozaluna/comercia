# Fase 2: Home page (VentasLista + VentasListaAll)

## Objetivo
Implementar la página principal con filtros de fecha, tarjetas de balance, tabs de ingresos/gastos y lista de ventas.

## Archivos creados

### `src/app/page.tsx` — Home (VentasLista)
Página principal que muestra:

1. **DateFilterBar** — Selector de rango de fecha (Dia, Semana, Mes, Año)
2. **BalanceCards** — 4 tarjetas: Balance, Efectivo, Abono, Gastos
3. **Tabs** — Ingreso / Gastos con listado de ventas
4. **Botones de acción** — Nueva venta, Nuevo gasto

Flujo de datos:
- Al montar o cambiar filtros → llama `documentoService.getVentas()` con los parámetros del filtro
- Calcula totales (balance, efectivo, abono, gastos) desde las ventas obtenidas
- `useAppStore` para leer y guardar filtros en sessionStorage
- Cada venta se renderiza como `VentaListItem` con link a `/venta-detalle/[id]?referencia=/`

### `src/app/venta-lista/page.tsx` — Redirect
Simple redirect a `/` para compatibilidad de rutas.

### `src/app/venta/page.tsx` — VentasListaAll
Tabla/grid completa de todas las ventas con campo de búsqueda.

### Componentes

#### `src/components/ventas/date-filter-bar.tsx`
Dropdown de filtros de fecha usando DropdownMenu de shadcn/ui.

- Criterios: Dia, Semana, Mes, Año
- Usa `obtenerRangosDeFechas()` de `date-utils.ts`
- Al seleccionar un rango → actualiza el store y dispara refresh
- **Nota**: Usa Base UI DropdownMenuTrigger (sin `asChild`, styled directamente)

#### `src/components/ventas/balance-cards.tsx`
Grid de 4 cards responsivas (`grid-cols-2 md:grid-cols-4`):
- Balance (ingresos - gastos)
- Efectivo (ventas pagadas)
- Abono (pagos recibidos)
- Gastos (total de gastos)

#### `src/components/ventas/venta-list-item.tsx`
Item individual de venta con:
- Nombre del cliente o "Sin cliente"
- Concepto/descripción
- Monto formateado con `numToString()`
- Fecha con `fechaString()`
- Link a `/venta-detalle/[id]?referencia=/`

## Librerías portadas

### `src/lib/format.ts` — Puerto de `Fn.cs`
- `numToString(value, format)`: Formato moneda es-ES (`$ 37.500`, `$ 37.500,00`)
- `fechaCortaHora(fecha, fechaHora)`: `dd/MMM | h:mm tt`
- `fechaString(fechaHora)`: `dd/MM/yy`
- `extraerIniciales(nombre)`: Primeras dos palabras → iniciales
- `sbsLeft(value, cant)`: Truncar con `...`

### `src/lib/date-utils.ts` — Puerto de `FechaHelper.cs`
- `FiltroFecha`: `{ bActual, FechaInicio, FechaFin, FechaTexto }`
- `obtenerRangosDeFechas(criterio)`: Genera rangos para "Hoy", "Dia", "Semana", "Mes", "Ano"
- El primer rango de cada conjunto tiene `bActual: true`

## Responsividad
- BalanceCards: `grid-cols-2` en mobile, `grid-cols-4` en desktop
- DateFilterBar: DropdownMenu responsive
- VentaListItem: Card con padding adecuado para touch