"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Producto, Categoria, SIN_CATEGORIA_ID } from "@/types/database";
import { apiGet, apiPut } from "@/lib/api-client";
import { useResource } from "@/hooks/use-resource";
import { numToString, cantidadString } from "@/lib/format";
import { useAppStore } from "@/stores/app-store";
import { esSoloLectura } from "@/lib/permisos";
import { SearchInput } from "@/components/shared/search-input";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CategoriaFilter } from "@/components/producto/categoria-filter";
import { toast } from "sonner";
import { Plus, Package, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

function stockVariant(cantidad: number | null): {
  label: string;
  className: string;
} {
  if (cantidad == null) return { label: "", className: "" };
  if (cantidad === 0) return { label: "Sin stock", className: "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400" };
  const txt = `Stock: ${cantidadString(cantidad)}`;
  if (cantidad <= 5) return { label: txt, className: "bg-brand-surface text-brand-dark" };
  return { label: txt, className: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400" };
}

export default function ProductoPage() {
  const router = useRouter();
  const authUser = useAppStore((s) => s.authUser);
  const isAdmin = authUser?.rol === "ADMIN" || authUser?.rol === "SUPERVISOR";
  const soloLectura = esSoloLectura(authUser?.rol);

  const [search, setSearch] = useState("");
  // null = TODOS; un número = filtrar por esa categoría (0 = Sin categoría)
  const [catFilter, setCatFilter] = useState<number | null>(null);

  const { data, loading, setData } = useResource(async () => {
    const [productsData, cats] = await Promise.all([
      apiGet<Producto[]>("/api/productos"),
      apiGet<Categoria[]>("/api/categorias"),
    ]);
    return {
      products: productsData,
      categoriaList: cats,
      categorias: new Map(cats.map((c) => [c.id, c.Nombre])),
    };
  });
  const products = data?.products ?? [];
  const categoriaList = data?.categoriaList ?? [];
  const categorias = data?.categorias ?? new Map<number, string>();

  // Cambia bActivoVenta de un producto en el estado local (update optimista).
  const setProductoActivo = (idProducto: number, val: boolean) =>
    setData((d) =>
      d
        ? { ...d, products: d.products.map((p) => (p.id === idProducto ? { ...p, bActivoVenta: val } : p)) }
        : d,
    );

  const toggleActivo = async (product: Producto, next: boolean) => {
    // Optimista: actualiza local y revierte si falla
    setProductoActivo(product.id, next);
    try {
      await apiPut(`/api/productos/${product.id}`, {
        Nombre: product.Nombre,
        PrecioCosto: product.PrecioCosto,
        PrecioVenta: product.PrecioVenta,
        FechaVencimiento: product.FechaVencimiento,
        IdCategoria: product.IdCategoria,
        bActivoVenta: next,
      });
    } catch (err) {
      setProductoActivo(product.id, !next);
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    }
  };

  const filtered = products.filter((p) => {
    const matchSearch =
      !search || p.Nombre.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter == null || p.IdCategoria === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-2">
      <PageHeader
        title="Inventario"
        actions={
          soloLectura ? undefined : (
            <Button
              size="sm"
              className="bg-brand hover:bg-brand-dark text-white gap-1.5 shadow-sm"
              onClick={() => router.push("/producto/datos")}
            >
              <Plus className="h-4 w-4" />
              Nuevo
            </Button>
          )
        }
      />

      <SearchInput
        placeholder="Buscar producto..."
        value={search}
        onChange={setSearch}
        debounceMs={300}
      />

      {/* Filtro por categoría */}
      <CategoriaFilter categorias={categoriaList} value={catFilter} onChange={setCatFilter} />

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
                className={cn(
                  "bg-white dark:bg-card rounded-md ring-1 ring-border/50 p-3.5 cursor-pointer hover:shadow-sm hover:ring-brand/30 transition-all flex flex-col gap-2",
                  !product.bActivoVenta && "opacity-60",
                )}
              >
                {/* Categoría */}
                {product.IdCategoria !== SIN_CATEGORIA_ID && categorias.has(product.IdCategoria) && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-brand bg-brand-surface px-1.5 py-0.5 rounded-sm w-fit">
                    {categorias.get(product.IdCategoria)}
                  </span>
                )}

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

                {/* Footer: Kardex + toggle activo */}
                <div className="flex items-center justify-between mt-auto pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/producto/kardex/${product.id}`);
                    }}
                    className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-brand transition-colors w-fit"
                    aria-label="Ver kardex"
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                    Kardex
                  </button>
                  <div
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                    title="Activo para venta"
                  >
                    <span className="text-[10px] text-muted-foreground">
                      {product.bActivoVenta ? "Venta" : "Oculto"}
                    </span>
                    <Switch
                      size="sm"
                      checked={product.bActivoVenta}
                      onCheckedChange={(v) => toggleActivo(product, v)}
                      disabled={soloLectura}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Nuevo producto card */}
          {!soloLectura && (
            <div
              onClick={() => router.push("/producto/datos/0")}
              className="bg-white dark:bg-card rounded-md ring-1 ring-dashed ring-border/80 p-3.5 cursor-pointer hover:ring-brand/40 hover:bg-brand-surface/20 transition-all flex flex-col items-center justify-center min-h-[120px] gap-2"
            >
              <div className="h-10 w-10 rounded-full bg-brand-surface flex items-center justify-center">
                <Plus className="h-5 w-5 text-brand" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground">Nuevo producto</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
