"use client";

import { useBluetoothPrinter } from "@/hooks/use-bluetooth-printer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PrinterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

export function PrinterDialog({ open, onOpenChange, onConnected }: PrinterDialogProps) {
  const { isSupported, isConnected, deviceName, isConnecting, connect, disconnect } = useBluetoothPrinter();

  const handleConnect = async () => {
    await connect();
    onConnected?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seleccionar Impresora</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!isSupported && (
            <p className="text-sm text-destructive">Web Bluetooth no soportado en este navegador</p>
          )}

          {!isConnected ? (
            <Button onClick={handleConnect} disabled={!isSupported || isConnecting} className="w-full">
              {isConnecting ? "Conectando..." : "Buscar Dispositivos"}
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">Conectado: <strong>{deviceName}</strong></p>
              <Button variant="outline" onClick={disconnect} className="w-full">Desconectar</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}