"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { numToString, fechaString } from "@/lib/format";
import { apiPost } from "@/lib/api-client";

interface BotonCompartirDeudaProps {
  idCliente: number;
  nombreCliente: string;
  nombreNegocio: string;
  totalDeuda: number;
  /** Teléfono del cliente (campo NroTelefono); se usa como destinatario. */
  nroTelefono?: string | null;
}

export function BotonCompartirDeuda({
  idCliente,
  nombreCliente,
  nombreNegocio,
  totalDeuda,
  nroTelefono,
}: BotonCompartirDeudaProps) {
  const [loading, setLoading] = useState(false);

  // Mensaje al cliente — montos y fechas SOLO con funciones de @/lib/format.
  const construirMensaje = (link: string) =>
    `Estimado/a ${nombreCliente}

Le informamos que tiene una deuda pendiente con ${nombreNegocio}:

DEUDA: ${numToString(totalDeuda)}
FECHA: ${fechaString(new Date())}

Ver detalle:
${link}`;

  const handleWhatsApp = async () => {
    setLoading(true);
    try {
      const { url } = await apiPost<{ token: string; url: string }>("/api/link-publico", {
        tipoRecurso: "deuda_cliente",
        idRecurso: idCliente,
      });
      const mensaje = construirMensaje(url);
      // wa.me exige el número solo con dígitos (con código de país). Si no hay
      // teléfono, abre WhatsApp para elegir contacto.
      const tel = (nroTelefono ?? "").replace(/\D/g, "");
      const destino = tel ? `https://wa.me/${tel}` : "https://wa.me/";
      window.open(`${destino}?text=${encodeURIComponent(mensaje)}`, "_blank");
    } catch {
      toast.error("Error al generar link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      onClick={handleWhatsApp}
      disabled={loading}
      className="gap-1.5 bg-green-600 hover:bg-green-700 text-white shrink-0"
    >
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">{loading ? "..." : "WhatsApp"}</span>
    </Button>
  );
}
