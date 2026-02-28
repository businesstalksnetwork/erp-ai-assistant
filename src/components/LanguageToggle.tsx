import React, { forwardRef } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export const LanguageToggle = forwardRef<HTMLButtonElement>(
  function LanguageToggle(_props, ref) {
    const { locale, setLocale } = useLanguage();

    return (
      <Button
        ref={ref}
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
);
