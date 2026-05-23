import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  variant?: "success" | "warning" | "error" | "info" | "neutral";
  children: React.ReactNode;
  className?: string;
}

const variants = {
  success: "bg-green-50 text-green-700 ring-green-200/60 dark:bg-green-950/30 dark:text-green-400",
  warning: "bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400",
  error:   "bg-red-50   text-red-600   ring-red-200/60   dark:bg-red-950/30   dark:text-red-400",
  info:    "bg-blue-50  text-blue-600  ring-blue-200/60  dark:bg-blue-950/30  dark:text-blue-400",
  neutral: "bg-muted text-muted-foreground ring-border/60",
};

export function StatusBadge({ variant = "neutral", children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm ring-1 px-2 py-0.5",
        "text-[11px] font-semibold uppercase tracking-[0.4px]",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
