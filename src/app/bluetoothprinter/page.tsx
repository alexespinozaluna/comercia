"use client";

import { useState } from "react";
import { useBluetoothPrinter } from "@/hooks/use-bluetooth-printer";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function BluetoothPrinterPage() {
  const { isSupported, isConnected, deviceName, isConnecting, error, connect, disconnect, print } = useBluetoothPrinter();
  const [text, setText] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [printWidth, setPrintWidth] = useState(384);

  const handlePrintText = async () => {
    if (!text) { toast.error("Ingrese texto para imprimir"); return; }
    try {
      await print(text);
      toast.success("Impresion enviada");
    } catch (err) {
      toast.error("Error al imprimir");
    }
  };

  const handlePrintTicket = async () => {
    const id = parseInt(ticketId);
    if (!id) { toast.error("Ingrese un ID de venta"); return; }
    try {
      const ticketText = await apiGet<string>(`/api/ticket/${id}?width=${printWidth}`);
      await print(ticketText);
      toast.success("Ticket impreso");
    } catch (err) {
      toast.error("Error al imprimir ticket");
    }
  };

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Prueba de Impresora Bluetooth</h2>

      {!isSupported && (
        <Alert variant="destructive">
          <AlertDescription>Web Bluetooth no esta soportado en este navegador. Use Chrome o Edge en Android.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Conexion</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!isConnected ? (
            <Button onClick={connect} disabled={!isSupported || isConnecting}>
              {isConnecting ? "Conectando..." : "Buscar Dispositivos"}
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">Conectado: <strong>{deviceName}</strong></p>
              <Button variant="outline" onClick={disconnect}>Desconectar</Button>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Imprimir Texto</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Ancho (pixeles)</Label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={printWidth} onChange={(e) => setPrintWidth(parseInt(e.target.value))}>
              <option value={384}>58mm (384px)</option>
              <option value={576}>80mm (576px)</option>
            </select>
          </div>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm min-h-[120px]"
            placeholder="Texto para imprimir..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button onClick={handlePrintText} disabled={!isConnected}>Imprimir Texto</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Imprimir Ticket</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>ID de Venta</Label>
            <Input type="number" value={ticketId} onChange={(e) => setTicketId(e.target.value)} placeholder="Ej: 126" />
          </div>
          <Button onClick={handlePrintTicket} disabled={!isConnected}>Imprimir Ticket</Button>
        </CardContent>
      </Card>
    </div>
  );
}