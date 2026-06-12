import { VentaMovilWizard } from "@/components/ventas/pos-movil/VentaMovilWizard";

// Edición de venta con el wizard móvil. El botón "Editar" de venta-detalle
// llega aquí en pantallas < md (en desktop va a /venta-form/[id]).
export default async function VentaEditarMovilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VentaMovilWizard idVenta={parseInt(id, 10) || 0} />;
}
