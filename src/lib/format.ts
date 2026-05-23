/** Formato de moneda es-ES: $ 37.500 */
export function numToString(value: number | null | undefined, format: "N0" | "N2" = "N0"): string {
  const safe = value ?? 0;
  const decimals = format === "N2" ? 2 : 0;
  return `$ ${safe.toLocaleString("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** Formato fecha corta con hora: dd/MMM | h:mm tt */
export function fechaCortaHora(fecha: Date, fechaHora: Date): string {
  if (fecha.toDateString() === fechaHora.toDateString()) {
    const d = fechaHora.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
    const t = fechaHora.toLocaleTimeString("es-ES", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${d} | ${t}`;
  }
  const d = fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  const t = fechaHora.toLocaleTimeString("es-ES", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${d} | ${t}`;
}

/** Formato fecha corta: dd/MM/yy */
export function fechaString(fechaHora: Date): string {
  const d = fechaHora.getDate().toString().padStart(2, "0");
  const m = (fechaHora.getMonth() + 1).toString().padStart(2, "0");
  const y = fechaHora.getFullYear().toString().slice(-2);
  return `${d}/${m}/${y}`;
}

/** Extrae iniciales de las primeras 2 palabras del nombre */
export function extraerIniciales(nombre: string): string {
  if (!nombre?.trim()) return "";
  const palabras = nombre.trim().split(" ").slice(0, 2);
  return palabras.map((p) => p[0]).join("").toUpperCase();
}

/** Trunca string con ... si excede la cantidad */
export function sbsLeft(value: string, cant: number): string {
  return value.length > cant ? `${value.substring(0, cant)}...` : value;
}