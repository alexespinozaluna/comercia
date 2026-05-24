"use client";

import { Input } from "@/components/ui/input";
import { SectionLabel } from "./SectionLabel";

interface FechaSectionProps {
  fecha: string;
  onChange: (fecha: string) => void;
}

export function FechaSection({ fecha, onChange }: FechaSectionProps) {
  return (
    <div className="space-y-1.5">
      <SectionLabel>Fecha</SectionLabel>
      <Input
        type="date"
        value={fecha}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 text-sm rounded-md"
      />
    </div>
  );
}
