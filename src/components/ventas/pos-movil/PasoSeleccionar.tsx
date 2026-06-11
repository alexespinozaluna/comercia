"use client";

import { Producto, Categoria } from "@/types/database";
import { BasketItemLocal } from "@/hooks/pos/use-basket";
import { ProductSearch } from "@/components/ventas/pos/ProductSearch";

interface PasoSeleccionarProps {
  products: Producto[];
  search: string;
  onSearchChange: (value: string) => void;
  categorias: Categoria[];
  catFilter: number | null;
  onCatFilterChange: (id: number | null) => void;
  basket: BasketItemLocal[];
  total: number;
  onAddProduct: (product: Producto) => void;
  onQuickCreate: () => void;
  onNext: () => void;
}

/**
 * Paso 1 del wizard móvil: grid de productos. Reutiliza ProductSearch tal
 * cual (incluye búsqueda, filtro por categoría, card "Nuevo producto" y el
 * FAB animado con el total que avanza al paso de confirmación).
 */
export function PasoSeleccionar({
  products,
  search,
  onSearchChange,
  categorias,
  catFilter,
  onCatFilterChange,
  basket,
  total,
  onAddProduct,
  onQuickCreate,
  onNext,
}: PasoSeleccionarProps) {
  return (
    <div className="space-y-4">
      <ProductSearch
        products={products}
        search={search}
        onSearchChange={onSearchChange}
        categorias={categorias}
        catFilter={catFilter}
        onCatFilterChange={onCatFilterChange}
        basket={basket}
        onAddProduct={onAddProduct}
        onQuickCreate={onQuickCreate}
        total={total}
        itemCount={basket.length}
        onViewCart={onNext}
      />
    </div>
  );
}
