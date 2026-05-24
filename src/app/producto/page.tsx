"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Producto } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { numToString } from "@/lib/format";
import { useAppStore } from "@/stores/app-store";
import { SearchInput } from "@/components/shared/search-input";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Package, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

function stockVariant(cantidad: number | null): {
  label: string;
  className: string;
} {
  if (cantidad == null) return { label: "", className: "" };
  if (cantidad === 0) return { label: "Sin stock", className: "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400" };
  if (cantidad <= 5) return { label: `Stock: ${cantidad}`, className: "bg-brand-surface text-brand-dark" };
  return { label: `Stock: ${cantidad}`, className: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" };
}

export default function ProductoPage() {
  const router = useRouter();
  const authUser = useAppStore((s) => s.authUser);
  const isAdmin = authUser?.rol === "ADMIN" || authUser?.rol === "SUPERVISOR";

  const [products, setProducts] = useState<Producto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<Producto[]>("/api/productos");
        setProducts(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = search
    ? products.filter((p) => p.Nombre.toLowerCase().includes(search.toLowerCase()))
    : products;

  return (
    <div className="space-y-2">
      <PageHeader
        title="Inventario"
        actions={
          <Button
            size="sm"
            className="bg-brand hover:bg-brand-dark text-white gap-1.5 shadow-sm"
            onClick={() => router.push("/producto/datos")}
          >
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        }
      />

      <SearchInput
        placeholder="Buscar producto..."
        value={search}
        onChange={setSearch}
        debounceMs={300}
      />

      {loading ? (
        <LoadingState variant="skeleton-cards" count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Package} title="Sin productos" description="No se encontraron productos." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filtered.map((product) => {
            const stock = stockVariant(product.Cantidad);
            return (
              <div
                key={product.id}
                onClick={() => router.push(`/producto/datos/${product.id}`)}
                className="bg-white dark:bg-card rounded-md ring-1 ring-border/50 p-3.5 cursor-pointer hover:shadow-sm hover:ring-brand/30 transition-all flex flex-col gap-2"
              >
                {/* Name */}
                <p className="text-sm font-semibold leading-tight line-clamp-2 flex-1">
                  {product.Nombre}
                </p>

                {/* Price */}
                <div className="text-[18px] font-extrabold text-brand-dark leading-none">
                  {numToString(product.PrecioVenta)}
                </div>

                {/* Stock badge */}
                {product.Cantidad != null && (
                  <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded-sm w-fit", stock.className)}>
                    {stock.label}
                  </span>
                )}

                {/* Cost price — ADMIN/SUPERVISOR only */}
                {isAdmin && product.PrecioCosto != null && (
                  <p className="text-[11px] text-muted-foreground">
                    Costo: {numToString(product.PrecioCosto)}
                  </p>
                )}

                {/* Kardex button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/producto/kardex/${product.id}`);
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-brand transition-colors w-fit mt-auto"
                  aria-label="Ver kardex"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Kardex
                </button>
              </div>
            );
          })}

          {/* Nuevo producto card */}
          <div
            onClick={() => router.push("/producto/datos/0")}
            className="bg-white dark:bg-card rounded-md ring-1 ring-dashed ring-border/80 p-3.5 cursor-pointer hover:ring-brand/40 hover:bg-brand-surface/20 transition-all flex flex-col items-center justify-center min-h-[120px] gap-2"
          >
            <div className="h-10 w-10 rounded-full bg-brand-surface flex items-center justify-center">
              <Plus className="h-5 w-5 text-brand" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground">Nuevo producto</span>
          </div>
        </div>
      )}
    </div>
  );
}
