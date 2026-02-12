import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlatformMonitoring() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("platformMonitoring")}</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Active Sessions</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">0</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">API Calls (24h)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">0</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Errors (24h)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">0</div></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>System Events</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No system events logged.</p>
        </CardContent>
      </Card>
    </div>
  );
}
