import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, RefreshCw } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";

export default function OpenItems() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dirFilter, setDirFilter] = useState<"all" | "receivable" | "payable">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "partial" | "closed">("all");
  const [iosPartnerId, setIosPartnerId] = useState<string>("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["open_items", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("open_items").select("*, partners(name, pib)").eq("tenant_id", tenantId!).order("document_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners_for_ios", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("partners").select("id, name, pib").eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data: invoices } = await supabase.from("invoices").select("id, invoice_number, invoice_date, due_date, total, partner_id, currency, status").eq("tenant_id", tenantId!).in("status", ["sent", "overdue", "paid"]);
      const { data: existingItems } = await supabase.from("open_items").select("document_id").eq("tenant_id", tenantId!).eq("document_type", "invoice");
      const existingIds = new Set((existingItems || []).map(e => e.document_id));

      const newInvoiceItems = (invoices || []).filter(inv => !existingIds.has(inv.id)).map(inv => ({
        tenant_id: tenantId!,
        partner_id: inv.partner_id,
        document_type: "invoice" as const,
        document_id: inv.id,
        document_number: inv.invoice_number,
        document_date: inv.invoice_date,
        due_date: inv.due_date,
        currency: inv.currency,
        original_amount: inv.total,
        paid_amount: inv.status === "paid" ? inv.total : 0,
        remaining_amount: inv.status === "paid" ? 0 : inv.total,
        direction: "receivable" as const,
        status: inv.status === "paid" ? "closed" : "open",
        closed_at: inv.status === "paid" ? new Date().toISOString() : null,
      }));

      const { data: supplierInvs } = await supabase.from("supplier_invoices").select("id, invoice_number, invoice_date, due_date, total, supplier_id, currency, status").eq("tenant_id", tenantId!).in("status", ["received", "approved", "paid"]);
      const { data: existingSI } = await supabase.from("open_items").select("document_id").eq("tenant_id", tenantId!).eq("document_type", "supplier_invoice");
      const existingSIIds = new Set((existingSI || []).map(e => e.document_id));

      const newSIItems = (supplierInvs || []).filter(si => !existingSIIds.has(si.id)).map(si => ({
        tenant_id: tenantId!,
        partner_id: si.supplier_id,
        document_type: "supplier_invoice" as const,
        document_id: si.id,
        document_number: si.invoice_number,
        document_date: si.invoice_date,
        due_date: si.due_date,
        currency: si.currency,
        original_amount: si.total,
        paid_amount: si.status === "paid" ? si.total : 0,
        remaining_amount: si.status === "paid" ? 0 : si.total,
        direction: "payable" as const,
        status: si.status === "paid" ? "closed" : "open",
        closed_at: si.status === "paid" ? new Date().toISOString() : null,
      }));

      const allNew = [...newInvoiceItems, ...newSIItems];
      if (allNew.length > 0) {
        const { error } = await supabase.from("open_items").insert(allNew);
        if (error) throw error;
      }
      return allNew.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["open_items"] });
      toast({ title: t("success"), description: `${count} ${t("openItemsSynced")}` });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const filtered = items.filter(item => {
    if (dirFilter !== "all" && item.direction !== dirFilter) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return item.document_number.toLowerCase().includes(s) || (item as any).partners?.name?.toLowerCase().includes(s);
    }
    return true;
  });

  const totalReceivable = items.filter(i => i.direction === "receivable" && i.status !== "closed").reduce((s, i) => s + Number(i.remaining_amount), 0);
  const totalPayable = items.filter(i => i.direction === "payable" && i.status !== "closed").reduce((s, i) => s + Number(i.remaining_amount), 0);
  const iosItems = iosPartnerId ? items.filter(i => i.partner_id === iosPartnerId && i.status !== "closed") : [];

  const statusBadge = (status: string) => {
    if (status === "closed") return <Badge variant="default">{t("closed")}</Badge>;
    if (status === "partial") return <Badge variant="secondary">{t("oiPartial")}</Badge>;
    if (status === "offset") return <Badge variant="outline">{t("oiOffset")}</Badge>;
    return <Badge variant="outline">{t("open")}</Badge>;
  };

  const fmt = (n: number) => n.toLocaleString("sr-RS", { minimumFractionDigits: 2 });

  if (isLoading) return <p className="p-6">{t("loading")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("openItems")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            <RefreshCw className="h-4 w-4 mr-2" />{t("syncOpenItems")}
          </Button>
          <ExportButton
            data={filtered.map(i => ({ ...i, partner_name: (i as any).partners?.name || "—" }))}
            columns={[
              { key: "document_number", label: t("oiDocumentNumber") },
              { key: "partner_name", label: t("partnerName" as any) },
              { key: "document_date", label: t("date") },
              { key: "due_date", label: t("dueDate") },
              { key: "original_amount", label: t("oiOriginalAmount") },
              { key: "paid_amount", label: t("oiPaidAmount") },
              { key: "remaining_amount", label: t("oiRemainingAmount") },
              { key: "direction", label: t("oiDirection") },
              { key: "status", label: t("status") },
            ]}
            filename="open_items"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("totalReceivable")}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{fmt(totalReceivable)} RSD</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("totalPayable")}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{fmt(totalPayable)} RSD</p></CardContent></Card>
      </div>

      <Tabs defaultValue="ledger">
        <TabsList>
          <TabsTrigger value="ledger">{t("openItemsLedger")}</TabsTrigger>
          <TabsTrigger value="ios">{t("iosReport")}</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-4">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={dirFilter} onValueChange={v => setDirFilter(v as any)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("oiAll")}</SelectItem>
                <SelectItem value="receivable">{t("receivable")}</SelectItem>
                <SelectItem value="payable">{t("payable")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("oiAll")}</SelectItem>
                <SelectItem value="open">{t("open")}</SelectItem>
                <SelectItem value="partial">{t("oiPartial")}</SelectItem>
                <SelectItem value="closed">{t("closed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("oiDocumentNumber")}</TableHead>
                  <TableHead>{t("partnerName" as any)}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("dueDate")}</TableHead>
                  <TableHead className="text-right">{t("oiOriginalAmount")}</TableHead>
                  <TableHead className="text-right">{t("oiPaidAmount")}</TableHead>
                  <TableHead className="text-right">{t("oiRemainingAmount")}</TableHead>
                  <TableHead>{t("oiDirection")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                ) : filtered.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.document_number}</TableCell>
                    <TableCell>{(item as any).partners?.name || "—"}</TableCell>
                    <TableCell>{item.document_date}</TableCell>
                    <TableCell>{item.due_date || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(Number(item.original_amount))}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(Number(item.paid_amount))}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmt(Number(item.remaining_amount))}</TableCell>
                    <TableCell><Badge variant={item.direction === "receivable" ? "default" : "destructive"}>{item.direction === "receivable" ? t("receivable") : t("payable")}</Badge></TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="ios" className="space-y-4">
          <div className="flex gap-3 items-center">
            <Select value={iosPartnerId} onValueChange={setIosPartnerId}>
              <SelectTrigger className="w-[300px]"><SelectValue placeholder={t("selectPartner")} /></SelectTrigger>
              <SelectContent>
                {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name} {p.pib ? `(${p.pib})` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            {iosPartnerId && (
              <ExportButton
                data={iosItems.map(i => ({ document_number: i.document_number, document_date: i.document_date, due_date: i.due_date || "", original_amount: i.original_amount, paid_amount: i.paid_amount, remaining_amount: i.remaining_amount, direction: i.direction }))}
                columns={[
                  { key: "document_number", label: t("oiDocumentNumber") },
                  { key: "document_date", label: t("date") },
                  { key: "due_date", label: t("dueDate") },
                  { key: "original_amount", label: t("oiOriginalAmount") },
                  { key: "paid_amount", label: t("oiPaidAmount") },
                  { key: "remaining_amount", label: t("oiRemainingAmount") },
                  { key: "direction", label: t("oiDirection") },
                ]}
                filename={`ios_${partners.find(p => p.id === iosPartnerId)?.name || "partner"}`}
              />
            )}
          </div>

          {iosPartnerId ? (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">{t("iosReport")} — {partners.find(p => p.id === iosPartnerId)?.name}</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("oiDocumentNumber")}</TableHead>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("dueDate")}</TableHead>
                      <TableHead className="text-right">{t("oiOriginalAmount")}</TableHead>
                      <TableHead className="text-right">{t("oiPaidAmount")}</TableHead>
                      <TableHead className="text-right">{t("oiRemainingAmount")}</TableHead>
                      <TableHead>{t("oiDirection")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {iosItems.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                    ) : iosItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.document_number}</TableCell>
                        <TableCell>{item.document_date}</TableCell>
                        <TableCell>{item.due_date || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(item.original_amount))}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(item.paid_amount))}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{fmt(Number(item.remaining_amount))}</TableCell>
                        <TableCell><Badge variant={item.direction === "receivable" ? "default" : "destructive"}>{item.direction === "receivable" ? t("receivable") : t("payable")}</Badge></TableCell>
                      </TableRow>
                    ))}
                    {iosItems.length > 0 && (
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell colSpan={5} className="text-right">{t("totalRemaining")}:</TableCell>
                        <TableCell className="text-right font-mono">{fmt(iosItems.reduce((s, i) => s + Number(i.remaining_amount), 0))}</TableCell>
                        <TableCell />
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">{t("selectPartnerForIOS")}</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
