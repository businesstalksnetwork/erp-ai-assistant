import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReceiptReprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptReprintDialog({ open, onOpenChange }: ReceiptReprintDialogProps) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTx, setSelectedTx] = useState<any>(null);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["pos_reprint_search", tenantId, searchQuery],
    queryFn: async () => {
      if (!tenantId || !searchQuery.trim()) return [];
      let query = supabase
        .from("pos_transactions")
        .select("id, transaction_number, fiscal_receipt_number, total, items, created_at, payment_method, receipt_type, customer_name")
        .eq("tenant_id", tenantId)
        .in("status", ["fiscalized", "completed"])
        .order("created_at", { ascending: false })
        .limit(20);

      const numVal = parseFloat(searchQuery);
      if (!isNaN(numVal) && searchQuery.match(/^\d+(\.\d+)?$/)) {
        query = query.eq("total", numVal);
      } else {
        query = query.or(`transaction_number.ilike.%${searchQuery}%,fiscal_receipt_number.ilike.%${searchQuery}%`);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!tenantId && !!searchQuery.trim() && open,
  });

  const handleReprint = (tx: any) => {
    setSelectedTx(tx);
    const items = (tx.items as any[]) || [];
    const receiptContent = `
================================
        KOPIJA RAČUNA
================================
Br: ${tx.transaction_number}
${tx.fiscal_receipt_number ? `PFR: ${tx.fiscal_receipt_number}` : ""}
Datum: ${new Date(tx.created_at).toLocaleString("sr-Latn-RS")}
${tx.customer_name ? `Kupac: ${tx.customer_name}` : ""}
--------------------------------
${items.map((i: any) => `${i.name}\n  ${i.quantity} x ${Number(i.unit_price).toFixed(2)} = ${(i.quantity * Number(i.unit_price)).toFixed(2)}`).join("\n")}
--------------------------------
UKUPNO: ${Number(tx.total).toFixed(2)} RSD
Plaćanje: ${tx.payment_method}
Tip: ${tx.receipt_type === "refund" ? "POVRAĆAJ" : "PRODAJA"}
================================
      * KOPIJA RAČUNA *
================================
    `.trim();

    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>KOPIJA - ${tx.transaction_number}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; padding: 20px; max-width: 300px; margin: 0 auto; }
          pre { white-space: pre-wrap; word-wrap: break-word; }
          @media print { body { padding: 0; } }
        </style></head>
        <body><pre>${receiptContent}</pre>
        <script>window.onload = function() { window.print(); }</script>
        </body></html>
      `);
      printWindow.document.close();
    }

    toast({ title: t("receiptReprintSuccess") || "Račun štampan (kopija)" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("receiptReprint") || "Pretraga i reprint računa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t("searchByNumberOrAmount") || "Broj računa ili iznos..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
            {!isLoading && searchQuery && transactions.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("noResults") || "Nema rezultata"}</p>
            )}
            {transactions.map((tx: any) => (
              <Card key={tx.id} className="hover:bg-accent transition-colors">
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-medium truncate">{tx.transaction_number}</p>
                    {tx.fiscal_receipt_number && (
                      <p className="text-xs text-muted-foreground">PFR: {tx.fiscal_receipt_number}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString("sr-Latn-RS")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{Number(tx.total).toFixed(2)}</p>
                    <div className="flex gap-1">
                      <Badge variant="outline" className="text-xs">{tx.payment_method}</Badge>
                      {tx.receipt_type === "refund" && (
                        <Badge variant="destructive" className="text-xs">REF</Badge>
                      )}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => handleReprint(tx)}>
                    <Printer className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
