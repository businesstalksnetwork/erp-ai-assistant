import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NavLink } from "@/components/NavLink";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { Building2, MapPin, Warehouse, ShoppingBag, CircleDollarSign, Landmark, Plug, FileText, Percent, Users, Globe, BookOpen } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

export default function TenantSettings() {
  const { t } = useLanguage();
  const { canAccess } = usePermissions();

  const settingsLinks = [
    { label: t("legalEntities"), icon: Building2, to: "/settings/legal-entities" },
    { label: t("locations"), icon: MapPin, to: "/settings/locations" },
    { label: t("warehouses"), icon: Warehouse, to: "/settings/warehouses" },
    { label: t("salesChannels"), icon: ShoppingBag, to: "/settings/sales-channels" },
    { label: t("costCenters"), icon: CircleDollarSign, to: "/settings/cost-centers" },
    { label: t("bankAccounts"), icon: Landmark, to: "/settings/bank-accounts" },
    { label: t("taxRates"), icon: Percent, to: "/settings/tax-rates" },
    { label: t("users"), icon: Users, to: "/settings/users" },
    { label: t("apiConfiguration"), icon: Plug, to: "/settings/integrations" },
    { label: t("businessRules"), icon: FileText, to: "/settings/business-rules" },
    { label: t("postingRules"), icon: BookOpen, to: "/settings/posting-rules" },
    ...(canAccess("web") ? [{ label: t("webSales"), icon: Globe, to: "/web/settings" }] : []),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("companySettings")}</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {settingsLinks.map((link) => (
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
      <NotificationPreferences />
    </div>
  );
}
