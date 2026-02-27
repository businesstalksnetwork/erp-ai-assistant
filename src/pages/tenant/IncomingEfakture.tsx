import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FileText, Check, X, Eye, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function IncomingEfakture() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["sef_invoices", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sef_invoices" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke("sef-accept-reject-invoice", {
        body: { tenant_id: tenantId, invoice_id: id, action: "accept" },
      });
      if (error) throw error;
      // Also update local status
      await supabase
        .from("sef_invoices" as any)
        .update({ status: "accepted", reviewed_at: new Date().toISOString() } as any)
        .eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sef_invoices"] });
      toast({ title: t("success"), description: t("invoiceAccepted" as any) });
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.functions.invoke("sef-accept-reject-invoice", {
        body: { tenant_id: tenantId, invoice_id: id, action: "reject", reason },
      });
      if (error) throw error;
      await supabase
        .from("sef_invoices" as any)
        .update({ status: "rejected", rejection_reason: reason, reviewed_at: new Date().toISOString() } as any)
        .eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sef_invoices"] });
      setRejectDialogOpen(false);
      setRejectReason("");
      toast({ title: t("success"), description: t("invoiceRejected" as any) });
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const filtered = (invoices as any[]).filter((inv: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      inv.supplier_name?.toLowerCase().includes(s) ||
      inv.supplier_pib?.includes(s) ||
      inv.invoice_number?.toLowerCase().includes(s) ||
      inv.sef_invoice_id?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("incomingEfakture" as any)}
        icon={FileText}
        description={t("incomingEfaktureDesc" as any)}
      />

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("incomingEfakture" as any)} ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SEF ID</TableHead>
                  <TableHead>{t("supplier" as any)}</TableHead>
                  <TableHead>PIB</TableHead>
                  <TableHead>{t("invoiceNumber" as any)}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead className="text-right">{t("total")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.sef_invoice_id}</TableCell>
                    <TableCell>{inv.supplier_name || "—"}</TableCell>
                    <TableCell className="font-mono">{inv.supplier_pib || "—"}</TableCell>
                    <TableCell>{inv.invoice_number || "—"}</TableCell>
                    <TableCell>{inv.invoice_date ? format(new Date(inv.invoice_date), "dd.MM.yyyy") : "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(inv.total || 0).toLocaleString("sr-RS", { minimumFractionDigits: 2 })} {inv.currency}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[inv.status] || ""}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setSelectedInvoice(inv)} title={t("view")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {inv.status === "pending" && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => acceptMutation.mutate(inv.id)}
                              disabled={acceptMutation.isPending}
                              title={t("approve")}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => { setSelectedInvoice(inv); setRejectDialogOpen(true); }}
                              title={t("reject" as any)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedInvoice && !rejectDialogOpen} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("incomingEfakture" as any)} — {selectedInvoice?.sef_invoice_id}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">{t("supplier" as any)}:</span> {selectedInvoice.supplier_name}</div>
                <div><span className="text-muted-foreground">PIB:</span> {selectedInvoice.supplier_pib}</div>
                <div><span className="text-muted-foreground">{t("invoiceNumber" as any)}:</span> {selectedInvoice.invoice_number}</div>
                <div><span className="text-muted-foreground">{t("date")}:</span> {selectedInvoice.invoice_date}</div>
                <div><span className="text-muted-foreground">{t("total")}:</span> {Number(selectedInvoice.total).toLocaleString("sr-RS", { minimumFractionDigits: 2 })} {selectedInvoice.currency}</div>
                <div><span className="text-muted-foreground">{t("status")}:</span> <Badge className={statusColors[selectedInvoice.status] || ""}>{selectedInvoice.status}</Badge></div>
              </div>
              {selectedInvoice.rejection_reason && (
                <div className="p-2 bg-destructive/10 rounded text-sm">
                  <strong>{t("rejectionReason" as any)}:</strong> {selectedInvoice.rejection_reason}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reject" as any)} — {selectedInvoice?.sef_invoice_id}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder={t("rejectionReason" as any)}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => selectedInvoice && rejectMutation.mutate({ id: selectedInvoice.id, reason: rejectReason })}
            >
              {t("reject" as any)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
