# Corrección del método de pago en el detalle del documento

**Fecha:** 2026-07-11
**Estado:** ✅ Implementado (solo frontend + service + ruta API; sin migración).
**Motivo:** a veces se marca el método de pago equivocado al registrar; hay que poder corregirlo sin re-hacer el documento.

## Qué hace

En `/venta-detalle/{id}`, la fila "Método de pago" muestra un lápiz para **corregir** el método. Abre un selector (Sheet inferior con pills) y guarda el cambio con un update de un solo campo.

## Reglas (valores recomendados aplicados)

- **Elegibilidad:** solo documentos con método real → `!bCredito` y tipo ∉ {Ajuste (5), Abono con saldo a favor (6)}. Es decir: **Venta contado, Abono, Gasto, Saldo a favor (captura)**.
  - **Venta a crédito NO** se corrige aquí: su método es el placeholder **"Deuda"**; los métodos reales están en los abonos → se corrigen en cada abono.
- **Caja:** solo mientras **la caja del documento siga abierta** (`cajaOk`), porque cambiar el método re-categoriza el arqueo y el reporte de ingresos por método. Enforced en frontend (visibilidad) y backend (la caja de la sucursal debe estar abierta y coincidir con `doc.IdCaja`).
- **Permiso:** `PERMISOS.CAJA_Y_GASTOS` (ADMIN, CAJERO; SUPERVISOR bloqueado por ser solo-lectura).
- **Método destino:** de `/api/metodo-pago`, que ya excluye "Deuda" (`bDeuda`). El backend revalida que el método es del tenant y no es Deuda.
- **Auditoría:** update vía `auditUpdate` → `IdUsuarioModificacion` + `FechaModificacion`; el trigger `DocumentoAudit` deja rastro (importante porque re-categoriza dinero).

## Piezas

| Archivo | Rol |
|---|---|
| `src/app/api/documentos/[id]/metodo-pago/route.ts` | **Nueva** ruta `PATCH`: valida caja abierta + delega en el service. `exposeErrors` para mostrar reglas de negocio. |
| `src/services/documento-service.ts` | **Nuevo** `actualizarMetodoPago(id, idMetodoPago, tenant, user, negocio?, idCajaAbierta?)`: valida método (no Deuda), elegibilidad del doc y caja; update de un solo campo, auditado, aislado por tenant/sucursal. |
| `src/components/ventas/metodo-pago-corrector-sheet.tsx` | **Nuevo** selector (pills) que hace `PATCH` y refresca. Usa `useGuardar` (anti doble-submit). |
| `src/app/venta-detalle/[id]/page.tsx` | Lápiz "Corregir" en la fila de método (cuando `canCorregirMetodo`); render del Sheet; refetch con `reload` de `useResource`. |
| `src/lib/api-client.ts` | **Nuevo** `apiPatch<T>()`. |

## Notas de diseño

- Ruta genérica `/api/documentos/[id]/...` (no `/api/ventas/...`) porque aplica a abonos, gastos y saldo a favor, no solo ventas.
- Update mínimo: **no** toca items, saldos ni RPCs. Un solo campo.
- La validación de negocio se repite en el backend (no se confía en el gate del frontend).
