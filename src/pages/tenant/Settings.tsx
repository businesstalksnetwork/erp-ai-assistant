import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { NavLink } from "@/components/NavLink";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { Building2, MapPin, Warehouse, ShoppingBag, CircleDollarSign, Landmark, Plug, FileText, Percent, Users, Globe, BookOpen, GitBranch, Settings, Upload, Calculator, ShieldCheck, DollarSign, GitPullRequest, Clock, Activity, CheckSquare, Tag, TrendingUp, CreditCard, List, Lock, Printer, FolderOpen, Bell } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { PageHeader } from "@/components/shared/PageHeader";

export default function TenantSettings() {
  const { t } = useLanguage();
  const { canAccess } = usePermissions();

  const sections = [
    {
      title: t("organization"),
      links: [
        { label: t("legalEntities"), icon: Building2, to: "/settings/legal-entities" },
        { label: t("locations"), icon: MapPin, to: "/settings/locations" },
        { label: t("warehouses"), icon: Warehouse, to: "/settings/warehouses" },
        { label: t("costCenters"), icon: CircleDollarSign, to: "/settings/cost-centers" },
        { label: t("currencies"), icon: DollarSign, to: "/settings/currencies" },
        { label: t("partnerCategories"), icon: Tag, to: "/settings/partner-categories" },
      ],
    },
    {
      title: t("finance"),
      links: [
        { label: t("bankAccounts"), icon: Landmark, to: "/settings/bank-accounts" },
        { label: t("taxRates"), icon: Percent, to: "/settings/tax-rates" },
        { label: t("postingRules"), icon: BookOpen, to: "/settings/posting-rules" },
        { label: t("accountingArchitecture"), icon: GitBranch, to: "/settings/accounting-architecture" },
        { label: t("payrollParamsTitle"), icon: Calculator, to: "/settings/payroll-parameters" },
        { label: t("payrollPaymentTypes" as any), icon: CreditCard, to: "/hr/payroll/payment-types" },
        { label: t("payrollCategories" as any), icon: List, to: "/hr/payroll/categories" },
        ...(canAccess("pos") ? [{ label: t("fiscalDevices"), icon: Printer, to: "/pos/fiscal-devices" }] : []),
      ],
    },
    {
      title: t("operations"),
      links: [
        { label: t("users"), icon: Users, to: "/settings/users" },
        { label: t("businessRules"), icon: FileText, to: "/settings/business-rules" },
        { label: t("salesChannels"), icon: ShoppingBag, to: "/sales/sales-channels" },
        { label: t("apiConfiguration"), icon: Plug, to: "/settings/integrations" },
        ...(canAccess("web") ? [{ label: t("webSales"), icon: Globe, to: "/sales/web-settings" }] : []),
        { label: t("opportunityStages"), icon: TrendingUp, to: "/settings/opportunity-stages" },
        { label: t("discountApprovalRules" as any), icon: Percent, to: "/settings/discount-rules" },
        { label: t("notificationCategorySettings" as any), icon: Bell, to: "/settings/notification-categories" },
      ],
    },
    {
      title: t("auditData"),
      links: [
        { label: t("approvalWorkflows"), icon: GitPullRequest, to: "/settings/approvals" },
        { label: t("pendingApprovals"), icon: CheckSquare, to: "/settings/pending-approvals" },
        { label: t("auditLog"), icon: Activity, to: "/settings/audit-log" },
        { label: t("aiAuditLog"), icon: ShieldCheck, to: "/settings/ai-audit-log" },
        { label: t("eventMonitor"), icon: Clock, to: "/settings/events" },
        { label: t("legacyImport"), icon: Upload, to: "/settings/legacy-import" },
        { label: t("dataProtection"), icon: Lock, to: "/settings/data-protection" },
      ],
    },
    {
      title: t("dmsSettings"),
      links: [
        { label: t("dmsSettings"), icon: FolderOpen, to: "/settings/dms" },
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