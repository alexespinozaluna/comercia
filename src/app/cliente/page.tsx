"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cliente, Documento } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { extraerIniciales, numToString } from "@/lib/format";
import { SearchInput } from "@/components/shared/search-input";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Phone, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function ClientePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectMode = searchParams.get("select") === "true";
  const returnTo = searchParams.get("returnTo") ?? "/venta/nueva";

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [saldoMap, setSaldoMap] = useState<Map<number, number>>(new Map());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [data, deudas] = await Promise.all([
          apiGet<Cliente[]>("/api/clientes"),
          fetch("/api/deudas").then((r) => (r.ok ? r.json() : [])) as Promise<Documento[]>,
        ]);
        setClientes(data);
        const map = new Map<number, number>();
        deudas.forEach((d) => {
          if (d.IdCliente != null && d.Saldo > 0) {
            map.set(d.IdCliente, (map.get(d.IdCliente) ?? 0) + d.Saldo);
          }
        });
        setSaldoMap(map);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = search
    ? clientes.filter((c) => c.Nombre.toLowerCase().includes(search.toLowerCase()))
    : clientes;

  const handleSelect = (c: Cliente) => {
    if (selectMode) {
      router.push(returnTo);
    } else {
      router.push(`/cliente/datos/${c.id}`);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={selectMode ? "Seleccionar cliente" : "Clientes"}
        backHref={selectMode ? returnTo : undefined}
        actions={
          !selectMode ? (
            <Button
              size="sm"
              className="bg-brand hover:bg-brand-dark text-white gap-1.5 shadow-sm"
              onClick={() => router.push("/cliente/datos/0")}
            >
              <Plus className="h-4 w-4" />
              Nuevo
            </Button>
          ) : undefined
        }
      />

      <SearchInput
        placeholder={selectMode ? "Seleccionar un cliente..." : "Buscar cliente..."}
        value={search}
        onChange={setSearch}
        debounceMs={300}
      />

      {loading ? (
        <LoadingState variant="skeleton-list" count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Sin clientes" description="No se encontraron clientes." />
      ) : (
        <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 divide-y divide-border overflow-hidden">
          {filtered.map((c) => {
            const saldo = saldoMap.get(c.id) ?? 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full flex items-center gap-3 p-3 hover:bg-accent/40 transition-colors text-left"
              >
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-brand-dark">
                    {extraerIniciales(c.Nombre)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{c.Nombre}</div>
                  {c.NroTelefono && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Phone className="h-3 w-3" />
                      {c.NroTelefono}
                    </div>
                  )}
                </div>

                {/* Saldo badge + chevron */}
                <div className="flex items-center gap-2 shrink-0">
                  {saldo > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-sm bg-brand-surface text-brand-dark">
                      Debe {numToString(saldo)}
                    </span>
                  )}
                  {selectMode ? (
                    <span className="text-xs font-semibold text-brand">Seleccionar</span>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ClientePage() {
  return (
    <Suspense fallback={<LoadingState variant="skeleton-list" count={4} />}>
      <ClientePageInner />
    </Suspense>
  );
}
