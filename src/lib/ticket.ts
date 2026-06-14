import { numToString, cantidadString, fechaCortaHora, type FormatoNegocio } from "@/lib/format";
import { labelFormaVenta } from "@/lib/terminologia";
import {
  DEFAULT_DECIMALES,
  DEFAULT_LOCALE,
  esDecimalesValido,
  esLocaleValido,
  simboloEfectivo,
} from "@/types/locale";
import type { DocumentoDisplay, Negocio } from "@/types/database";

// Anchos de impresora térmica (puntos a 203 dpi): 58mm ≈ 384, 80mm ≈ 576.
export type TicketWidth = 58 | 80;

interface TicketOpts {
  doc: DocumentoDisplay;
  negocio: Negocio | null;
  widthMm?: TicketWidth;
}

/**
 * Dibuja el ticket en un canvas (compatible 58mm/80mm, por defecto 80mm) y lo
 * devuelve recortado a su alto real. Pensado para compartir/descargar como PNG.
 */
export function renderTicketCanvas({ doc, negocio, widthMm = 80 }: TicketOpts): HTMLCanvasElement {
  const cfg =
    widthMm === 58
      ? { w: 384, pad: 14, base: 16, h1: 24, total: 22 }
      : { w: 576, pad: 22, base: 22, h1: 34, total: 30 };
  const lh = Math.round(cfg.base * 1.45);

  // Formato explícito del negocio del documento: el ticket no debe depender del
  // estado global de `format.ts` (sería frágil para links públicos / otro negocio).
  const locale = esLocaleValido(negocio?.Locale) ? negocio!.Locale : DEFAULT_LOCALE;
  const fmt: FormatoNegocio = {
    locale,
    decimales: esDecimalesValido(negocio?.Decimales) ? negocio!.Decimales : DEFAULT_DECIMALES,
    simbolo: simboloEfectivo(negocio?.SimboloMoneda, locale),
  };

  const items = doc.DocumentoItem ?? [];
  const canvas = document.createElement("canvas");
  canvas.width = cfg.w;
  // Alto generoso; al final se recorta a lo realmente usado.
  canvas.height = 800 + items.length * lh * 3;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";

  const cx = cfg.w / 2;
  const left = cfg.pad;
  const right = cfg.w - cfg.pad;
  const innerW = cfg.w - cfg.pad * 2;
  let y = cfg.pad;

  const font = (size: number, bold = false) => {
    ctx.font = `${bold ? "bold " : ""}${size}px Arial, sans-serif`;
  };

  const wrap = (text: string, maxW: number): string[] => {
    const words = (text ?? "").split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(t).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = t;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const center = (text: string, size: number, bold = false) => {
    if (!text) return;
    font(size, bold);
    ctx.textAlign = "center";
    for (const l of wrap(text, innerW)) {
      ctx.fillText(l, cx, y);
      y += Math.round(size * 1.4);
    }
  };

  // Etiqueta a la izquierda, valor a la derecha (con wrap del valor).
  const lineLR = (label: string, value: string) => {
    font(cfg.base);
    ctx.textAlign = "left";
    ctx.fillText(label, left, y);
    const labelW = ctx.measureText(label).width;
    const valLines = wrap(value, innerW - labelW - 8);
    ctx.textAlign = "right";
    ctx.fillText(valLines[0] ?? "", right, y);
    y += lh;
    for (let i = 1; i < valLines.length; i++) {
      ctx.textAlign = "right";
      ctx.fillText(valLines[i], right, y);
      y += lh;
    }
  };

  const sep = () => {
    font(cfg.base);
    ctx.textAlign = "center";
    const dashW = ctx.measureText("-").width || 1;
    ctx.fillText("-".repeat(Math.floor(innerW / dashW)), cx, y);
    y += lh;
  };

  // ── Encabezado: negocio ──────────────────────────────────────
  center(negocio?.Nombre || "Comercia", cfg.h1, true);
  center(negocio?.Direccion || "", cfg.base);
  center(negocio?.Telefono || "", cfg.base);
  y += 4;
  sep();

  // ── Datos ────────────────────────────────────────────────────
  lineLR("Fecha:", fechaCortaHora(doc.FechaEmision, doc.FechaCreacion));
  lineLR("Forma Venta:", labelFormaVenta(doc.bCredito).toUpperCase());
  if (doc.Cliente?.Nombre) lineLR("Cliente:", doc.Cliente.Nombre);
  if (doc.DireccionEntrega) lineLR("Direccion:", doc.DireccionEntrega);
  sep();

  // ── Productos ────────────────────────────────────────────────
  font(cfg.base, true);
  ctx.textAlign = "left";
  ctx.fillText("PRODUCTOS", left, y);
  y += lh;

  for (const it of items) {
    font(cfg.base);
    ctx.textAlign = "left";
    for (const l of wrap(it.Descripcion, innerW)) {
      ctx.fillText(l, left, y);
      y += lh;
    }
    ctx.textAlign = "left";
    ctx.fillText(`${cantidadString(it.Cantidad, fmt)} x ${numToString(it.PrecioVenta, undefined, fmt)}`, left, y);
    ctx.textAlign = "right";
    ctx.fillText(numToString(it.Total, undefined, fmt), right, y);
    y += lh;
  }
  sep();

  // ── Total ────────────────────────────────────────────────────
  font(cfg.total, true);
  ctx.textAlign = "left";
  ctx.fillText("TOTAL", left, y);
  ctx.textAlign = "right";
  ctx.fillText(numToString(doc.Total, undefined, fmt), right, y);
  y += Math.round(cfg.total * 1.6);

  // ── Pie ──────────────────────────────────────────────────────
  center("Gracias por su compra", cfg.base);
  y += cfg.pad;

  // Recortar al alto real
  const out = document.createElement("canvas");
  out.width = cfg.w;
  out.height = Math.min(Math.ceil(y), canvas.height);
  const octx = out.getContext("2d")!;
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(canvas, 0, 0);
  return out;
}

/** Convierte el canvas del ticket a Blob PNG. */
export function ticketToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
