"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cliente, ClienteDireccion, Documento } from "@/types/database";
import { apiGet } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";
import { esSoloLectura } from "@/lib/permisos";
import { useResource } from "@/hooks/use-resource";
import { extraerIniciales, numToString } from "@/lib/format";
import { SearchInput } from "@/components/shared/search-input";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Phone, ChevronRight, MapPin, IdCard, User } from "lucide-react";

/** Dirección principal: la marcada como bPrincipal, o la primera si ninguna lo está. */
function direccionPrincipal(c: Cliente): ClienteDireccion | undefined {
  const dirs = c.ClienteDireccion ?? [];
  return dirs.find((d) => d.bPrincipal) ?? dirs[0];
}

function ClientePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectMode = searchParams.get("select") === "true";
  const returnTo = searchParams.get("returnTo") ?? "/venta/nueva";
  const soloLectura = esSoloLectura(useAppStore((s) => s.authUser)?.rol);

  const [search, setSearch] = useState("");

  const { data, loading } = useResource(async () => {
    const [clientesData, deudas, favores] = await Promise.all([
      apiGet<Cliente[]>("/api/clientes"),
      apiGet<Documento[]>("/api/deudas").catch(() => [] as Documento[]),
      apiGet<{ IdCliente: number | null; Saldo: number }[]>("/api/saldo-favor").catch(
        () => [] as { IdCliente: number | null; Saldo: number }[],
      ),
    ]);
    // Deuda total por cliente (documentos con Saldo > 0)
    const saldoMap = new Map<number, number>();
    deudas.forEach((d) => {
      if (d.IdCliente != null && d.Saldo > 0) {
        saldoMap.set(d.IdCliente, (saldoMap.get(d.IdCliente) ?? 0) + d.Saldo);
      }
    });
    // Saldo a favor por cliente (documentos tipo 4 con Saldo > 0)
    const favorMap = new Map<number, number>();
    favores.forEach((f) => {
      if (f.IdCliente != null && f.Saldo > 0) {
        favorMap.set(f.IdCliente, (favorMap.get(f.IdCliente) ?? 0) + f.Saldo);
      }
    });
    return { clientes: clientesData, saldoMap, favorMap };
  });
  const clientes = data?.clientes ?? [];
  const saldoMap = data?.saldoMap ?? new Map<number, number>();
  const favorMap = data?.favorMap ?? new Map<number, number>();

  const filtered = search
    ? clientes.filter((c) => {
        const q = search.toLowerCase();
        const dirs = c.ClienteDireccion ?? [];
        return (
          c.Nombre.toLowerCase().includes(q) ||
          (c.NroTelefono ?? "").toLowerCase().includes(q) ||
          (c.NroDocumento ?? "").toLowerCase().includes(q) ||
          dirs.some(
            (d) =>
              d.Direccion.toLowerCase().includes(q) ||
              (d.Contacto ?? "").toLowerCase().includes(q) ||
              (d.Telefono ?? "").toLowerCase().includes(q),
          )
        );
      })
    : clientes;

  const handleSelect = (c: Cliente) => {
    if (selectMode) {
      router.push(returnTo);
    } else {
      router.push(`/cliente/datos/${c.id}`);
    }
  };

  return (
    <div className="space-y-2">
      <PageHeader
        title={selectMode ? "Seleccionar cliente" : "Clientes"}
        backHref={selectMode ? returnTo : undefined}
        actions={
          !selectMode && !soloLectura ? (
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
            const favor = favorMap.get(c.id) ?? 0;
            const dirs = c.ClienteDireccion ?? [];
            const principal = direccionPrincipal(c);
            const documento = c.NroDocumento
              ? `${c.TipoDocumento ?? "Doc"} ${c.NroDocumento}`
              : null;
            const contacto = principal?.Contacto?.trim();
            const telDireccion = principal?.Telefono?.trim();
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full flex items-start gap-2 p-3 hover:bg-accent/40 transition-colors text-left"
              >
                {/* Avatar */}
                <div className="h-10 w-10 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-brand-dark">
                    {extraerIniciales(c.Nombre)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="text-sm font-semibold truncate">{c.Nombre}</div>

                  {/* Teléfono del cliente + documento */}
                  {(c.NroTelefono || documento) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {c.NroTelefono && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {c.NroTelefono}
                        </span>
                      )}
                      {documento && (
                        <span className="flex items-center gap-1">
                          <IdCard className="h-3 w-3" />
                          {documento}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Dirección principal + contador */}
                  {principal && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{principal.Direccion || "Sin dirección"}</span>
                      {dirs.length > 1 && (
                        <span className="shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-sm bg-brand-surface text-brand-dark">
                          {dirs.length} direcciones
                        </span>
                      )}
                    </div>
                  )}

                  {/* Contacto / teléfono de la dirección principal */}
                  {(contacto || telDireccion) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {contacto && (
                        <span className="flex items-center gap-1 min-w-0">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">{contacto}</span>
                        </span>
                      )}
                      {telDireccion && telDireccion !== c.NroTelefono && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {telDireccion}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Saldos (debe / a favor) + chevron */}
                <div className="flex items-center gap-2 shrink-0 self-center">
                  {(saldo > 0 || favor > 0) && (
                    <div className="flex flex-col items-end gap-1">
                      {saldo > 0 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-sm bg-brand-surface text-brand-dark whitespace-nowrap">
                          Debe {numToString(saldo)}
                        </span>
                      )}
                      {favor > 0 && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-sm bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 whitespace-nowrap">
                          A favor {numToString(favor)}
                        </span>
                      )}
                    </div>
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
