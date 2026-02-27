import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText, Calculator, TrendingUp, ShoppingCart, Package, Users } from "lucide-react";
import type { WidgetConfig } from "@/hooks/useDashboardLayout";

const DEFAULT_SHORTCUTS = [
  { labelKey: "newInvoice", path: "/accounting/invoices/new", module: "accounting", icon: FileText },
  { labelKey: "newJournalEntry", path: "/accounting/journal", module: "accounting", icon: Calculator },
  { labelKey: "addLead", path: "/crm/leads", module: "crm", icon: TrendingUp },
  { labelKey: "pos", path: "/pos", module: "pos", icon: ShoppingCart },
  { labelKey: "inventory", path: "/inventory/stock", module: "inventory", icon: Package },
  { labelKey: "employees", path: "/hr/employees", module: "hr", icon: Users },
];

interface Props {
  config?: WidgetConfig;
}

export function QuickActionsWidget({ config }: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { canAccess } = usePermissions();
  const isMobile = useIsMobile();

  const shortcuts = DEFAULT_SHORTCUTS.filter((s) => canAccess(s.module as any));

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />{t("quickActions")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`flex gap-2 ${isMobile ? "overflow-x-auto pb-2" : "flex-wrap"}`}>
          {shortcuts.map((s) => (
            <Button key={s.path} variant="outline" size="sm" className="whitespace-nowrap" onClick={() => navigate(s.path)}>
              <s.icon className="h-4 w-4 mr-1.5" /> {t(s.labelKey as any)}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
