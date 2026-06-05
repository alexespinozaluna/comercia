# Venta a crédito: cliente obligatorio y forma de pago condicional

Fecha: 2026-06-05
Alcance:
- `src/hooks/use-pos-transaction.ts`
- `src/hooks/pos/use-metodo-pago.ts`
- `src/components/ventas/pos/CartSummary.tsx`
- `src/components/ventas/pos/ClientSelector.tsx`
- `src/components/ventas/pos/PosShell.tsx`

## Requerimiento

1. En venta a **crédito**, el cliente es **obligatorio y debe ser real**
   (`IdCliente ≠ 0`): no vale el cliente común (id 0) que se precarga por
   defecto.
2. La **forma de pago por defecto** debe ser **Efectivo**.
3. En **crédito** la forma de pago **no aplica y no debe mostrarse**.

## Decisiones (validadas con el usuario)

1. Al cambiar a crédito con el cliente común seleccionado: **no** se auto-limpia;
   se valida al guardar.
2. Botón "Guardar venta": **deshabilitado** mientras falte el cliente real, con
   **aviso inline** en la sección Cliente.

## Implementación

### 1. Cliente obligatorio en crédito (`use-pos-transaction.ts`)

- `canSave` ahora incluye `clienteCreditoOk = !isCredit || (cliente.id != null &&
  cliente.id !== DEFAULT_CLIENT_ID)`. Con crédito sin cliente real, el botón se
  deshabilita.
- La validación de `handleSave` rechaza `cliente.id == null || cliente.id ===
  DEFAULT_CLIENT_ID` (antes solo `== null`, por lo que el común id 0 pasaba).

### 2. Aviso inline (`ClientSelector.tsx` + `PosShell.tsx`)

- `ClientSelector` recibe `requireRealClient` (= `pos.isCredit`). Si está activo y
  no hay cliente real (id null o 0), muestra el aviso "Las ventas a crédito
  requieren seleccionar un cliente" tanto en el estado sin cliente como cuando
  está el común seleccionado.

### 3. Forma de pago por defecto Efectivo (`use-metodo-pago.ts`)

- El default deja de ser `data[0]` y pasa a ser el método con `bEfectivo ===
  true` (fallback al primero si ninguno está marcado).

### 4. Ocultar forma de pago en crédito (`CartSummary.tsx` + `use-pos-transaction.ts`)

- `FormaPagoChips` solo se renderiza cuando `!isCredit`.
- Al guardar, `IdMetodoPago = isCredit ? null : metodo.selectedId` (en crédito no
  se persiste método de pago).

## Notas

- `DEFAULT_CLIENT_ID = 0` se exporta desde `use-cliente-seleccionado.ts`.
