"use client";

import { useState, useEffect, useCallback } from "react";
import { Cliente, ClienteDireccion } from "@/types/database";
import { apiGet, apiPost } from "@/lib/api-client";
import { extraerIniciales } from "@/lib/format";
import { useAppStore } from "@/stores/app-store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { Phone, MapPin, ArrowLeft, Plus, Check, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ClienteSelectorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (cliente: Cliente) => void;
}

export function ClienteSelectorSheet({ open, onOpenChange, onSelect }: ClienteSelectorSheetProps) {
  const [mode, setMode] = useState<"search" | "new">("search");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // New client form state
  const [nombre, setNombre] = useState("");
  const [nroTelefono, setNroTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [contacto, setContacto] = useState("");
  const [bPrincipal, setBPrincipal] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadClientes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Cliente[]>("/api/clientes");
      setClientes(data);
    } catch {
      toast.error("Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && mode === "search") {
      loadClientes();
    }
  }, [open, mode, loadClientes]);

  const handleSelectExisting = (c: Cliente) => {
    setSelectedId(c.id);
    setTimeout(() => {
      onSelect(c);
      onOpenChange(false);
      resetForm();
    }, 120);
  };

  const handleCreateNew = async () => {
    if (!nombre.trim()) { toast.error("Nombre es requerido"); return; }
    setSaving(true);
    try {
      const dirs: ClienteDireccion[] = direccion.trim()
        ? [{ id: 0, Direccion: direccion.trim(), Telefono: null, Contacto: contacto.trim(), IdCliente: 0, bPrincipal }]
        : [];

      const created = await apiPost<Cliente>("/api/clientes", {
        id: 0,
        FechaCreacion: new Date().toISOString(),
        Nombre: nombre.trim(),
        NroTelefono: nroTelefono.trim() || null,
        TipoDocumento: null,
        NroDocumento: null,
        Comentario: null,
        ClienteDireccion: dirs.length > 0 ? dirs : undefined,
      });

      useAppStore.getState().triggerRefresh();
      toast.success("Cliente creado");
      onSelect(created);
      onOpenChange(false);
      resetForm();
    } catch {
      toast.error("Error al crear cliente");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setMode("search");
    setSearch("");
    setSelectedId(null);
    setNombre("");
    setNroTelefono("");
    setDireccion("");
    setContacto("");
    setBPrincipal(true);
  };

  const filtered = search
    ? clientes.filter((c) => c.Nombre.toLowerCase().includes(search.toLowerCase()))
    : clientes;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle>
            {mode === "search" ? "Seleccionar cliente" : "Nuevo cliente"}
          </SheetTitle>
          <SheetDescription>
            {mode === "search"
              ? "Busca y selecciona un cliente existente"
              : "Crea un nuevo cliente y se seleccionará automáticamente"}
          </SheetDescription>
        </SheetHeader>

        {mode === "search" ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-3 px-4 flex-1"
          >
            <SearchInput
              placeholder="Buscar cliente..."
              value={search}
              onChange={setSearch}
              debounceMs={200}
            />

            {loading ? (
              <div className="space-y-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-md">
                    <div className="h-9 w-9 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-24 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Sin resultados"
                description={search ? `No se encontró "${search}"` : "No hay clientes registrados"}
              />
            ) : (
              <div className="rounded-md ring-1 ring-border/50 bg-white dark:bg-card divide-y divide-border overflow-hidden flex-1 max-h-[60vh] overflow-y-auto">
                {filtered.map((c) => {
                  const isSelected = selectedId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectExisting(c)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left",
                        isSelected ? "bg-brand-surface" : "hover:bg-brand-surface/50"
                      )}
                    >
                      <div className="h-9 w-9 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-brand-dark">
                          {extraerIniciales(c.Nombre)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{c.Nombre}</div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                          {c.NroTelefono && (
                            <span className="flex items-center gap-0.5">
                              <Phone className="h-3 w-3" /> {c.NroTelefono}
                            </span>
                          )}
                          {c.ClienteDireccion && c.ClienteDireccion.length > 0 && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />
                              {c.ClienteDireccion[0]?.Direccion}
                            </span>
                          )}
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-brand shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            <Separator />

            <Button
              variant="outline"
              className="w-full gap-2 border-brand/30 text-brand hover:bg-brand-surface hover:text-brand-dark"
              onClick={() => setMode("new")}
            >
              <Plus className="h-4 w-4" />
              Crear nuevo cliente
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col gap-4 px-4"
          >
            <button
              type="button"
              onClick={() => setMode("search")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a buscar
            </button>

            <div className="space-y-3">
              <div>
                <Label htmlFor="cs-nombre" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Nombre *
                </Label>
                <Input
                  id="cs-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre del cliente"
                  className="h-11 rounded-md mt-1"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="cs-telefono" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Celular
                </Label>
                <Input
                  id="cs-telefono"
                  value={nroTelefono}
                  onChange={(e) => setNroTelefono(e.target.value)}
                  placeholder="Número de celular"
                  className="h-11 rounded-md mt-1"
                />
              </div>

              <Separator />

              <p className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Dirección de entrega
              </p>

              <div>
                <Label htmlFor="cs-direccion" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dirección
                </Label>
                <Input
                  id="cs-direccion"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Dirección"
                  className="h-11 rounded-md mt-1"
                />
              </div>
              <div>
                <Label htmlFor="cs-contacto" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Contacto
                </Label>
                <Input
                  id="cs-contacto"
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                  placeholder="Nombre de contacto"
                  className="h-11 rounded-md mt-1"
                />
              </div>
              {direccion.trim() && (
                <div className="flex items-center gap-2">
                  <Switch checked={bPrincipal} onCheckedChange={setBPrincipal} />
                  <Label className="text-xs cursor-pointer">Dirección principal</Label>
                </div>
              )}
            </div>

            <Button
              className="w-full h-11 bg-brand hover:bg-brand-dark text-white font-semibold gap-2"
              onClick={handleCreateNew}
              disabled={saving || !nombre.trim()}
            >
              {saving ? "Creando..." : (
                <>
                  <Plus className="h-4 w-4" />
                  Crear y seleccionar
                </>
              )}
            </Button>
          </motion.div>
        )}
      </SheetContent>
    </Sheet>
  );
}
