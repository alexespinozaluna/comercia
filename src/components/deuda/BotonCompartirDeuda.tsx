"use client";

import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { numToString, fechaString } from "@/lib/format";
import { apiPost } from "@/lib/api-client";
import { useGuardar } from "@/hooks/use-guardar";

interface BotonCompartirDeudaProps {
  idCliente: number;
  nombreCliente: string;
  totalDeuda: number;
  /** Teléfono del cliente (campo NroTelefono); se usa como destinatario. */
  nroTelefono?: string | null;
}

export function BotonCompartirDeuda({
  idCliente,
  nombreCliente,
  totalDeuda,
  nroTelefono,
}: BotonCompartirDeudaProps) {
  const { saving: loading, guardar } = useGuardar();

  // Normaliza a formato wa.me: solo dígitos, con código de país 56.
  // "+56937392804" → "56937392804" (quita +); "937392804" → "56937392804" (antepone 56).
  const normalizarTelefono = (raw: string | null | undefined): string => {
    const tel = (raw ?? "").replace(/\D/g, "");
    if (!tel) return "";
    return tel.startsWith("56") ? tel : `56${tel}`;
  };

  // Mensaje al cliente — montos y fechas SOLO con funciones de @/lib/format.
  const construirMensaje = (link: string) =>
    `Estimado/a ${nombreCliente}

Le informamos que tiene una deuda pendiente:

*_Deuda: ${numToString(totalDeuda)}_*
*_Fecha: ${fechaString(new Date())}_*

Ver detalle:
${link}`;

  const handleWhatsApp = () => guardar(async () => {
    try {
      const { url } = await apiPost<{ token: string; url: string }>("/api/link-publico", {
        tipoRecurso: "deuda_cliente",
        idRecurso: idCliente,
      });
      const mensaje = construirMensaje(url);
      // Si no hay teléfono, abre WhatsApp para elegir contacto.
      const tel = normalizarTelefono(nroTelefono);
      const destino = tel ? `https://wa.me/${tel}` : "https://wa.me/";
      window.open(`${destino}?text=${encodeURIComponent(mensaje)}`, "_blank");
    } catch {
      toast.error("Error al generar link");
    }
  });

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
