"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, backHref, breadcrumbs, actions, className }: PageHeaderProps) {
  const router = useRouter();
  return (
    <div className={cn("flex items-start gap-2 mb-5", className)}>
      {backHref && (
        <button
          type="button"
          className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1.5 hover:bg-muted/60 shrink-0 mt-1"
          onClick={() => router.push(backHref)}
          aria-label="Volver"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver
        </button>
      )}
      <div className="flex-1 min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground/40">/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[20px] font-bold truncate leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-[13px] text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
