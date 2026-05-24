import { PosShell } from "@/components/ventas/pos/PosShell";

export default function VentaFormPage({ params }: { params: Promise<{ id: string }> }) {
  return <PosShell paramsPromise={params} />;
}
