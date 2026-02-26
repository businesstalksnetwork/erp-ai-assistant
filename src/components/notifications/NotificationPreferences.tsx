import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  isCurrentlySubscribed,
} from "@/lib/pushSubscription";
import { getNotificationCategoriesForRole, getCustomCategoriesForRole, type NotificationCategory } from "@/config/roleNotificationCategories";
import { type TenantRole } from "@/config/rolePermissions";

const ALL_CATEGORIES: NotificationCategory[] = ["invoice", "inventory", "approval", "hr", "accounting"];
const CHANNELS = ["in_app_enabled", "push_enabled", "email_enabled"] as const;

const categoryKeys: Record<string, string> = {
  invoice: "invoiceNotifications",
  inventory: "inventoryNotifications",
  approval: "approvalNotifications",
  hr: "hrNotifications",
  accounting: "accountingNotifications",
};

const channelKeys: Record<string, string> = {
  in_app_enabled: "inAppChannel",
  push_enabled: "pushChannel",
  email_enabled: "emailChannel",
};

type ChannelPrefs = Record<string, Record<string, boolean>>;

export function NotificationPreferences() {
  const { user } = useAuth();
  const { tenantId, role } = useTenant();
  const { t } = useLanguage();
  const [visibleCategories, setVisibleCategories] = useState<NotificationCategory[]>(
    () => getNotificationCategoriesForRole((role as TenantRole) || "user")
  );

  useEffect(() => {
    if (!tenantId || !role) return;
    getCustomCategoriesForRole(tenantId, (role as TenantRole) || "user", supabase).then(setVisibleCategories);
  }, [tenantId, role]);
  const [prefs, setPrefs] = useState<ChannelPrefs>({});
  const [loading, setLoading] = useState(true);
  const [pushSupported] = useState(isPushSupported());
  const [pushActive, setPushActive] = useState(false);
  const [pushToggling, setPushToggling] = useState(false);

  const fetchPrefs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notification_preferences")
      .select("category, in_app_enabled, push_enabled, email_enabled")
      .eq("user_id", user.id);

    const map: ChannelPrefs = {};
    ALL_CATEGORIES.forEach((c) => {
      map[c] = { in_app_enabled: true, push_enabled: true, email_enabled: false };
    });
    data?.forEach((p: any) => {
      if (map[p.category]) {
        map[p.category] = {
          in_app_enabled: p.in_app_enabled ?? true,
          push_enabled: p.push_enabled ?? true,
          email_enabled: p.email_enabled ?? false,
        };
      }
    });
    setPrefs(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  useEffect(() => {
    isCurrentlySubscribed().then(setPushActive);
  }, []);

  const toggleChannel = async (category: string, channel: string) => {
    if (!user || !tenantId) return;
    const newValue = !prefs[category]?.[channel];
    setPrefs((prev) => ({
      ...prev,
      [category]: { ...prev[category], [channel]: newValue },
    }));

    const updatePayload: any = {
      user_id: user.id,
      tenant_id: tenantId,
      category,
      [channel]: newValue,
    };

    const { error } = await supabase
      .from("notification_preferences")
      .upsert(updatePayload, { onConflict: "user_id,category" });

    if (error) {
      toast.error(error.message);
      setPrefs((prev) => ({
        ...prev,
        [category]: { ...prev[category], [channel]: !newValue },
      }));
    }
  };

  const handlePushToggle = async (enable: boolean) => {
    if (!user || !tenantId) return;
    setPushToggling(true);
    try {
      if (enable) {
        const ok = await subscribeToPush(user.id, tenantId);
        if (ok) {
          setPushActive(true);
          toast.success(t("pushEnabled"));
        } else {
          toast.error(t("pushNotSupported"));
        }
      } else {
        await unsubscribeFromPush(user.id);
        setPushActive(false);
        toast.success(t("pushDisabled"));
      }
    } finally {
      setPushToggling(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notificationPreferences")}</CardTitle>
        {visibleCategories.length < ALL_CATEGORIES.length && (
          <CardDescription>{t("roleBasedNotificationsInfo")}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global push toggle */}
        {pushSupported && (
          <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/30">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <div>
                <Label className="font-medium">{t("enablePushNotifications")}</Label>
                <p className="text-sm text-muted-foreground">
                  {t("pushNotificationsDescription")}
                </p>
              </div>
            </div>
            <Switch
              checked={pushActive}
              onCheckedChange={handlePushToggle}
              disabled={pushToggling}
            />
          </div>
        )}

        {/* Matrix table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground" />
                {CHANNELS.map((ch) => (
                  <th key={ch} className="text-center py-2 px-3 font-medium text-muted-foreground">
                    {t(channelKeys[ch] as any)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleCategories.map((cat) => (
                <tr key={cat} className="border-b border-border last:border-0">
                  <td className="py-3 pr-4 font-medium">
                    {t(categoryKeys[cat] as any)}
                  </td>
                  {CHANNELS.map((ch) => (
                    <td key={ch} className="text-center py-3 px-3">
                      <Checkbox
                        checked={prefs[cat]?.[ch] ?? false}
                        onCheckedChange={() => toggleChannel(cat, ch)}
                        disabled={ch === "push_enabled" && !pushActive}
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
  );
}
