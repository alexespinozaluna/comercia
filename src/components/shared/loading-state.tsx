import { cn } from "@/lib/utils";

interface LoadingStateProps {
  variant?: "spinner" | "skeleton-list" | "skeleton-cards" | "skeleton-form" | "skeleton-detail";
  count?: number;
  className?: string;
}

function Bone({ className }: { className?: string }) {
  return <div className={cn("bg-brand-surface/70 animate-pulse rounded-md", className)} />;
}

export function LoadingState({ variant = "spinner", count = 3, className }: LoadingStateProps) {
  if (variant === "spinner") {
    return (
      <div className={cn("flex items-center justify-center h-64", className)}>
        <div className="h-5 w-5 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  if (variant === "skeleton-list") {
    return (
      <div className={cn("bg-white dark:bg-card rounded-lg ring-1 ring-border/50 divide-y divide-border overflow-hidden", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Bone className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <Bone className="h-3.5 w-2/5" />
              <Bone className="h-3 w-3/5" />
            </div>
            <Bone className="h-5 w-16 rounded-sm" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "skeleton-cards") {
    return (
      <div className={cn("grid grid-cols-2 md:grid-cols-3 gap-3", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-card rounded-md ring-1 ring-border/50 p-3.5 space-y-3">
            <Bone className="h-4 w-3/4" />
            <Bone className="h-6 w-1/2" />
            <Bone className="h-5 w-1/3 rounded-sm" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "skeleton-form") {
    return (
      <div className={cn("space-y-4 max-w-lg", className)}>
        <Bone className="h-8 w-40" />
        <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-4 space-y-4">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Bone className="h-3 w-24" />
              <Bone className="h-11 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "skeleton-detail") {
    return (
      <div className={cn("space-y-4 max-w-lg mx-auto", className)}>
        <Bone className="h-7 w-1/3" />
        <div className="bg-white dark:bg-card rounded-lg ring-1 ring-border/50 p-4 space-y-3">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Bone className="h-3.5 w-1/4" />
              <Bone className="h-3.5 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
