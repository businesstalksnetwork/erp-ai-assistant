import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function IntegrationSupport() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("integrationSupport")}</h1>
      <Card>
        <CardHeader><CardTitle>Global Integrations</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Manage platform-level API endpoints and help tenants configure their integrations.</p>
        </CardContent>
      </Card>
    </div>
  );
}
