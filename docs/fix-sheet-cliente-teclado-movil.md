# Fix: teclado móvil tapaba el resultado al buscar cliente (2026-06-12)

## Problema

En móvil, al buscar un cliente en `ClienteSelectorSheet`, el cliente
encontrado quedaba en la parte baja de la pantalla, detrás del teclado
virtual, sin poder verse ni seleccionarse.

## Causa

Combinación de tres factores:

1. `SheetContent side="bottom"` es `fixed bottom-0 h-auto` (anclado abajo,
   altura según contenido) y el sheet usaba `max-h-[85vh]` (altura máxima,
   no fija). Al filtrar y quedar 1-2 resultados, el contenido se encogía y
   todo el sheet se hundía a la franja inferior de la pantalla.
2. El teclado virtual no empuja elementos `fixed`: Android Chrome usa
   `resizes-visual` por defecto e iOS Safari tampoco mueve el layout —
   `bottom-0` queda detrás del teclado.
3. Cuanto más filtrada la búsqueda, más chico el sheet → el resultado único
   terminaba exactamente bajo el teclado.

## Solución (solo CSS, `cliente-selector-sheet.tsx`)

- **Altura fija en móvil**: `h-[85dvh]!` (en md+: `md:h-auto!
  md:max-h-[85vh]`, compacto como antes — sin teclado virtual no hace
  falta). Con altura fija, el buscador y los resultados quedan anclados
  ARRIBA, lejos del teclado, sin importar cuántos resultados haya.
  OJO — dos intentos fallidos antes de llegar aquí:
  1. `h-[85dvh]` sin `!` no aplica: el `data-[side=bottom]:h-auto` base de
     `SheetContent` gana por especificidad (clase+atributo) y tailwind-merge
     no dedupe variantes distintas → la altura seguía `auto` y el sheet
     crecía más alto que la pantalla, recortando el buscador por arriba.
  2. Clamp con `min-h-[85dvh] max-h-[85dvh]`: la altura clampeada no es
     "definida" para el layout flex → los `flex-1`/`max-h-full` internos no
     resuelven y la lista empujaba el botón "Crear nuevo cliente" fuera.
  La altura real con `!important` resuelve ambos.
- La lista vive en un wrapper `flex-1 min-h-0` y la caja con borde usa
  `max-h-full overflow-y-auto`: el área de resultados ocupa el alto
  disponible pero el borde sigue abrazando el contenido.
- El modo "crear" recibe `flex-1 min-h-0 overflow-y-auto` propio (antes
  scrolleaba por el contenedor padre, que en móvil ya no scrollea).
- "Crear nuevo cliente" queda al fondo del sheet: visible al abrir, tapado
  solo mientras el teclado está abierto (la acción primaria al escribir es
  seleccionar de la lista).

## Descartado

`interactiveWidget: "resizes-content"` en el viewport global: haría que el
teclado redimensione toda la app y la barra de navegación inferior + barras
fijas (StickyTotalBar, Guardar) saltarían sobre el teclado en cualquier
pantalla con input. El fix local no tiene ese efecto colateral.

## Alcance

Beneficia a todos los consumidores del sheet: POS desktop, wizard móvil y
`/saldo-favor`.

## Verificación

E2E `e2e/cliente-selector-sheet.spec.ts` (harness
`/dev-harness/cliente-selector`, viewport móvil 393×851, 50 clientes
mockeados): buscador en el tercio superior, botón "Crear nuevo cliente"
visible sin scroll con lista larga, resultado filtrado en la mitad superior
(zona libre de teclado) y selección funcionando. Pendiente solo la
validación en dispositivo real con teclado físico abierto.
