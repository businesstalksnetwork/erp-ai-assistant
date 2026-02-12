import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const CATEGORIES = ["invoice", "inventory", "approval", "hr", "accounting"] as const;

const categoryKeys: Record<string, string> = {
  invoice: "invoiceNotifications",
  inventory: "inventoryNotifications",
  approval: "approvalNotifications",
  hr: "hrNotifications",
  accounting: "accountingNotifications",
};

export function NotificationPreferences() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchPrefs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notification_preferences")
      .select("category, enabled")
      .eq("user_id", user.id);

    const map: Record<string, boolean> = {};
    CATEGORIES.forEach((c) => (map[c] = true)); // default all enabled
    data?.forEach((p) => (map[p.category] = p.enabled));
    setPrefs(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const toggle = async (category: string) => {
    if (!user || !tenantId) return;
    const newValue = !prefs[category];
    setPrefs((prev) => ({ ...prev, [category]: newValue }));

    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        { user_id: user.id, tenant_id: tenantId, category, enabled: newValue },
        { onConflict: "user_id,category" }
      );

    if (error) {
      toast.error(error.message);
      setPrefs((prev) => ({ ...prev, [category]: !newValue }));
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notificationPreferences")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {CATEGORIES.map((cat) => (
          <div key={cat} className="flex items-center justify-between">
            <Label htmlFor={`pref-${cat}`}>{t(categoryKeys[cat] as any)}</Label>
            <Switch
              id={`pref-${cat}`}
              checked={prefs[cat] ?? true}
              onCheckedChange={() => toggle(cat)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
