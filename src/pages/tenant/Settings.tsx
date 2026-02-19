import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { NavLink } from "@/components/NavLink";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { Building2, MapPin, Warehouse, ShoppingBag, CircleDollarSign, Landmark, Plug, FileText, Percent, Users, Globe, BookOpen, GitBranch, Settings, Upload } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { PageHeader } from "@/components/shared/PageHeader";

export default function TenantSettings() {
  const { t } = useLanguage();
  const { canAccess } = usePermissions();

  const sections = [
    {
      title: t("organization" as any) || "Organization",
      links: [
        { label: t("legalEntities"), icon: Building2, to: "/settings/legal-entities" },
        { label: t("locations"), icon: MapPin, to: "/settings/locations" },
        { label: t("warehouses"), icon: Warehouse, to: "/settings/warehouses" },
        { label: t("costCenters"), icon: CircleDollarSign, to: "/settings/cost-centers" },
      ],
    },
    {
      title: t("finance" as any) || "Finance",
      links: [
        { label: t("bankAccounts"), icon: Landmark, to: "/settings/bank-accounts" },
        { label: t("taxRates"), icon: Percent, to: "/settings/tax-rates" },
        { label: t("postingRules"), icon: BookOpen, to: "/settings/posting-rules" },
        { label: t("accountingArchitecture"), icon: GitBranch, to: "/settings/accounting-architecture" },
      ],
    },
    {
      title: t("operations" as any) || "Operations",
      links: [
        { label: t("users"), icon: Users, to: "/settings/users" },
        { label: t("apiConfiguration"), icon: Plug, to: "/settings/integrations" },
        { label: t("businessRules"), icon: FileText, to: "/settings/business-rules" },
        { label: t("salesChannels"), icon: ShoppingBag, to: "/sales/sales-channels" },
        ...(canAccess("web") ? [{ label: t("webSales"), icon: Globe, to: "/web/settings" }] : []),
        { label: "Legacy Import", icon: Upload, to: "/settings/legacy-import" },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("companySettings")} icon={Settings} description={t("companySettings")} />

      {sections.map((section) => (
        <div key={section.title} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{section.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {section.links.map((link) => (
              <NavLink key={link.to} to={link.to} className="block" activeClassName="">
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                    <link.icon className="h-8 w-8 text-primary" />
                    <span className="text-sm font-medium text-center">{link.label}</span>
                  </CardContent>
                </Card>
              </NavLink>
            ))}
          </div>
        </div>
      ))}

      <NotificationPreferences />
    </div>
  );
}