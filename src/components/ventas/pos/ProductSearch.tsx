"use client";

import { Producto } from "@/types/database";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { Plus, Package, ShoppingCart } from "lucide-react";
import { numToString } from "@/lib/format";
import { BasketItemLocal } from "@/hooks/use-pos-transaction";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ProductSearchProps {
  products: Producto[];
  search: string;
  onSearchChange: (value: string) => void;
  basket: BasketItemLocal[];
  onAddProduct: (product: Producto) => void;
  onQuickCreate: () => void;
  total: number;
  itemCount: number;
  onViewCart: () => void;
}

export function ProductSearch({
  products,
  search,
  onSearchChange,
  basket,
  onAddProduct,
  onQuickCreate,
  total,
  itemCount,
  onViewCart,
}: ProductSearchProps) {
  return (
    <>
      {/* Search bar */}
      <SearchInput
        placeholder="Buscar producto..."
        value={search}
        onChange={onSearchChange}
        debounceMs={200}
      />

      {/* Product grid */}
      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin productos"
          description={search ? `No se encontró "${search}"` : "No hay productos disponibles."}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {products.map((product) => {
            const inBasket = basket.find((b) => b.IdProducto === product.id);
            const outOfStock = product.Cantidad != null && product.Cantidad === 0;
            const lowStock = product.Cantidad != null && product.Cantidad > 0 && product.Cantidad <= 5;

            return (
              <div
                key={product.id}
                onClick={() => !outOfStock && onAddProduct(product)}
                className={cn(
                  "bg-white dark:bg-card rounded-md ring-1 ring-border/50 p-3 cursor-pointer transition-all hover:shadow-sm hover:ring-brand/30 flex flex-col gap-2",
                  outOfStock && "opacity-60 cursor-not-allowed"
                )}
              >
                {/* Name row */}
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-semibold leading-tight line-clamp-2 flex-1">
                    {product.Nombre}
                  </p>
                  {/* Stock badge (only if low or zero) */}
                  {(outOfStock || lowStock) && (
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded-sm shrink-0",
                        outOfStock
                          ? "bg-destructive/10 text-destructive"
                          : "bg-warning/10 text-warning"
                      )}
                    >
                      {outOfStock ? "Sin stock" : `Quedan ${product.Cantidad}`}
                    </span>
                  )}
                </div>

                {/* Price + add button row */}
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-[16px] font-extrabold text-brand-dark leading-none">
                    {numToString(product.PrecioVenta)}
                  </span>

                  {/* + button with basket quantity badge */}
                  <div className="relative">
                    {inBasket && (
                      <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-brand-surface border border-white flex items-center justify-center z-10">
                        <span className="text-[10px] font-bold text-brand-dark">
                          {inBasket.Cantidad}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!outOfStock) onAddProduct(product);
                      }}
                      className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center transition-colors shadow-sm",
                        outOfStock
                          ? "bg-muted cursor-not-allowed"
                          : "bg-brand hover:bg-brand-dark active:scale-95"
                      )}
                    >
                      <Plus className="h-4 w-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Nuevo producto card */}
          <div
            onClick={onQuickCreate}
            className="bg-white dark:bg-card rounded-md ring-1 ring-dashed ring-border/80 p-3 cursor-pointer hover:ring-brand/40 hover:bg-brand-surface/30 transition-all flex flex-col items-center justify-center min-h-[88px] gap-1.5"
          >
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Plus className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Nuevo producto</span>
          </div>
        </div>
      )}

      {/* Spacer above FAB */}
      <div className="h-28 md:hidden" />

      {/* FAB canasta — mobile only, visible when basket has items */}
      <AnimatePresence>
        {itemCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-[calc(3.5rem+1rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 md:hidden"
          >
            <button
              type="button"
              onClick={onViewCart}
              className="w-full flex items-center justify-between bg-brand hover:bg-brand-dark text-white rounded-full px-5 py-3 shadow-lg transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  Ver canasta · {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </div>
              <span className="text-sm font-bold">{numToString(total)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
