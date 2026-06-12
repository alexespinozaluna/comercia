import { notFound } from "next/navigation";
import { ClienteSelectorHarness } from "./ClienteSelectorHarness";

// Ruta solo de desarrollo: 404 en producción. Usada por el test E2E
// e2e/cliente-selector-sheet.spec.ts.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ClienteSelectorHarness />;
}
