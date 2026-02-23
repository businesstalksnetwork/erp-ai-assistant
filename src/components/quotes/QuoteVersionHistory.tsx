import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
}

export function QuoteVersionHistory({ open, onOpenChange, quoteId }: Props) {
  const { t } = useLanguage();

  const { data: versions = [] } = useQuery({
    queryKey: ["quote-versions", quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quote_versions" as any)
        .select("*")
        .eq("quote_id", quoteId)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!quoteId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{t("versionHistory")}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("noResults")}</p>
          ) : (
            <div className="space-y-4">
              {versions.map((v: any) => {
                const snapshot = v.snapshot || {};
                const quote = snapshot.quote || {};
                const lines = snapshot.lines || [];
                return (
                  <div key={v.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">v{v.version_number}</Badge>
                        <span className="text-sm font-medium">{quote.quote_number || "—"}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleString("sr-RS", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    {v.notes && <p className="text-sm text-muted-foreground">{v.notes}</p>}
                    <div className="text-xs space-y-1">
                      <div>{t("status")}: <Badge variant="outline" className="text-xs">{quote.status || "—"}</Badge></div>
                      <div>{t("total")}: <strong>{quote.total ?? 0}</strong> {quote.currency || "RSD"}</div>
                    </div>
                    {lines.length > 0 && (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("product")}</TableHead>
                              <TableHead className="text-right">{t("quantity")}</TableHead>
                              <TableHead className="text-right">{t("unitPrice")}</TableHead>
                              <TableHead className="text-right">{t("total")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lines.map((l: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="text-sm">{l.description || l.product_name || "—"}</TableCell>
                                <TableCell className="text-right text-sm">{l.quantity}</TableCell>
                                <TableCell className="text-right text-sm">{l.unit_price}</TableCell>
                                <TableCell className="text-right text-sm">{l.line_total ?? (l.quantity * l.unit_price)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
