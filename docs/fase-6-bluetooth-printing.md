# Fase 6: Web Bluetooth Printing

## Objetivo
Implementar la impresión de tickets por Bluetooth usando la Web Bluetooth API (equivalente web del código nativo Android/Windows del MAUI original).

## Arquitectura
El MAUI original usaba compilación condicional (`#if __ANDROID__` / `#if WINDOWS`) con APIs nativas:
- Android: `Android.Bluetooth` — BluetoothSocket, UUID SPP
- Windows: `Windows.Devices.Bluetooth` — WinRT BluetoothLEDevice

En la versión web se usa la **Web Bluetooth API**, disponible en Chrome/Edge en Android y desktop. Requiere HTTPS.

## Archivos creados

### `src/lib/bluetooth-printer.ts` — Servicio Web Bluetooth
Módulo de bajo nivel para conectar e imprimir con impresoras térmicas Bluetooth.

**Estado del módulo** (variables a nivel de módulo, NO React state):
- `isConnected`, `connectedDeviceName`, `connectedDevice`, `writableCharacteristic`

**Funciones exportadas**:

| Función | Descripción |
|---------|-------------|
| `isBluetoothSupported()` | Verifica si Web Bluetooth está disponible en el navegador |
| `requestDevice()` | Abre el selector de dispositivos Bluetooth filtrado por UUID SPP |
| `connectDevice(device)` | Conecta al servidor GATT, busca característica escribible |
| `disconnect()` | Desconecta y limpia todo el estado del módulo |
| `printText(text)` | Codifica texto a UTF-8, envía en chunks de 512 bytes, envía comando ESC/POS de corte |
| `getConnectionState()` | Retorna `{ isConnected, connectedDeviceName }` |

**UUID SPP**: `00001101-0000-1000-8000-00805f9b34fb`

**Comando de corte ESC/POS**: `[0x1d, 0x56, 0x42, 0x00]`

**Patrón de escritura por chunks**: BLE tiene límites de MTU (típicamente 512 bytes). El texto se divide en chunks y se escribe uno por uno. Se usa `writeWithoutResponse` si está disponible, si no `write`.

**Tipos Bluetooth**: Se usa `any` para `BluetoothDevice` y `BluetoothRemoteGATTCharacteristic` porque TypeScript no incluye tipos nativos para Web Bluetooth.

### `src/hooks/use-bluetooth-printer.ts` — React Hook
Wrapper React del módulo `bluetooth-printer.ts`.

**Retorna**:
```typescript
{
  isSupported: boolean,    // Web Bluetooth disponible
  isConnected: boolean,    // Impresora conectada
  deviceName: string | null,
  isConnecting: boolean,
  error: string | null,
  connect: () => Promise<void>,  // requestDevice + connectDevice
  disconnect: () => void,
  print: (text: string) => Promise<void>,
}
```

**Patrón**: Al montar, lee el estado actual del módulo. Los callbacks (`connect`, `disconnect`, `print`) están envueltos en `useCallback` con dependencias vacías (referencias estables).

### `src/app/bluetoothprinter/page.tsx` — Página de prueba
Página para probar la conexión e impresión Bluetooth.

- Muestra estado: soportado, conectado, nombre del dispositivo
- Botón "Buscar Dispositivos" para conectar
- Botón "Desconectar"
- Botón "Imprimir Prueba" para enviar texto de prueba
- Usa el hook `useBluetoothPrinter`

### `src/components/shared/printer-dialog.tsx` — Diálogo de selección
Diálogo shadcn/ui reutilizable para seleccionar impresora.

**Props**:
```typescript
{
  open: boolean,
  onOpenChange: (open: boolean) => void,
  onConnected?: () => void,
}
```

- Muestra "Web Bluetooth no soportado" si no está disponible
- Botón "Buscar Dispositivos" → conecta y llama `onConnected`
- Si conectado → muestra nombre y botón "Desconectar"

## Uso del ticket
El flujo completo de impresión es:

1. Desde `venta-detalle`, el usuario presiona "Imprimir"
2. Si no hay impresora conectada → abre `PrinterDialog`
3. Una vez conectada → llama `documentoService.getTicketText(id, width)` (RPC de Supabase)
4. El RPC retorna texto formateado en ESC/POS
5. Se envía el texto a `printText()` que lo escribe por Bluetooth

## Limitaciones de Web Bluetooth vs nativo
- **Requiere HTTPS** — no funciona en HTTP (excepto localhost)
- **Solo Chrome/Edge** — Firefox y Safari no soportan Web Bluetooth
- **El usuario debe seleccionar el dispositivo** — no se puede auto-conectar
- **BLE MTU limits** — se escribe en chunks de 512 bytes
- **No hay acceso a Bluetooth Classic** — solo BLE (Low Energy)
- **Disponible en Android Chrome** — que es el target principal de la app