# Análisis: abstracción de guardado (hook `saving`) y transaccionalidad real (2026-06-10)

> Análisis solicitado tras la auditoría de doble submit
> (`auditoria-doble-submit-formularios-2026-06-10.md`).
>
> **Actualización 2026-06-11**: puntos 1, 2 y 3 implementados.
>
> - Puntos 2 y 3 (RPCs transaccionales): migración
>   `20260611020000_guardar_cliente_producto_rpc.sql` (**aplicada**); los routes de
>   clientes (POST/PUT) y productos (POST) quedaron como capa fina sobre los RPC. El
>   diff de direcciones se calcula dentro de la función (el route manda la lista
>   completa deseada).
> - Punto 1: hook `useGuardar` creado en `src/hooks/use-guardar.ts` y migrados los 16
>   puntos de guardado del frontend (formularios CRUD, POS, caja, login, categorías,
>   selector de sucursal, compartir deuda). Regla agregada a CLAUDE.md. De paso se
>   corrigió un bug latente en el POS: si el guardado de la venta fallaba (stock/caja),
>   `CartSummary` dejaba `saving=true` para siempre y el botón quedaba inutilizado;
>   ahora el `finally` del hook lo libera.
>
> Pendiente: punto 4 (idempotency keys), ligado al roadmap offline.

La pregunta tiene dos capas distintas que conviene separar, porque se resuelven en lugares
diferentes:

1. **Frontend**: ¿un componente/hook reutilizable para el patrón `saving`?
2. **Backend**: ¿guardado con transacción real (atomicidad) y protección contra duplicados?

---

## 1. Frontend: hook reutilizable para el patrón `saving`

### Situación actual

El patrón está repetido a mano en ~18 puntos de guardado. Cada uno declara su propio
`useState(false)`, su guard `if (saving) return`, su `try/finally` y su `disabled`/etiqueta.
La auditoría demostró el problema de este enfoque: **es opcional**. Cuatro formularios
simplemente lo omitieron y nada lo detectó hasta que un usuario duplicó clientes.

### Opciones evaluadas

| Opción | Pros | Contras |
|---|---|---|
| **A. Hook `useGuardar`** (recomendada) | Mínimo, encaja con el código actual, un solo lugar para el guard | El botón sigue armándose a mano (disabled + etiqueta) |
| B. Componente `<BotonGuardar>` | Centraliza también disabled y "Guardando..." | Los botones de guardar hoy no son uniformes (POS, abono con ícono, alert dialogs); un componente único forzaría variantes/props crecientes — el anti-patrón "boolean props" |
| C. `react-hook-form` + `isSubmitting` | Estándar de industria, validación incluida | Reescritura grande: todos los formularios usan `useState` por campo; cambio desproporcionado para el problema |
| D. Server Actions + `useActionState` | Patrón nativo React 19 | La app está construida sobre API routes + `apiPost`; migrar el transporte no se justifica solo por esto |

### Propuesta (opción A): `useGuardar` en `src/hooks/use-guardar.ts`

```tsx
export function useGuardar() {
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // guard síncrono: dos clics en el mismo tick

  const guardar = useCallback(async (fn: () => Promise<void>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await fn();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, []);

  return { saving, guardar };
}
```

Uso en un formulario:

```tsx
const { saving, guardar } = useGuardar();

const handleSave = () =>
  guardar(async () => {
    if (!nombre) { toast.error("Nombre es requerido"); return; }
    await apiPost("/api/clientes", cliente);
    toast.success("Cliente creado");
    router.push("/cliente");
  });

<Button onClick={handleSave} disabled={saving}>
  {saving ? "Guardando..." : "Guardar"}
</Button>
```

Detalle técnico que justifica el hook frente al patrón manual: el `useRef` cierra una
ventana que el `useState` solo no cubre. `setSaving(true)` no es síncrono; dos clics
dentro del mismo render (doble clic muy rápido) pueden pasar ambos el guard
`if (saving) return` antes de que React re-renderice. Con el ref el segundo clic se corta
siempre. Es una mejora real sobre lo que se aplicó en la auditoría.

**No se recomienda** el componente `<BotonGuardar>` como única vía (opción B), pero sí es
razonable como complemento ligero para los formularios CRUD simples (cliente, producto,
gasto) que comparten exactamente el mismo botón full-width. Decisión estética, no de
corrección: con el hook ya queda resuelto el bug.

### Costo de migración

Mecánico y bajo: cada formulario cambia ~6 líneas. Puede hacerse de forma oportunista
(al tocar cada formulario) en lugar de un big-bang. Lo importante es la regla: **todo
guardado nuevo usa `useGuardar`**, documentada en CLAUDE.md.

---

## 2. Backend: transaccionalidad real y duplicados

El hook anterior evita el doble clic, pero no hace el guardado "con transacción". Eso es
del backend, y el estado actual es desparejo:

### Lo que YA es transaccional (vía RPC de Postgres)

Una función de Postgres se ejecuta dentro de una transacción única: o todo o nada. Los
flujos de dinero ya están protegidos así:

- `guardar_venta_con_items` — venta + items + kardex
- `registrar_abono` / `modificar_abono` — abono + distribución FIFO + saldo
- `aplicar_saldo_favor`
- `fn_cerrar_caja` / `fn_caja_arqueo`

### Lo que NO es transaccional (multi-paso con supabase-js)

`supabase-js` habla con PostgREST, que **no soporta transacciones multi-llamada**: cada
`.insert()`/`.update()` es su propia transacción. Los guardados maestro-detalle hechos por
pasos quedan expuestos a estados parciales:

| Flujo | Archivo | Riesgo si falla a mitad |
|---|---|---|
| Cliente + direcciones (alta) | `api/clientes/route.ts` | Cliente creado sin direcciones. El código lo admite: `// No hacemos rollback; log para debugging` |
| Cliente + direcciones (edición) | `api/clientes/[id]/route.ts` | Peor: update + soft-deletes + updates individuales + insert batch = 4 fases independientes; cada error solo se loguea y se sigue |
| Producto + kardex inicial | `api/productos/route.ts` | Producto creado sin su `ProductoMovimiento` inicial → stock y kardex nacen desalineados (justo la clase de bug que se corrigió en `kardex-stock-fix`) |

### Propuesta backend

Replicar el patrón que ya funciona para ventas:

1. **`guardar_cliente_con_direcciones(p_json jsonb)`** — RPC que haga insert/update del
   cliente y el diff completo de direcciones en una sola transacción. Misma forma que
   `guardar_venta_con_items` (recibe JSON con audit, devuelve el id).
2. **`guardar_producto_con_kardex(p_json jsonb)`** — alta de producto + movimiento inicial.
3. Los API routes quedan como capa fina: auth + validación + `rpc(...)`.

No hace falta inventar infraestructura nueva: la convención RPC-con-JSON ya existe en el
proyecto y las migraciones viven en `supabase/migrations`.

### Duplicados a nivel servidor (defensa en profundidad)

La transacción da atomicidad, **no** idempotencia: dos requests completos (reintento de
red del PWA, doble tap antes de que llegue el JS, dos pestañas) siguen creando dos filas.
Si se quiere cerrar también eso, en orden de costo/beneficio:

1. **Clave de idempotencia**: el cliente genera `crypto.randomUUID()` al montar el
   formulario y lo manda en el body; columna `IdempotencyKey` con índice único (o tabla
   genérica de claves). El segundo request choca con el unique y el servidor responde el
   registro ya creado. Es lo que cierra el caso de los abonos duplicados por red.
2. Constraints de unicidad de negocio donde tengan sentido (p. ej. `(IdTenant, NroDocumento)`
   en Cliente cuando no es null). No aplica a ventas/abonos, que legítimamente se repiten.

La opción 1 solo vale la pena en los flujos de dinero (abonos, ventas); para cliente y
producto el hook de UI + RPC transaccional es suficiente.

---

## Recomendación y orden sugerido

| # | Acción | Esfuerzo | Qué resuelve |
|---|---|---|---|
| 1 | Hook `useGuardar` + migrar los ~18 formularios + regla en CLAUDE.md | Bajo | Doble clic, de forma no-opcional y con guard síncrono |
| 2 | RPC `guardar_cliente_con_direcciones` (alta y edición) | Medio | Estados parciales cliente/direcciones |
| 3 | RPC `guardar_producto_con_kardex` | Bajo | Producto sin kardex inicial |
| 4 | Idempotency key en `registrar_abono` y `guardar_venta_con_items` | Medio | Duplicados por reintento de red (PWA offline-first lo hace más probable) |

1–3 son la respuesta directa a la pregunta ("componente/función que haga ese tipo de
guardado con transacción"): el hook es la función reutilizable en UI, y los RPC son la
transacción real. El punto 4 es opcional hoy, pero conviene tenerlo decidido antes de
empujar más el modo offline del PWA.
