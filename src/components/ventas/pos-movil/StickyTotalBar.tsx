"use client";

import { ChevronRight } from "lucide-react";
import { numToString } from "@/lib/format";

interface StickyTotalBarProps {
  label: string;
  total: number;
  onClick: () => void;
}

/** Barra fija inferior del wizard móvil, sobre el bottom nav del AppShell. */
export function StickyTotalBar({ label, total, onClick }: StickyTotalBarProps) {
  return (
    <div className="fixed bottom-[calc(3.5rem+1rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 md:hidden">
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-between bg-brand hover:bg-brand-dark text-white rounded-full px-5 py-3 shadow-lg transition-colors"
      >
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm font-bold flex items-center gap-1">
          {numToString(total)}
          <ChevronRight className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}
