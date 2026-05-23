import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-4", className)}>
      {Icon && (
        <div className="h-14 w-14 rounded-full bg-brand-surface flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-brand" />
        </div>
      )}
      <h3 className="text-[16px] font-bold text-brand-dark">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-[280px]">{description}</p>
      )}
      {action && (
        <Button
          size="sm"
          className="mt-4 bg-brand hover:bg-brand-dark text-white"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
