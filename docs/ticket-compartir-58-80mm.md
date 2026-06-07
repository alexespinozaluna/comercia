# Ticket para compartir (58mm / 80mm)

Fecha: 2026-06-06
Alcance:
- `src/lib/ticket.ts` (nuevo) — renderizador del ticket en canvas
- `src/components/ventas/ticket-share-sheet.tsx` (nuevo) — sheet de compartir
- `src/app/venta-detalle/[id]/page.tsx` — botón "Compartir" abre el sheet

## Requerimiento

Ticket para compartir compatible con impresoras **58mm y 80mm** (por defecto
**80mm**), con el layout:

```
Nombre de Negocio
Direccion
NroTelefonoNegocio
-----------------------------
Fecha:          <fecha hora>
Forma Venta:    CONTADO / CREDITO
Cliente:        <nombre>
Direccion:      <direccion cliente>
-----------------------------
PRODUCTOS
 <producto>
 <cant> x <precio>        <total>
 ...
-----------------------------
TOTAL                     <total>
Gracias por su compra
```

## Implementación

- **`renderTicketCanvas({ doc, negocio, widthMm })`**: dibuja el ticket en un
  `<canvas>` y lo recorta a su alto real. Anchos: 58mm → 384px, 80mm → 576px
  (puntos a 203 dpi). Tamaños de fuente/padding escalan según el ancho. Hace
  word-wrap de nombre de negocio, dirección, cliente y productos.
  - Fecha: usa `fechaCortaHora(FechaEmision, FechaCreacion)`.
  - Forma de venta: `CREDITO` / `CONTADO` (según `bCredito`).
  - Montos: `numToString`; cantidades: `cantidadString`.
- **`TicketShareSheet`**: bottom sheet con selector de ancho (80mm por defecto /
  58mm), vista previa en vivo del canvas, y botones **Compartir**
  (`navigator.share` con el PNG; fallback a descarga) y **Descargar**. Carga los
  datos del negocio de `/api/negocio`.
- **`venta-detalle`**: el botón "Compartir" abre el sheet (antes generaba un PNG
  de texto monoespaciado desde `/api/ticket`).

## Notas

- El endpoint `/api/ticket/[id]` y el RPC `generate_ticket_text` **siguen
  existiendo** (los usa el flujo de impresión Bluetooth); este ticket de
  compartir es independiente y se genera 100% en el cliente (sin nuevas deps).
- La cabecera usa el negocio **del documento**: `GET /api/negocio` devuelve la
  lista de sucursales del tenant y se elige la que coincide con
  `Documento.IdNegocio` (fallback a la primera). Se agregó `IdNegocio?` al tipo
  `Documento`.
