"use client";

import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { numToString } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CartBottomBarProps {
  total: number;
  saving: boolean;
  canSave: boolean;
  isEdit: boolean;
  onSave: () => void;
}

export function CartBottomBar({ total, saving, canSave, isEdit, onSave }: CartBottomBarProps) {
  return (
    <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-white/95 dark:bg-card/95 backdrop-blur-sm border-t">
      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-[28px] font-extrabold tabular-nums leading-none text-brand-dark">
            {numToString(total)}
          </span>
        </div>
        <Button
          className={cn(
            "w-full h-12 text-base font-bold bg-brand hover:bg-brand-dark text-white rounded-md transition-all",
            (!canSave || saving) && "opacity-50 cursor-not-allowed"
          )}
          onClick={onSave}
          disabled={!canSave || saving}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Guardando...
            </span>
          ) : (
            <>
              <Receipt className="h-5 w-5 mr-2" />
              {isEdit ? "Modificar venta" : "Guardar venta"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
