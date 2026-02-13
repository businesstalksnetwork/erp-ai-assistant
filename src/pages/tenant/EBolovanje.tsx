import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, AlertTriangle, ExternalLink } from "lucide-react";

export default function EBolovanje() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Heart className="h-6 w-6" />
          {t("eBolovanje")}
        </h1>
        <Badge variant="secondary">{t("comingSoon")}</Badge>
      </div>

      <Card>
        <CardContent className="py-8 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="font-medium">{t("eBolovanjeRequired")}</p>
              <p className="text-sm text-muted-foreground">{t("eBolovanjeDescription")}</p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 mt-3">
                <li>{t("eBolovanjeFeature1")}</li>
                <li>{t("eBolovanjeFeature2")}</li>
                <li>{t("eBolovanjeFeature3")}</li>
                <li>{t("eBolovanjeFeature4")}</li>
              </ul>
              <a
                href="https://euprava.gov.rs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
              >
                eUprava portal <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
