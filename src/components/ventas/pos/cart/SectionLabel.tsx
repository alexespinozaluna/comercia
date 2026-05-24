"use client";

import { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** Uppercase muted label shared across all cart sections. */
export function SectionLabel({ children, icon, className }: SectionLabelProps) {
  return (
    <Label
      className={cn(
        "text-xs font-semibold text-muted-foreground uppercase tracking-wider",
        icon && "flex items-center gap-1",
        className
      )}
    >
      {icon}
      {children}
    </Label>
  );
}
