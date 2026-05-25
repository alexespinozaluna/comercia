import { notFound } from "next/navigation";
import { CartItemHarness } from "./CartItemHarness";

// Ruta solo de desarrollo: 404 en producción. Usada por el test E2E
// e2e/cart-item-detail-sheet.spec.ts.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CartItemHarness />;
}
