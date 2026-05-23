// Web Bluetooth API service for thermal printers
// Works in Chrome/Edge on Android and desktop. Requires HTTPS.

/* eslint-disable @typescript-eslint/no-explicit-any */

type BluetoothDevice = any;
type BluetoothRemoteGATTCharacteristic = any;

declare global {
  interface Navigator {
    bluetooth: any;
  }
}

const SPP_UUID = "00001101-0000-1000-8000-00805f9b34fb";

let isConnected = false;
let connectedDeviceName: string | null = null;
let connectedDevice: BluetoothDevice | null = null;
let writableCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export async function requestDevice(): Promise<BluetoothDevice> {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [SPP_UUID] }],
    optionalServices: [SPP_UUID],
  });
  return device;
}

export async function connectDevice(device: BluetoothDevice): Promise<void> {
  const server = await device.gatt?.connect();
  if (!server) throw new Error("No se pudo conectar al servidor GATT");

  const service = await server.getPrimaryService(SPP_UUID);
  const characteristics = await service.getCharacteristics();

  // Find a writable characteristic
  for (const char of characteristics) {
    if (char.properties.write || char.properties.writeWithoutResponse) {
      writableCharacteristic = char;
      break;
    }
  }

  if (!writableCharacteristic) throw new Error("No se encontro caracteristica escribible");

  connectedDevice = device;
  connectedDeviceName = device.name ?? "Dispositivo desconocido";
  isConnected = true;

  device.addEventListener("gattserverdisconnected", () => {
    isConnected = false;
    connectedDeviceName = null;
    connectedDevice = null;
    writableCharacteristic = null;
  });
}

export async function disconnect(): Promise<void> {
  if (connectedDevice?.gatt?.connected) {
    connectedDevice.gatt.disconnect();
  }
  isConnected = false;
  connectedDeviceName = null;
  connectedDevice = null;
  writableCharacteristic = null;
}

export async function printText(text: string): Promise<void> {
  if (!writableCharacteristic) throw new Error("No hay impresora conectada");

  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  // Write in chunks (BLE has MTU limits, typically 512 bytes)
  const CHUNK_SIZE = 512;
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    if (writableCharacteristic.properties.writeWithoutResponse) {
      await writableCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await writableCharacteristic.writeValue(chunk);
    }
  }

  // ESC/POS paper cut command
  const cutCmd = new Uint8Array([0x1d, 0x56, 0x42, 0x00]);
  if (writableCharacteristic.properties.writeWithoutResponse) {
    await writableCharacteristic.writeValueWithoutResponse(cutCmd);
  } else {
    await writableCharacteristic.writeValue(cutCmd);
  }
}

export function getConnectionState() {
  return { isConnected, connectedDeviceName };
}