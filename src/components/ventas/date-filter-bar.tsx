"use client";

import { useMemo } from "react";
import { obtenerRangosDeFechas } from "@/lib/date-utils";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTER_TYPES = [
  { key: "Dia", label: "Día" },
  { key: "Semana", label: "Semana" },
  { key: "Mes", label: "Mes" },
  { key: "Ano", label: "Año" },
];

interface DateFilterBarProps {
  tipo: string;
  index: number;
  fechaInicio: string;
  fechaFin: string;
  onFilterChange: (tipo: string, index: number, fechaInicio: string, fechaFin: string) => void;
}

export function DateFilterBar({ tipo, index, fechaInicio, fechaFin, onFilterChange }: DateFilterBarProps) {
  const rangos = useMemo(() => obtenerRangosDeFechas(tipo), [tipo]);

  const handleSelectTipo = (key: string) => {
    const newRangos = obtenerRangosDeFechas(key);
    const actual = newRangos.find((r) => r.bActual);
    if (actual) {
      const fi = format(actual.FechaInicio, "yyyy-MM-dd");
      const ff = format(actual.FechaFin, "yyyy-MM-dd");
      onFilterChange(key, 0, fi, ff);
    }
  };

  const handleSelectRange = (i: number) => {
    if (rangos[i]) {
      const fi = format(rangos[i].FechaInicio, "yyyy-MM-dd");
      const ff = format(rangos[i].FechaFin, "yyyy-MM-dd");
      onFilterChange(tipo, i, fi, ff);
    }
  };

  const rangoLabel = rangos[index]?.FechaTexto ?? `${fechaInicio} – ${fechaFin}`;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Tipo pills */}
      <div className="flex gap-1">
        {FILTER_TYPES.map((f) => (
          <button
            key={f.key}
            onClick={() => handleSelectTipo(f.key)}
            className={cn(
              "text-xs px-2.5 py-1 h-7 rounded-full font-medium transition-colors",
              tipo === f.key
                ? "bg-brand-surface text-brand-dark"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Range dropdown — pill trigger */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1 text-xs px-2.5 py-1 h-7 rounded-full font-medium bg-muted/60 text-muted-foreground hover:bg-muted transition-colors outline-none">
          <span className="capitalize">{rangoLabel}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
          {rangos.map((r, i) => (
            <DropdownMenuItem
              key={i}
              onClick={() => handleSelectRange(i)}
              className={cn("text-xs capitalize", i === index && "bg-brand-surface text-brand-dark")}
            >
              {r.FechaTexto}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
