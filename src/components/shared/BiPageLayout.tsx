import type { ReactNode } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsBar, type StatItem } from "@/components/shared/StatsBar";
import type { LucideIcon } from "lucide-react";

interface BiPageLayoutProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  stats?: StatItem[];
  actions?: ReactNode;
  children: ReactNode;
}

export function BiPageLayout({ title, description, icon, stats, actions, children }: BiPageLayoutProps) {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <PageHeader title={title} description={description} icon={icon} actions={actions} />

      {stats && stats.length > 0 && <StatsBar stats={stats} />}

      <div className="space-y-5">
        {children}
      </div>
    </div>
  );
}
