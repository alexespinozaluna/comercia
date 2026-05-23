import { cn } from "@/lib/utils";

interface DataTableWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function DataTableWrapper({ children, className }: DataTableWrapperProps) {
  return (
    <div className={cn("overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0", className)}>
      <div className="min-w-[640px] rounded-xl border bg-card text-card-foreground shadow-sm">
        {children}
      </div>
    </div>
  );
}
