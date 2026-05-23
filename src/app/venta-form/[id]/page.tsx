"use client";

import { useState } from "react";
import { usePosTransaction } from "@/hooks/use-pos-transaction";
import { LoadingState } from "@/components/shared/loading-state";
import { ProductSearch } from "@/components/ventas/pos/ProductSearch";
import { ProductQuickCreate } from "@/components/ventas/pos/ProductQuickCreate";
import { CartSummary } from "@/components/ventas/pos/CartSummary";
import { ClientSelector } from "@/components/ventas/pos/ClientSelector";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ShoppingCart } from "lucide-react";

export default function VentaFormPage({ params }: { params: Promise<{ id: string }> }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [productSheetOpen, setProductSheetOpen] = useState(false);

  const pos = usePosTransaction(params);

  if (pos.loading) {
    return <LoadingState variant="skeleton-cards" count={6} />;
  }

  if (pos.redirectTo) {
    return null;
  }

  return (
    <>
      {/* Product grid — always visible */}
      <div className="space-y-4 pb-24">
        <ProductSearch
          products={pos.filteredProducts}
          search={pos.search}
          onSearchChange={pos.setSearch}
          basket={pos.basket}
          onAddProduct={pos.addToBasket}
          onQuickCreate={() => setProductSheetOpen(true)}
          total={pos.total}
          itemCount={pos.basket.length}
          onViewCart={() => setCartOpen(true)}
        />
      </div>

      {/* Cart Sheet — slides from right */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Canasta
            </SheetTitle>
            <SheetDescription>
              Toca un producto para editar cantidad y precio
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pt-2">
            <CartSummary
              basket={pos.basket}
              total={pos.total}
              fecha={pos.fecha}
              isCredit={pos.isCredit}
              cajaAbierta={pos.cajaAbierta}
              isEdit={pos.isEdit}
              canSave={pos.canSave}
              descripcion={pos.descripcion}
              concepto={pos.concepto}
              onFechaChange={pos.setFecha}
              onIsCreditChange={pos.setIsCredit}
              onUpdateQuantity={pos.updateQuantity}
              onSetQuantity={pos.setQuantity}
              onUpdatePrice={pos.updatePrice}
              onRemoveItem={pos.removeFromBasket}
              onConceptoChange={pos.handleConceptoChange}
              onClearConcepto={pos.clearConceptoManual}
              onSave={() => {
                setCartOpen(false);
                pos.handleSave();
              }}
              inSheet
            >
              <ClientSelector
                selectedClientId={pos.selectedClientId}
                selectedClientName={pos.selectedClientName}
                selectedDireccionId={pos.selectedDireccionId}
                direcciones={pos.direcciones}
                onSelectClient={pos.handleSelectClient}
                onRemoveClient={pos.removeClient}
                onDireccionChange={pos.setSelectedDireccionId}
              />
            </CartSummary>
          </div>
        </SheetContent>
      </Sheet>

      <ProductQuickCreate
        open={productSheetOpen}
        onOpenChange={setProductSheetOpen}
        onProductCreated={pos.addProductToList}
      />
    </>
  );
}