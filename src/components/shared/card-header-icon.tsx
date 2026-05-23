import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardHeaderIconProps {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  badge?: React.ReactNode;
  subtitle?: string;
  className?: string;
}

export function CardHeaderIcon({ icon: Icon, iconColor, title, badge, subtitle, className }: CardHeaderIconProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
          iconColor ? "" : "bg-primary/10"
        )}
        style={iconColor ? { backgroundColor: `${iconColor}1A`, color: iconColor } : undefined}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
