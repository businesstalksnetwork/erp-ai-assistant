import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

interface Props {
  assetId: string;
  assetCode: string;
}

export function AssetJournalTab({ assetId, assetCode }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["asset-journal-entries", assetId],
    queryFn: async () => {
      // Find journal entries that reference this asset via reference field or description
      const { data } = await supabase
        .from("journal_entries")
        .select("id, entry_number, entry_date, description, reference, status, total_debit")
        .eq("tenant_id", tenantId!)
        .or(`reference.ilike.%${assetCode}%,description.ilike.%${assetCode}%`)
        .order("entry_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId && !!assetCode,
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("sr-Latn-RS", { style: "decimal", minimumFractionDigits: 2 }).format(val || 0);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <BookOpen className="h-5 w-5" /> {t("assetsCrossJournalTitle" as any)}
      </h3>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">{t("assetsCrossJournalEmpty" as any)}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("entryNumber" as any)}</TableHead>
              <TableHead>{t("date" as any)}</TableHead>
              <TableHead>{t("description" as any)}</TableHead>
              <TableHead>{t("reference" as any)}</TableHead>
              <TableHead className="text-right">{t("amount" as any)}</TableHead>
              <TableHead>{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-sm">{e.entry_number}</TableCell>
                <TableCell>{e.entry_date}</TableCell>
                <TableCell>{e.description}</TableCell>
                <TableCell className="font-mono text-sm">{e.reference || "—"}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(e.total_debit)}</TableCell>
                <TableCell><Badge variant={e.status === "posted" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
