import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuditLog() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("auditLog")}</h1>
      <Card>
        <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">All actions within your organization will be logged here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
