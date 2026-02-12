import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UserManagement() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("userManagement")}</h1>
      <Card>
        <CardHeader><CardTitle>All Platform Users</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">User management across all tenants will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
