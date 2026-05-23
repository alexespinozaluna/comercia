# Fase 1: Capa de datos (types, services, store)

## Objetivo
Implementar las interfaces TypeScript, servicios CRUD y store de estado global.

## Archivos creados

### `src/types/database.ts`
Interfaces TypeScript que reflejan el esquema Supabase. Columnas en PascalCase (igual que la DB).

- **BaseEnty**: `{ id: number; FechaCreacion: string }` — base para todas las entidades
- **Producto**: nombre, precios, cantidad
- **Cliente**: nombre, teléfono, documento, comentario + relación `ClienteDireccion[]`
- **ClienteDireccion**: dirección, teléfono, contacto, `bPrincipal`
- **MetodoPago**: `id`, `Nombre`
- **Documento**: venta/gasto con `DocumentoItem[]`, `Cliente`, `bCredito`, `Saldo`, `IdMetodoPago`
- **DocumentoItem**: línea de venta con `PrecioVenta`, `MontoAbono`, `IdDocumentoRef`
- **DocumentoDisplay**: extiende Documento con campos computados (`FormaVenta`, `NroVenta`)
- **toDisplayDocumento(doc)**: helper que mapea Documento → DocumentoDisplay
- **ResumenAbono**: agrupación de deudas por cliente
- **HistoryState**: estado de filtros persistido en sessionStorage
- **BasketItem**: item en canasta con `_tempId` para keys del lado cliente

### `src/services/supabase-service.ts`
CRUD genérico parametrizado por tabla. Puerto directo del `SupabaseService<T>` de C#.

```typescript
getAll<T>(table, select?)      // SELECT * con select opcional
getById<T>(table, id, select?) // SELECT por id, retorna null si no existe (maneja PGRST116)
add<T>(table, item)            // INSERT, limpia id:0/id:undefined antes (cleanJsonId)
update<T>(table, id, item)    // UPDATE por id, usa `as any` para compatibilidad con supabase client
deleteItem(table, id)          // DELETE por id
```

**Patrón cleanJsonId**: Antes de insertar, elimina `id: 0` o `id: undefined` para que Supabase auto-genere el ID. Puerto del `CleanJsonId` de C#.

**Exports adicionales**: `SUPABASE_URL` y `REST_URL` para servicios que necesitan llamadas REST directas.

### `src/services/producto-service.ts`
Facade simple sobre supabase-service para la tabla `Producto`. Sin lógica de dominio adicional.

### `src/services/cliente-service.ts`
Servicio con soporte master-detail (Cliente + ClienteDireccion).

- `getAllWithDirecciones()`: Usa `*, ClienteDireccion(*)` (join de Supabase)
- `getByIdWithDirecciones(id)`: Un cliente con sus direcciones
- `saveClienteConDirecciones(idCliente, cliente)`: **Diff-based save**
  1. Si `idCliente` es null → INSERT cliente, obtener nuevo ID
  2. Si `idCliente` > 0 → UPDATE cliente
  3. Buscar direcciones actuales en DB
  4. Comparar con las enviadas:
     - Direcciones sin `id` o `id: 0` → INSERT
     - Direcciones con `id` que existen en ambos lados → UPDATE
     - Direcciones existentes en DB pero no en el envío → DELETE
  5. Retornar el ID del cliente

**Puerto directo del `ClienteService.cs`** del MAUI original.

### `src/services/documento-service.ts`
El servicio más complejo. Dos estrategias de guardado:

- **`crearVentaConItems(venta)`**: Patrón de rollback
  1. INSERT documento padre
  2. Asignar `IdDocumento` del padre a cada item
  3. INSERT items
  4. Si falla algún item → DELETE del padre (rollback)

- **`modificarVentaConItems(id, venta)`**: Patrón diff-based
  1. UPDATE documento padre
  2. Buscar items actuales en DB
  3. Diff: insertar nuevos, actualizar existentes, eliminar los removidos

Otros métodos:
- `getVentas(fechaIni, fechaFin, bCredito, idCliente)`: Lista filtrada con join de cliente
- `getVentaConItem(id)`: Un documento con items y cliente
- `getTicketText(id, width)`: Llama RPC `generate_ticket_text` en Supabase
- `getClienteDirecciones(idCliente)`: Direcciones de un cliente
- `getMetodoPago()`: Métodos de pago disponibles
- `delete(id)`: Eliminar documento

### `src/stores/app-store.ts`
Store Zustand que reemplaza el `RefreshService` (eventos) y el estado disperso de los componentes.

**Estado de filtros** (persistido en sessionStorage):
- `filterTipo`, `filterFechaInicio`, `filterFechaFin`, `filterIndex`

**Estado de canasta** (formulario de venta):
- `basketItems: BasketItem[]`, `basketClient`, `basketClientDireccion`, `basketIsCredit`, `basketFecha`

**Acciones**:
- `setFilter(tipo, index, fechaInicio, fechaFin)`: Actualiza filtros y guarda en sessionStorage
- `addToBasket`, `removeFromBasket`, `updateBasketItem`, `clearBasket`
- `setBasketClient`, `setBasketClientDireccion`, `setBasketIsCredit`, `setBasketFecha`
- `triggerRefresh()`: Incrementa `refreshCounter` para que páginas se re-fetchen

## Lecciones aprendidas
- `supabase.from("Tabla").update(data)` requiere `as any` porque los tipos de supabase-js son estrictos
- Supabase REST devuelve error `PGRST116` cuando un `.single()` no encuentra filas — hay que manejarlo como `null`
- El patrón diff-based de C# se porta bien en TypeScript; la clave es buscar el estado actual desde DB antes de comparar