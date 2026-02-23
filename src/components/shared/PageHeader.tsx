import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}

export function PageHeader({ title, description, icon: Icon, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between pb-6 mb-8 border-b border-border/60">
      <div className="flex items-start gap-4 flex-1">
        {Icon && (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/15 to-primary/10 border-2 border-primary/20 shadow-sm flex-shrink-0">
            <Icon className="h-7 w-7 text-primary" />
          </div>
        )}
        <div className="space-y-2 flex-1 min-w-0">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
