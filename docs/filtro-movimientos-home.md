# Filtro de movimientos en la página principal

Fecha: 2026-06-05
Alcance:
- `src/app/page.tsx`
- `src/components/ventas/filter-sheet.tsx` (nuevo)
- `src/services/documento-service.ts` (`getVentas`)
- `src/types/database.ts` (`Documento`)

## Requerimiento

En la página principal debe existir un icono de filtro; al pulsarlo aparece un
panel con distintos **tipos** de filtro: Método de pago, Usuario, Cliente.

## Decisiones (validadas con el usuario)

1. **UI**: bottom Sheet (deslizante desde abajo), óptimo en móvil.
2. **Alcance**: los filtros refinan **solo la lista** de Ingresos/Gastos. Las
   `BalanceCards` siguen mostrando los totales del periodo (no se recalculan).
3. **Selección**: multi-selección por tipo. OR dentro de cada tipo, AND entre
   tipos.

## Implementación

### Backend — `getVentas` (`documento-service.ts`)

El listado de la home solo traía `*, Cliente(*)`, por lo que Método de pago y
Usuario llegaban solo como id, sin nombre. Se enriqueció el `select`:

```
*, Cliente(*), MetodoPago(Nombre),
UsuarioCreacion:SistemaUsuario!FK_Documento_UsuarioCreacion(Nombre)
```

El embed de `SistemaUsuario` necesita el hint de FK explícito porque `Documento`
tiene dos FKs a esa tabla (creación y modificación).

### Tipo — `Documento` (`database.ts`)

Se agregó el embed opcional `MetodoPago?: { Nombre: string } | null`
(`UsuarioCreacion` ya existía).

### Componente — `FilterSheet`

- Botón icono `SlidersHorizontal` con badge del nº de filtros activos.
- Bottom Sheet con una sección por tipo; las opciones se construyen con los
  **valores distintos presentes en el periodo cargado** (no se consultan
  catálogos completos). Se ocultan los tipos sin valores.
- Presentación por tipo:
  - **Método de pago**: chips toggle (pocos valores).
  - **Usuario** y **Cliente**: `CheckDropdown` (dropdown con checkboxes,
    `DropdownMenuCheckboxItem`), apto para muchos valores. El menú no se cierra
    al marcar, permitiendo multi-selección continua.
- Footer con "Limpiar" y "Aplicar" (usa un borrador local y solo confirma al
  pulsar Aplicar).
- Exporta helpers reutilizables: `VentaFilter`, `EMPTY_FILTER`,
  `contarFiltros`, `pasaFiltro`.

### Home — `page.tsx`

- Estado `filtros: VentaFilter`.
- `FilterSheet` colocado a la derecha del `SearchInput` (fila flex).
- Se calculan `displayIngresos` / `displayGastos` aplicando `pasaFiltro` sobre
  los arreglos ya filtrados por búsqueda. La lista renderiza desde estos; el
  Balance sigue calculándose desde `filtered*` (sin filtros), cumpliendo la
  decisión 2.

## Pendientes / próximas decisiones

- Si en el futuro se quiere filtrar por valores **no presentes** en el periodo
  (catálogo completo de métodos/usuarios), habría que cargar esos catálogos
  aparte en vez de derivar las opciones de la lista.
- Evaluar añadir más tipos (ej. estado crédito/contado) si se solicita.
