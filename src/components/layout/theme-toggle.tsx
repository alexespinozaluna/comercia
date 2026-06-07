"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

/** Botón para alternar entre modo claro y oscuro. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes no conoce el tema en el server: montar primero evita el
  // desajuste de hidratación (renderiza un placeholder hasta montar).
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-9 shrink-0" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      className="inline-flex items-center justify-center rounded-md h-9 w-9 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
