import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { Bell } from "lucide-react";
import { getNotificationCategoriesForRole, type NotificationCategory } from "@/config/roleNotificationCategories";
import { type TenantRole } from "@/config/rolePermissions";

const ALL_ROLES: TenantRole[] = ["admin", "manager", "accountant", "sales", "hr", "store", "user"];
const ALL_CATEGORIES: NotificationCategory[] = ["invoice", "inventory", "approval", "hr", "accounting"];

const categoryKeys: Record<string, string> = {
  invoice: "invoiceNotifications",
  inventory: "inventoryNotifications",
  approval: "approvalNotifications",
  hr: "hrNotifications",
  accounting: "accountingNotifications",
};

type OverrideMap = Record<string, Record<string, boolean>>;

export default function NotificationCategorySettings() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [loading, setLoading] = useState(true);

  // Build default map from hardcoded config
  const getDefaults = useCallback((): OverrideMap => {
    const map: OverrideMap = {};
    for (const role of ALL_ROLES) {
      const cats = getNotificationCategoriesForRole(role);
      map[role] = {};
      for (const cat of ALL_CATEGORIES) {
        map[role][cat] = cats.includes(cat);
      }
    }
    return map;
  }, []);

  const fetchOverrides = useCallback(async () => {
    if (!tenantId) return;
    const defaults = getDefaults();

    const { data } = await supabase
      .from("role_notification_overrides" as any)
      .select("role, category, enabled")
      .eq("tenant_id", tenantId);

    if (data && (data as any[]).length > 0) {
      for (const row of data as any[]) {
        if (defaults[row.role]) {
          defaults[row.role][row.category] = row.enabled;
        }
      }
    }

    setOverrides(defaults);
    setLoading(false);
  }, [tenantId, getDefaults]);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  const toggleCategory = async (role: string, category: string) => {
    if (!tenantId) return;
    const newValue = !overrides[role]?.[category];

    setOverrides((prev) => ({
      ...prev,
      [role]: { ...prev[role], [category]: newValue },
    }));

    const { error } = await supabase
      .from("role_notification_overrides" as any)
      .upsert(
        { tenant_id: tenantId, role, category, enabled: newValue } as any,
        { onConflict: "tenant_id,role,category" }
      );

    if (error) {
      toast.error(error.message);
      setOverrides((prev) => ({
        ...prev,
        [role]: { ...prev[role], [category]: !newValue },
      }));
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("notificationCategorySettings" as any)}
        icon={Bell}
        description={t("notificationCategorySettingsDesc" as any)}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t("notificationCategorySettings" as any)}</CardTitle>
          <CardDescription>{t("notificationCategorySettingsDesc" as any)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                    {t("role" as any)}
                  </th>
                  {ALL_CATEGORIES.map((cat) => (
                    <th key={cat} className="text-center py-2 px-3 font-medium text-muted-foreground">
                      {t(categoryKeys[cat] as any)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_ROLES.map((role) => (
                  <tr key={role} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 font-medium capitalize">{role}</td>
                    {ALL_CATEGORIES.map((cat) => (
                      <td key={cat} className="text-center py-3 px-3">
                        <Checkbox
                          checked={overrides[role]?.[cat] ?? false}
                          onCheckedChange={() => toggleCategory(role, cat)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
