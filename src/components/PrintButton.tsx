import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface PrintButtonProps {
  variant?: "outline" | "ghost" | "default";
  size?: "default" | "sm" | "icon";
}

export function PrintButton({ variant = "outline", size = "sm" }: PrintButtonProps) {
  const { t } = useLanguage();

  return (
    <Button variant={variant} size={size} onClick={() => window.print()}>
      <Printer className="h-4 w-4 mr-2" />
      {t("printReport")}
    </Button>
  );
}
