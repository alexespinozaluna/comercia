"use client";

import { Receipt } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./SectionLabel";

interface FormaVentaToggleProps {
  isCredit: boolean;
  onChange: (isCredit: boolean) => void;
}

const OPTIONS = [
  { value: "efectivo" as const, label: "Contado", isCredit: false },
  { value: "credito" as const, label: "Crédito", isCredit: true },
];

export function FormaVentaToggle({ isCredit, onChange }: FormaVentaToggleProps) {
  return (
    <div className="space-y-2">
      <SectionLabel>Forma de venta</SectionLabel>
      <div className="relative flex bg-muted/60 rounded-lg p-[3px] gap-0">
        {OPTIONS.map((opt) => {
          const active = opt.isCredit === isCredit;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.isCredit)}
              className="relative flex-1 flex items-center justify-center gap-1.5 z-10 py-2 px-3 rounded-md"
            >
              {active && (
                <motion.div
                  layoutId="forma-venta-toggle"
                  className="absolute inset-0 bg-white dark:bg-card rounded-md shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Receipt
                className={cn(
                  "relative z-10 h-3.5 w-3.5",
                  active ? "text-brand" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "relative z-10 text-sm transition-colors",
                  active ? "font-semibold text-brand-dark" : "font-medium text-muted-foreground"
                )}
              >
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
