"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, User, LogIn } from "lucide-react";
import { useAppStore } from "@/stores/app-store";

export default function LoginPage() {
  const router = useRouter();
  const setAuthUser = useAppStore((s) => s.setAuthUser);
  const [codigo, setCodigo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!codigo || !password) {
      setError("Ingrese usuario y contraseña");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Credenciales inválidas");
        return;
      }
      setAuthUser(data.user);
      toast.success(`Bienvenido, ${data.user.nombre}`);
      router.push("/");
      router.refresh();
    } catch {
      setError("Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-page-bg">
      <div className="w-full max-w-[380px] bg-white rounded-lg ring-1 ring-border/50 shadow-sm p-8 space-y-6">
        {/* Brand */}
        <div className="text-center space-y-1">
          <h1 className="text-[22px] font-extrabold text-brand leading-none">Comercia</h1>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Sistema POS
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Usuario
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="admin"
                className="h-11 pl-9 rounded-md"
                disabled={loading}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="h-11 pl-9 rounded-md"
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200/60 px-3 py-2.5 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 bg-brand hover:bg-brand-dark text-white font-bold text-base gap-2"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Ingresando...
              </span>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Iniciar sesión
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
