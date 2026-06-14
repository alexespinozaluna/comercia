"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Negocio } from "@/types/database";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import type { UsuarioSinPassword } from "@/types/usuario";
import { ROLES_VALIDOS } from "@/types/usuario";
import { useAppStore } from "@/stores/app-store";
import { useResource } from "@/hooks/use-resource";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useGuardar } from "@/hooks/use-guardar";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
      {children}
    </label>
  );
}

export default function UsuarioDatosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const authUser = useAppStore((s) => s.authUser);

  const rawId = use(params).id;
  const isEdit = rawId !== "nuevo";
  const id = isEdit ? parseInt(rawId, 10) : null;
  const { saving, guardar } = useGuardar();

  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<string>("CAJERO");
  const [idNegocio, setIdNegocio] = useState<number | null>(null);
  const [estado, setEstado] = useState<number>(1);

  // Guard: solo ADMIN.
  useEffect(() => {
    if (authUser && authUser.rol !== "ADMIN") router.replace("/");
  }, [authUser, router]);

  const { data, loading } = useResource(async () => {
    if (authUser?.rol !== "ADMIN") {
      return { negocios: [] as Negocio[], usuario: null as UsuarioSinPassword | null };
    }
    const negociosList = await apiGet<Negocio[]>("/api/negocio").catch(() => [] as Negocio[]);
    const usuario =
      isEdit && id != null ? await apiGet<UsuarioSinPassword>(`/api/usuarios/${id}`) : null;
    return { negocios: negociosList, usuario };
  }, [authUser?.rol, id]);
  const negocios = data?.negocios ?? [];

  // Poblar el formulario: en edición con los datos del usuario; en alta,
  // pre-selecciona la primera sucursal activa para no-ADMIN.
  useEffect(() => {
    if (!data) return;
    if (data.usuario) {
      setCodigo(data.usuario.Codigo);
      setNombre(data.usuario.Nombre);
      setRol(data.usuario.Rol);
      setIdNegocio(data.usuario.IdNegocio);
      setEstado(data.usuario.Estado);
    } else if (!isEdit) {
      const activa = data.negocios.find((n) => n.Estado === 1) ?? null;
      setIdNegocio(activa?.id ?? null);
    }
  }, [data, isEdit]);

  const onRolChange = (nuevo: string | null) => {
    if (!nuevo) return;
    setRol(nuevo);
    if (nuevo === "ADMIN") {
      setIdNegocio(null);
    } else if (idNegocio == null) {
      // Pre-seleccionar la primera sucursal activa para no-ADMIN.
      const activa = negocios.find((n) => n.Estado === 1) ?? null;
      setIdNegocio(activa?.id ?? null);
    }
  };

  const handleSave = () => guardar(async () => {
    if (!nombre.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    if (!isEdit && !codigo.trim()) {
      toast.error("Código requerido");
      return;
    }
    if (!isEdit && !password) {
      toast.error("Password requerido");
      return;
    }
    if (rol !== "ADMIN" && idNegocio == null) {
      toast.error(`IdNegocio requerido para rol ${rol}`);
      return;
    }

    try {
      if (isEdit && id != null) {
        await apiPut(`/api/usuarios/${id}`, {
          Nombre: nombre,
          Password: password || undefined,
          Rol: rol,
          IdNegocio: rol === "ADMIN" ? null : idNegocio,
          Estado: estado,
        });
        toast.success("Usuario actualizado");
      } else {
        await apiPost("/api/usuarios", {
          Codigo: codigo,
          Nombre: nombre,
          Password: password,
          Rol: rol,
          IdNegocio: rol === "ADMIN" ? null : idNegocio,
        });
        toast.success("Usuario creado");
      }
      router.push("/configuracion/usuarios");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    }
  });

  if (authUser && authUser.rol !== "ADMIN") {
    return (
      <EmptyState title="Acceso restringido" description="Solo administradores." />
    );
  }

  if (authUser == null || loading) return <LoadingState variant="skeleton-form" count={5} />;

  const negociosActivos = negocios.filter((n) => n.Estado === 1);
  const isSelf = isEdit && authUser?.id === id;
  const esAdmin = rol === "ADMIN";

  return (
    <div className="space-y-2 max-w-lg">
      <PageHeader
        title={isEdit ? "Editar usuario" : "Nuevo usuario"}
        backHref="/configuracion/usuarios"
        breadcrumbs={[
          { label: "Usuarios", href: "/configuracion/usuarios" },
          { label: isEdit ? nombre || "Editar" : "Nuevo" },
        ]}
      />

      <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-3 space-y-2">
        <div>
          <FieldLabel>Código</FieldLabel>
          <Input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código único de inicio de sesión"
            className="h-11 rounded-md"
            disabled={isEdit}
          />
        </div>

        <div>
          <FieldLabel>Nombre</FieldLabel>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del usuario"
            className="h-11 rounded-md"
          />
        </div>

        <div>
          <FieldLabel>
            {isEdit ? "Nuevo password (opcional)" : "Password"}
          </FieldLabel>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? "Dejar vacío para no cambiar" : "Password"}
            className="h-11 rounded-md"
          />
        </div>

        <div>
          <FieldLabel>Rol</FieldLabel>
          <Select value={rol} onValueChange={onRolChange} disabled={isSelf}>
            <SelectTrigger className="h-11 rounded-md">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              {ROLES_VALIDOS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSelf && (
            <p className="text-[11px] text-muted-foreground mt-1">
              No puedes cambiar tu propio rol.
            </p>
          )}
        </div>

        <div>
          <FieldLabel>Sucursal</FieldLabel>
          <Select
            value={esAdmin ? "__todas__" : idNegocio?.toString() ?? ""}
            onValueChange={(v) => setIdNegocio(v ? parseInt(v, 10) : null)}
            disabled={esAdmin}
          >
            <SelectTrigger className="h-11 rounded-md">
              <SelectValue placeholder="Seleccionar sucursal" />
            </SelectTrigger>
            <SelectContent>
              {esAdmin ? (
                <SelectItem value="__todas__">Todas las sucursales</SelectItem>
              ) : (
                negociosActivos.map((n) => (
                  <SelectItem key={n.id} value={n.id.toString()}>
                    {n.Nombre ?? `Negocio #${n.id}`}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {esAdmin && (
            <p className="text-[11px] text-muted-foreground mt-1">
              ADMIN puede navegar entre todas las sucursales.
            </p>
          )}
        </div>

        {isEdit && (
          <div className="flex items-center justify-between pt-1">
            <div>
              <FieldLabel>Estado</FieldLabel>
              <p className="text-xs text-muted-foreground">
                {estado === 1 ? "Activo" : "Inactivo"}
                {isSelf && " (no puedes desactivarte)"}
              </p>
            </div>
            <Switch
              checked={estado === 1}
              onCheckedChange={(v) => setEstado(v ? 1 : 0)}
              disabled={isSelf}
            />
          </div>
        )}
      </div>

      <Button
        className="w-full h-12 bg-brand hover:bg-brand-dark text-white font-bold text-base"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear usuario"}
      </Button>
    </div>
  );
}
