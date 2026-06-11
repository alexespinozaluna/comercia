# Auditoría de doble submit en formularios (2026-06-10)

## Problema reportado

Algunos formularios guardaban registros duplicados al presionar dos veces seguidas el botón
"Guardar" (ej.: crear cliente). La causa: el handler `handleSave` es `async` y el botón
permanecía habilitado mientras la petición estaba en vuelo, por lo que un segundo clic
disparaba un segundo `POST`.

## Alcance de la auditoría

Se revisaron todos los puntos del frontend que hacen `apiPost`/`apiPut` desde un botón o
formulario, verificando si tenían protección anti–doble envío (estado `saving` + guard +
`disabled`).

## Resultado

### Formularios SIN protección (corregidos en esta auditoría)

| Formulario | Archivo | Riesgo |
|---|---|---|
| Cliente (alta/edición) | `src/app/cliente/datos/[id]/page.tsx` | Cliente duplicado (el caso reportado) |
| Producto (alta/edición) | `src/app/producto/datos/[id]/page.tsx` | Producto duplicado + stock inicial duplicado |
| Abono | `src/app/venta-abono/page.tsx` (`handleSave`) | **Crítico**: abono cobrado dos veces, baja doble del Saldo |
| Gasto | `src/app/venta-gasto/page.tsx` | Gasto duplicado en caja |

### Formularios que YA estaban protegidos (sin cambios)

- POS / venta (`CartSummary.tsx` + `CartBottomBar.tsx`): guard `if (saving) return` + botón deshabilitado.
- Saldo a favor (`saldo-favor/page.tsx`): registrar y editar con `saving`.
- Aplicar saldo a favor (`venta-abono/page.tsx`, `handleUsarSaldoFavor`): `aplicandoFavor`.
- Caja apertura/cierre (`caja/page.tsx`): `actionLoading`.
- Configuración negocio (`configuracion/page.tsx`): `saving`.
- Usuarios (`configuracion/usuarios/[id]/page.tsx`): `saving`.
- Cliente rápido en venta (`cliente-selector-sheet.tsx`): `saving`.
- Producto rápido en venta (`ProductQuickCreate.tsx`): `saving`.
- Registro de baja / ajuste kardex (`registro-baja-form.tsx`): `saving`.
- Categorías (`categoria-select.tsx`): `busy`.
- Login (`login/page.tsx`): `loading`.
- Compartir deuda WhatsApp (`BotonCompartirDeuda.tsx`): `loading`.
- Selector de negocio (`negocio-selector.tsx`): `switching`.
- Restaurar venta eliminada (`venta-eliminadas/page.tsx`): el botón vive dentro de un
  `AlertDialog` que se cierra al confirmar, así que no admite doble clic; además restaurar
  es idempotente.

## Patrón aplicado (convención del proyecto)

```tsx
const [saving, setSaving] = useState(false);

const handleSave = async () => {
  if (saving) return;            // guard re-entrada
  // ...validaciones...
  setSaving(true);
  try {
    // apiPost / apiPut
  } catch (err) {
    // toast.error
  } finally {
    setSaving(false);
  }
};

<Button onClick={handleSave} disabled={saving}>
  {saving ? "Guardando..." : "Guardar"}
</Button>
```

Todo formulario nuevo con botón de guardar debe seguir este patrón.

## Nota pendiente (defensa en profundidad)

La protección actual es solo de UI. Si se quisiera blindar también el backend contra
duplicados (p. ej. reintentos de red del PWA), la opción sería una clave de idempotencia
por request o un constraint de unicidad razonable por tabla. No se implementó en esta
pasada por no ser necesario para el caso reportado.

## Verificación

- `npm run lint` ✅
- `npx tsc --noEmit` ✅
