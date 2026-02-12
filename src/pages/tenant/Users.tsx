import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function TenantUsers() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("users")}</h1>
        <Button className="gap-2"><Plus className="h-4 w-4" />{t("inviteUser")}</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>{t("rolesPermissions")}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Manage users and their roles within your organization.</p>
        </CardContent>
      </Card>
    </div>
  );
}
