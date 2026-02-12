import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export function LanguageToggle() {
  const { locale, setLocale } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(locale === "en" ? "sr" : "en")}
      className="gap-1.5"
    >
      <Globe className="h-4 w-4" />
      {locale === "en" ? "SR" : "EN"}
    </Button>
  );
}
