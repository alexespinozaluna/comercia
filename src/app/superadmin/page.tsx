"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SistemaTenant } from "@/types/database";
import { apiGet, apiPost } from "@/lib/api-client";
import { useGuardar } from "@/hooks/use-guardar";
import { useAppStore } from "@/stores/app-store";
import { ROL_SUPERADMIN } from "@/types/usuario";
import {
  LOCALES_VALIDOS,
  LOCALE_LABELS,
  DECIMALES_VALIDOS,
  DECIMALES_LABELS,
  DEFAULT_LOCALE,
  type LocaleValido,
  type DecimalesValidos,
} from "@/types/locale";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";
import { Building2 } from "lucide-react";

const EMPTY = {
  codigo: "",
  nombre: "",
  adminCodigo: "",
  adminNombre: "",
  adminPassword: "",
  negocioNombre: "",
  locale: DEFAULT_LOCALE as LocaleValido,
  decimales: 0 as DecimalesValidos,
  simbolo: "",
};

export default function SuperadminPage() {
  const router = useRouter();
  const authUser = useAppStore((s) => s.authUser);
  const { saving, guardar } = useGuardar();
  const [tenants, setTenants] = useState<SistemaTenant[] | null>(null);
  const [form, setForm] = useState(EMPTY);

  // Guard: solo SUPERADMIN.
  useEffect(() => {
    if (authUser && authUser.rol !== ROL_SUPERADMIN) router.replace("/");
  }, [authUser, router]);

  const load = useCallback(async () => {
    try {
      setTenants(await apiGet<SistemaTenant[]>("/api/admin/tenants"));
    } catch (err) {
      console.error(err);
      toast.error("Error cargando tenants");
    }
  }, []);

  useEffect(() => {
    if (authUser?.rol === ROL_SUPERADMIN) load();
  }, [authUser, load]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleCrear = () =>
    guardar(async () => {
      try {
        await apiPost("/api/admin/tenants", form);
        toast.success(`Tenant "${form.nombre}" creado`);
        setForm(EMPTY);
        await load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al crear tenant");
      }
    });

  if (authUser && authUser.rol !== ROL_SUPERADMIN) return null;

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <PageHeader title="Tenants" />

      {/* Form: nuevo tenant */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 space-y-3">
        <h2 className="text-sm font-bold">Nuevo tenant</h2>

        <Field label="Código del tenant *">
          <Input value={form.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="ej: panaderia-sur" className="h-11" />
        </Field>
        <Field label="Nombre del tenant *">
          <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="ej: Panadería Sur" className="h-11" />
        </Field>

        <div className="pt-1 border-t border-border/60" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Administrador inicial</h3>
        <Field label="Código (usuario) *">
          <Input value={form.adminCodigo} onChange={(e) => set("adminCodigo", e.target.value)} placeholder="ej: admin-sur" className="h-11" />
        </Field>
        <Field label="Nombre *">
          <Input value={form.adminNombre} onChange={(e) => set("adminNombre", e.target.value)} className="h-11" />
        </Field>
        <Field label="Contraseña *">
          <Input type="password" value={form.adminPassword} onChange={(e) => set("adminPassword", e.target.value)} className="h-11" />
        </Field>

        <div className="pt-1 border-t border-border/60" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sucursal principal</h3>
        <Field label="Nombre de la sucursal">
          <Input value={form.negocioNombre} onChange={(e) => set("negocioNombre", e.target.value)} placeholder="(usa el nombre del tenant si se deja vacío)" className="h-11" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="País / locale">
            <select
              className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.locale}
              onChange={(e) => set("locale", e.target.value as LocaleValido)}
            >
              {LOCALES_VALIDOS.map((l) => (
                <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
              ))}
            </select>
          </Field>
          <Field label="Decimales">
            <select
              className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.decimales}
              onChange={(e) => set("decimales", Number(e.target.value) as DecimalesValidos)}
            >
              {DECIMALES_VALIDOS.map((d) => (
                <option key={d} value={d}>{DECIMALES_LABELS[d]}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Símbolo de moneda (opcional)">
          <Input value={form.simbolo} onChange={(e) => set("simbolo", e.target.value)} placeholder="vacío = moneda nacional del país" className="h-11" />
        </Field>

        <Button
          className="w-full h-11 bg-brand hover:bg-brand-dark text-white font-semibold"
          onClick={handleCrear}
          disabled={saving}
        >
          {saving ? "Creando..." : "Crear tenant"}
        </Button>
      </div>

      {/* Lista de tenants */}
      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 overflow-hidden">
        <div className="px-4 py-2 border-b border-border bg-muted/40">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tenants existentes</span>
        </div>
        {tenants === null ? (
          <LoadingState variant="skeleton-detail" count={3} />
        ) : tenants.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Sin tenants.</p>
        ) : (
          <div className="divide-y divide-border">
            {tenants.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="h-8 w-8 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.Nombre}</div>
                  <div className="text-[11px] text-muted-foreground">#{t.id} · {t.Codigo}</div>
                </div>
                {t.Estado !== 1 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm bg-destructive/10 text-destructive">Inactivo</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}
