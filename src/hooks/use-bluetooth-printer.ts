"use client";

import { useState, useCallback } from "react";
import {
  isBluetoothSupported,
  requestDevice,
  connectDevice,
  disconnect,
  printText,
  getConnectionState,
} from "@/lib/bluetooth-printer";

export function useBluetoothPrinter() {
  const [isConnected, setIsConnected] = useState(() => getConnectionState().isConnected);
  const [deviceName, setDeviceName] = useState<string | null>(() => getConnectionState().connectedDeviceName);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      if (!isBluetoothSupported()) throw new Error("Web Bluetooth no soportado en este navegador");
      const device = await requestDevice();
      await connectDevice(device);
      const state = getConnectionState();
      setIsConnected(state.isConnected);
      setDeviceName(state.connectedDeviceName);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al conectar";
      setError(message);
      setIsConnected(false);
      setDeviceName(null);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectPrinter = useCallback(async () => {
    try {
      await disconnect();
      setIsConnected(false);
      setDeviceName(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al desconectar");
    }
  }, []);

  const print = useCallback(async (text: string) => {
    try {
      setError(null);
      await printText(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al imprimir";
      setError(message);
      throw err;
    }
  }, []);

  return {
    isSupported: isBluetoothSupported(),
    isConnected,
    deviceName,
    isConnecting,
    error,
    connect,
    disconnect: disconnectPrinter,
    print,
  };
}
