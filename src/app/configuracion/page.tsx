"use client";

import { useState, useEffect } from "react";
import { Negocio } from "@/types/database";
import {
  LOCALES_VALIDOS,
  LOCALE_LABELS,
  DEFAULT_LOCALE,
  esLocaleValido,
  DECIMALES_VALIDOS,
  DECIMALES_LABELS,
  DEFAULT_DECIMALES,
  esDecimalesValido,
} from "@/types/locale";
import { apiGet, apiPut } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import { Building2, Phone, MapPin, ImageIcon, Globe, Hash } from "lucide-react";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
      {children}
    </label>
  );
}

export default function ConfiguracionPage() {
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [logo, setLogo] = useState("");
  const [locale, setLocaleField] = useState<string>(DEFAULT_LOCALE);
  const [decimales, setDecimalesField] = useState<number>(DEFAULT_DECIMALES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const idNegocioActivo = useAppStore((s) => s.authUser?.idNegocio);
  const setFormatoGlobal = useAppStore((s) => s.setFormato);

  useEffect(() => {
    async function load() {
      try {
        // GET devuelve la lista de sucursales del tenant; editamos la activa.
        const list = await apiGet<Negocio[]>("/api/negocio");
        const activo = list.find((n) => n.id === idNegocioActivo) ?? list[0] ?? null;
        if (activo) {
          setNegocio(activo);
          setNombre(activo.Nombre ?? "");
          setDireccion(activo.Direccion ?? "");
          setTelefono(activo.Telefono ?? "");
          setLogo(activo.Logo ?? "");
          setLocaleField(esLocaleValido(activo.Locale) ? activo.Locale : DEFAULT_LOCALE);
          setDecimalesField(esDecimalesValido(activo.Decimales) ? activo.Decimales : DEFAULT_DECIMALES);
        }
      } catch (err) {
        console.error(err);
        toast.error("Error al cargar configuración");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [idNegocioActivo]);

  const handleSave = async () => {
    if (!negocio) { toast.error("No hay registro de negocio"); return; }
    setSaving(true);
    try {
      await apiPut("/api/negocio", {
        id: negocio.id,
        Nombre: nombre || null,
        Direccion: direccion || null,
        Telefono: telefono || null,
        Logo: logo || null,
        Locale: locale,
        Decimales: decimales,
      });
      // Aplica el nuevo formato de inmediato (sin esperar recarga).
      setFormatoGlobal(locale, decimales);
      toast.success("Configuración guardada");
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState variant="skeleton-form" count={4} />;
  if (!negocio) return <EmptyState title="Sin configuración" description="No se encontró información del negocio." />;

  return (
    <div className="space-y-2 max-w-lg">
      <PageHeader title="Configuración del negocio" />

      {/* Logo preview */}
      {logo && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt=""
            className="h-16 w-16 rounded-lg object-contain ring-1 ring-border/50 bg-white p-1"
          />
        </div>
      )}

      {/* Card — datos del negocio */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Datos del negocio
        </h2>

        <div>
          <FieldLabel>Nombre del negocio</FieldLabel>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del negocio"
              className="h-11 rounded-md pl-9"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Teléfono</FieldLabel>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Teléfono de contacto"
              className="h-11 rounded-md pl-9"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Dirección</FieldLabel>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Dirección del negocio"
              className="h-11 rounded-md pl-9"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Logo (URL de imagen)</FieldLabel>
          <div className="relative">
            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://..."
              className="h-11 rounded-md pl-9"
            />
          </div>
        </div>

        <div>
          <FieldLabel>País / formato de fechas y números</FieldLabel>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Select value={locale} onValueChange={(v) => v && setLocaleField(v)}>
              <SelectTrigger className="h-11 rounded-md pl-9 w-full">
                <SelectValue placeholder="Selecciona el país" />
              </SelectTrigger>
              <SelectContent>
                {LOCALES_VALIDOS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {LOCALE_LABELS[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <FieldLabel>Decimales en los montos</FieldLabel>
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Select
              value={String(decimales)}
              onValueChange={(v) => v != null && setDecimalesField(parseInt(v))}
            >
              <SelectTrigger className="h-11 rounded-md pl-9 w-full">
                <SelectValue placeholder="Selecciona los decimales" />
              </SelectTrigger>
              <SelectContent>
                {DECIMALES_VALIDOS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {DECIMALES_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Button
        className="w-full h-12 bg-brand hover:bg-brand-dark text-white font-bold text-base"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Guardando..." : "Guardar configuración"}
      </Button>
    </div>
  );
}
