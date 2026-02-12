import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCsv, type CsvColumn } from "@/lib/exportCsv";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

interface ExportButtonProps<T extends Record<string, any>> {
  data: T[];
  columns: CsvColumn<T>[];
  filename: string;
  variant?: "outline" | "ghost" | "default";
  size?: "default" | "sm" | "icon";
}

export function ExportButton<T extends Record<string, any>>({
  data,
  columns,
  filename,
  variant = "outline",
  size = "sm",
}: ExportButtonProps<T>) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const handleExport = () => {
    if (data.length === 0) {
      toast({ title: t("noDataToExport"), variant: "destructive" });
      return;
    }
    exportToCsv(data, columns, filename);
    toast({ title: t("exportSuccess") });
  };

  return (
    <Button variant={variant} size={size} onClick={handleExport}>
      <Download className="h-4 w-4 mr-2" />
      {t("exportCsv")}
    </Button>
  );
}
