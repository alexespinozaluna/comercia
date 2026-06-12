# Cliente por defecto: ya no aparece preseleccionado (2026-06-12)

## Decisión

En los flujos de venta (wizard móvil y POS desktop) el selector de cliente
**arranca vacío**. El cliente común (id 0) y su dirección por defecto se
asignan **al guardar** cuando no se seleccionó ninguno. Antes el hook
preseleccionaba el cliente común al montar y la card aparecía ocupada.

Lo persistido no cambia: una venta sin cliente elegido sigue guardándose
con `IdCliente = 0` y la dirección por defecto del común, igual que antes.

## Implementación

- `use-cliente-seleccionado`: `loadDefault` ya no hidrata la selección;
  guarda el común en un estado `fallback` interno y expone:
  - `idEfectivo` — el seleccionado, o el común si no hay selección.
  - `direccionIdEfectiva` — la dirección del seleccionado, o la del común.
  La validación de deuda sigue usando `id` (exige cliente real).
- `use-pos-transaction` y `VentaMovilWizard`: `loadDefault: true` siempre
  (antes `!isEdit`; ya no hay conflicto porque el fallback no toca la
  selección) y el payload usa `idEfectivo`/`direccionIdEfectiva`.
- `use-venta-edicion`: al editar una venta del cliente común NO lo hidrata —
  el selector queda vacío y el guardado lo reasigna como fallback. Las
  ventas con cliente real se hidratan igual que siempre.

## Verificación

Lint + tsc limpios; e2e de cliente-selector pasando. Validar en app:
venta nueva sin tocar cliente → debe guardarse con el cliente común; venta
a deuda sin cliente → debe seguir exigiendo selección.
