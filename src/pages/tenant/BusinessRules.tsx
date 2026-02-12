import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function BusinessRules() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("businessRules")}</h1>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />{t("businessRules")}</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">{t("comingSoon")}</p></CardContent>
      </Card>
    </div>
  );
}
