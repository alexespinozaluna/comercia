"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export function SearchInput({
  value = "",
  onChange,
  placeholder = "Buscar...",
  debounceMs = 300,
  className,
}: SearchInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  };

  const handleClear = () => {
    setInputValue("");
    onChange("");
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleChange}
        className={cn(
          "w-full h-10 rounded-md bg-white dark:bg-card border border-border pl-9 pr-9 text-sm",
          "placeholder:text-muted-foreground/60 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        )}
        aria-label={placeholder}
      />
      {inputValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
