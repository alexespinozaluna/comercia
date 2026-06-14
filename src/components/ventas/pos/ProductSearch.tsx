"use client";

import { Producto, Categoria } from "@/types/database";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { CategoriaFilter } from "@/components/producto/categoria-filter";
import { Plus, Package, ShoppingCart } from "lucide-react";
import { numToString, cantidadString } from "@/lib/format";
import { BasketItemLocal } from "@/hooks/use-pos-transaction";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ProductSearchProps {
  products: Producto[];
  search: string;
  onSearchChange: (value: string) => void;
  categorias: Categoria[];
  catFilter: number | null;
  onCatFilterChange: (id: number | null) => void;
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
  categorias,
  catFilter,
  onCatFilterChange,
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

      {/* Filtro por categoría */}
      <CategoriaFilter categorias={categorias} value={catFilter} onChange={onCatFilterChange} />

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
            const stock = product.Cantidad;
            // Stock display rules: rojo si <= 0, amarillo si <= 5, verde si > 5.
            // Negative stock is allowed; the add button is never disabled.
            const stockClass =
              stock == null
                ? "bg-muted text-muted-foreground"
                : stock <= 0
                ? "bg-destructive/10 text-destructive"
                : stock <= 5
                ? "bg-warning/10 text-warning"
                : "bg-success/10 text-success";

            return (
              <div
                key={product.id}
                onClick={() => onAddProduct(product)}
                className="bg-white dark:bg-card rounded-md ring-1 ring-border/50 p-3 cursor-pointer transition-all hover:shadow-sm hover:ring-brand/30 flex flex-col gap-2"
              >
                {/* Name row */}
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-semibold leading-tight line-clamp-2 flex-1 text-foreground">
                    {product.Nombre}
                  </p>
                  {stock != null && (
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded-sm shrink-0 tabular-nums",
                        stockClass
                      )}
                      title="Stock disponible"
                    >
                      {stock}
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
                          {cantidadString(inBasket.Cantidad)}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddProduct(product);
                      }}
                      className="h-8 w-8 rounded-full flex items-center justify-center transition-colors shadow-sm bg-brand hover:bg-brand-dark active:scale-95"
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
                 {itemCount} Producto{itemCount === 1 ? "" : "s"}
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
