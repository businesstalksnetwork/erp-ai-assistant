import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Zap, ArrowRight } from "lucide-react";
import { format } from "date-fns";

interface PartialPaymentMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankLineId: string;
  bankLineAmount: number;
  direction: string;
  partnerName?: string;
}

interface OpenInvoice {
  id: string;
  invoice_number: string;
  total: number;
  remaining: number;
  due_date: string;
  selected: boolean;
  allocatedAmount: number;
  type: "invoice" | "supplier_invoice";
}

export function PartialPaymentMatchDialog({
  open, onOpenChange, bankLineId, bankLineAmount, direction, partnerName
}: PartialPaymentMatchDialogProps) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [invoices, setInvoices] = useState<OpenInvoice[]>([]);

  const isIncoming = direction === "credit";

  // Fetch open invoices for this partner
  const { isLoading } = useQuery({
    queryKey: ["open-invoices-for-match", tenantId, partnerName, direction],
    queryFn: async () => {
      if (!tenantId) return [];

      let results: OpenInvoice[] = [];

      if (isIncoming) {
        // Incoming payment → match against AR invoices
        let query = supabase
          .from("invoices")
          .select("id, invoice_number, total_amount, amount_paid, due_date, partner_id, partners(name)")
          .eq("tenant_id", tenantId)
          .in("status", ["sent", "partially_paid", "overdue"])
          .order("due_date", { ascending: true });

        const { data } = await query;
        results = (data || []).map((inv: any) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          total: Number(inv.total_amount),
          remaining: Number(inv.total_amount) - Number(inv.amount_paid || 0),
          due_date: inv.due_date,
          selected: false,
          allocatedAmount: 0,
          type: "invoice" as const,
        }));
      } else {
        // Outgoing payment → match against AP supplier invoices
        let query = supabase
          .from("supplier_invoices")
          .select("id, invoice_number, total_amount, amount_paid, due_date, partner_id, partners(name)")
          .eq("tenant_id", tenantId)
          .in("status", ["approved", "partially_paid", "overdue"])
          .order("due_date", { ascending: true });

        const { data } = await query;
        results = (data || []).map((inv: any) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          total: Number(inv.total_amount),
          remaining: Number(inv.total_amount) - Number(inv.amount_paid || 0),
          due_date: inv.due_date,
          selected: false,
          allocatedAmount: 0,
          type: "supplier_invoice" as const,
        }));
      }

      setInvoices(results);
      return results;
    },
    enabled: !!tenantId && open,
  });

  const totalAllocated = invoices.filter(i => i.selected).reduce((s, i) => s + i.allocatedAmount, 0);
  const unallocated = Math.round((Math.abs(bankLineAmount) - totalAllocated) * 100) / 100;

  const autoAllocateFIFO = () => {
    let remaining = Math.abs(bankLineAmount);
    setInvoices(prev => prev.map(inv => {
      if (remaining <= 0) return { ...inv, selected: false, allocatedAmount: 0 };
      const alloc = Math.min(inv.remaining, remaining);
      remaining -= alloc;
      return { ...inv, selected: true, allocatedAmount: Math.round(alloc * 100) / 100 };
    }));
  };

  const toggleInvoice = (idx: number, checked: boolean) => {
    setInvoices(prev => prev.map((inv, i) => {
      if (i !== idx) return inv;
      return { ...inv, selected: checked, allocatedAmount: checked ? Math.min(inv.remaining, Math.max(0, unallocated + inv.allocatedAmount)) : 0 };
    }));
  };

  const updateAllocation = (idx: number, amount: number) => {
    setInvoices(prev => prev.map((inv, i) =>
      i === idx ? { ...inv, allocatedAmount: Math.min(inv.remaining, Math.max(0, amount)) } : inv
    ));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const selected = invoices.filter(i => i.selected && i.allocatedAmount > 0);
      if (selected.length === 0) throw new Error("No invoices selected");

      const inserts = selected.map(inv => ({
        tenant_id: tenantId!,
        bank_statement_line_id: bankLineId,
        invoice_id: inv.type === "invoice" ? inv.id : null,
        supplier_invoice_id: inv.type === "supplier_invoice" ? inv.id : null,
        matched_amount: inv.allocatedAmount,
        match_type: "manual",
        created_by: user?.id || null,
      }));

      const { error } = await supabase.from("bank_statement_line_matches" as any).insert(inserts);
      if (error) throw error;

      // Update bank line match status
      await supabase.from("bank_statement_lines").update({
        match_status: totalAllocated >= Math.abs(bankLineAmount) ? "matched" : "partial",
      }).eq("id", bankLineId);

      // Update invoice payment amounts
      for (const inv of selected) {
        if (inv.type === "invoice") {
          const newPaid = inv.total - inv.remaining + inv.allocatedAmount;
          await supabase.from("invoices").update({
            amount_paid: newPaid,
            status: newPaid >= inv.total ? "paid" : "partially_paid",
          } as any).eq("id", inv.id);
        } else {
          const newPaid = inv.total - inv.remaining + inv.allocatedAmount;
          await supabase.from("supplier_invoices").update({
            amount_paid: newPaid,
            status: newPaid >= inv.total ? "paid" : "partially_paid",
          } as any).eq("id", inv.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_statement_lines"] });
      queryClient.invalidateQueries({ queryKey: ["open-invoices-for-match"] });
      toast({ title: t("matchSaved" as any) || "Uparivanje sačuvano" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t("partialPaymentMatching" as any) || "Parcijalno uparivanje"}</DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{isIncoming ? "Uplata" : "Isplata"}</Badge>
            <span className="font-mono font-bold">{Math.abs(bankLineAmount).toFixed(2)} RSD</span>
            {partnerName && <span>• {partnerName}</span>}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2">
          <div className="flex gap-2 mb-3">
            <Button size="sm" variant="outline" className="gap-1" onClick={autoAllocateFIFO}>
              <Zap className="h-3 w-3" />
              FIFO {t("autoAllocate" as any) || "Automatski"}
            </Button>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">{t("loading")}</p>}

          {invoices.map((inv, idx) => (
            <div key={inv.id} className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${inv.selected ? "bg-accent/50 border-primary/30" : ""}`}>
              <Checkbox
                checked={inv.selected}
                onCheckedChange={(checked) => toggleInvoice(idx, !!checked)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium font-mono">{inv.invoice_number}</p>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>{t("dueDate" as any)}: {format(new Date(inv.due_date), "dd.MM.yyyy")}</span>
                  <span>•</span>
                  <span>{t("remaining" as any) || "Preostalo"}: {inv.remaining.toFixed(2)}</span>
                </div>
              </div>
              <div className="text-right text-sm">
                <p className="font-mono">{inv.total.toFixed(2)}</p>
              </div>
              {inv.selected && (
                <div className="flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    max={inv.remaining}
                    value={inv.allocatedAmount || ""}
                    onChange={(e) => updateAllocation(idx, parseFloat(e.target.value) || 0)}
                    className="w-24 h-8 text-right font-mono"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>{t("allocated" as any) || "Raspoređeno"}:</span>
            <span className="font-mono font-bold">{totalAllocated.toFixed(2)}</span>
          </div>
          {unallocated > 0.01 && (
            <div className="flex justify-between text-warning">
              <span>{t("unallocated" as any) || "Neraspoređeno"}:</span>
              <span className="font-mono">{unallocated.toFixed(2)}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button
            disabled={totalAllocated === 0 || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
