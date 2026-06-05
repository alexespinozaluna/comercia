# Rediseño de la lista de clientes (`/cliente`)

## Contexto

La página `/cliente` (`src/app/cliente/page.tsx`) renderiza una lista de clientes
como filas dentro de una sola tarjeta. Cada fila mostraba únicamente:

- Avatar con iniciales
- Nombre
- Teléfono del cliente (`NroTelefono`)
- Badge `Debe X` si el saldo es > 0
- Chevron / "Seleccionar"

### Hallazgo

El endpoint `GET /api/clientes` ya devuelve las direcciones embebidas
(`getAllWithDirecciones` → `select("*, ClienteDireccion(*)")`, ver
`src/services/cliente-service.ts`). La lista **descartaba** esa información: no
mostraba direcciones, contacto, ni teléfono por dirección, ni el documento del
cliente. Toda esa data ya viaja en la misma respuesta, por lo que enriquecer la
fila **no agrega costo de red**.

## Objetivo

Aprovechar la data disponible para que cada fila sea más útil de un vistazo,
especialmente para reparto y cobranza.

## Diseño

Cada fila pasa a mostrar (cuando el dato existe):

```
┌────────────────────────────────────────────────────────┐
│ (JP)  Juan Pérez                          [Debe 250]  › │
│       📞 099 123 456   ·   CI 1234567                   │
│       📍 Av. Italia 1234  ·  Principal                  │
│       🏠 3 direcciones   ·   Contacto: María            │
└────────────────────────────────────────────────────────┘
```

Campos nuevos por fila:

1. **Documento** — `TipoDocumento NroDocumento`, en la misma línea del teléfono.
2. **Dirección principal (default)** — la dirección con `bPrincipal === true`
   (o la primera, si ninguna está marcada), truncada. Con etiqueta "Principal".
3. **Cantidad de direcciones** — contador `"N direcciones"` cuando hay más de una.
4. **Contacto / teléfono de la dirección principal** — nombre del contacto y, si
   existe, su teléfono (distinto del `NroTelefono` del cliente).

Reglas de presentación:

- Líneas que no tienen datos se omiten (no se muestran placeholders vacíos).
- El nombre y la dirección se truncan con `truncate` para no romper el layout móvil.
- Se mantiene el badge `Debe X` y el comportamiento de `selectMode`.

## Búsqueda

La búsqueda ahora también filtra por teléfono, número de documento, nombre de
contacto y texto de las direcciones, además del nombre.

## Archivos afectados

- `src/app/cliente/page.tsx` — render de la fila + lógica de dirección principal
  y búsqueda extendida.

## Futuro (no incluido aquí)

- Toggle "Solo con deuda" / orden con deudores primero (ya existe `saldoMap`).
- En el detalle (`/cliente/datos/[id]`): fijar la dirección principal arriba.
