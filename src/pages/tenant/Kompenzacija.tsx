import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { ArrowLeftRight, FileText } from "lucide-react";
import { fmtNum } from "@/lib/utils";

interface OffsetItem {
  id: string;
  document_number: string;
  remaining_amount: number;
  currency: string;
  direction: string;
  selected: boolean;
  offsetAmount: number;
}

export default function Kompenzacija() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [partnerId, setPartnerId] = useState("");
  const [receivables, setReceivables] = useState<OffsetItem[]>([]);
  const [payables, setPayables] = useState<OffsetItem[]>([]);

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-for-kompenzacija", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["kompenzacija-history", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("kompenzacija")
        .select("*, partners(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const loadOpenItems = async (pid: string) => {
    setPartnerId(pid);
    const { data } = await supabase
      .from("open_items")
      .select("*")
      .eq("tenant_id", tenantId!)
      .eq("partner_id", pid)
      .gt("remaining_amount", 0)
      .in("status", ["open", "partial"]);
    
    const items = data || [];
    setReceivables(items.filter(i => i.direction === "receivable").map(i => ({
      id: i.id, document_number: i.document_number || "—",
      remaining_amount: Number(i.remaining_amount), currency: i.currency,
      direction: "receivable", selected: false, offsetAmount: 0,
    })));
    setPayables(items.filter(i => i.direction === "payable").map(i => ({
      id: i.id, document_number: i.document_number || "—",
      remaining_amount: Number(i.remaining_amount), currency: i.currency,
      direction: "payable", selected: false, offsetAmount: 0,
    })));
  };

  const totalReceivableOffset = receivables.filter(r => r.selected).reduce((s, r) => s + r.offsetAmount, 0);
  const totalPayableOffset = payables.filter(p => p.selected).reduce((s, p) => s + p.offsetAmount, 0);
  const isBalanced = totalReceivableOffset > 0 && Math.abs(totalReceivableOffset - totalPayableOffset) < 0.01;

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!isBalanced) throw new Error(t("amountsMustMatch"));
      const offsetAmount = totalReceivableOffset;
      const docNumber = `KOMP-${Date.now().toString(36).toUpperCase()}`;

      // Create journal: Debit AP, Credit AR
      const journalId = await postWithRuleOrFallback({
        tenantId: tenantId!, userId: user?.id || null,
        entryDate: new Date().toISOString().split("T")[0],
        modelCode: "COMPENSATION", amount: offsetAmount,
        description: `Kompenzacija - ${partners.find(p => p.id === partnerId)?.name}`,
        reference: docNumber,
        legalEntityId: undefined,
        context: {},
        fallbackLines: [
          { accountCode: "4350", debit: offsetAmount, credit: 0, description: "Offset AP", sortOrder: 0 },
          { accountCode: "2040", debit: 0, credit: offsetAmount, description: "Offset AR", sortOrder: 1 },
        ],
      });

      // Create kompenzacija record
      const { data: komp, error: kompErr } = await supabase.from("kompenzacija").insert({
        tenant_id: tenantId!, document_number: docNumber,
        document_date: new Date().toISOString().split("T")[0],
        partner_id: partnerId, total_amount: offsetAmount,
        status: "confirmed", journal_entry_id: journalId,
        created_by: user?.id || null,
      }).select("id").single();
      if (kompErr) throw kompErr;

      // Create kompenzacija items
      const selectedItems = [
        ...receivables.filter(r => r.selected).map(r => ({ kompenzacija_id: komp.id, open_item_id: r.id, amount: r.offsetAmount, direction: "receivable" })),
        ...payables.filter(p => p.selected).map(p => ({ kompenzacija_id: komp.id, open_item_id: p.id, amount: p.offsetAmount, direction: "payable" })),
      ];
      const { error: itemsErr } = await supabase.from("kompenzacija_items").insert(selectedItems);
      if (itemsErr) throw itemsErr;

      // Update open items
      for (const item of [...receivables.filter(r => r.selected), ...payables.filter(p => p.selected)]) {
        const newRemaining = item.remaining_amount - item.offsetAmount;
        const newStatus = newRemaining <= 0.01 ? "closed" : "partial";
        await supabase.from("open_items").update({
          remaining_amount: Math.max(0, newRemaining),
          status: newStatus,
        }).eq("id", item.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kompenzacija-history"] });
      qc.invalidateQueries({ queryKey: ["open-items"] });
      toast({ title: t("kompenzacijaConfirmed") });
      setReceivables([]);
      setPayables([]);
      setPartnerId("");
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const downloadIos = async (kompId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-pdf", {
        body: { type: "ios_kompenzacija", tenant_id: tenantId, kompenzacija_id: kompId },
      });
      if (error) throw error;
      // Open HTML in new tab for printing
      const blob = new Blob([typeof data === "string" ? data : JSON.stringify(data)], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    }
  };


  const updateItem = (list: OffsetItem[], setList: (v: OffsetItem[]) => void, idx: number, field: Partial<OffsetItem>) => {
    const updated = [...list];
    updated[idx] = { ...updated[idx], ...field };
    if (field.selected === true && updated[idx].offsetAmount === 0) {
      updated[idx].offsetAmount = updated[idx].remaining_amount;
    }
    setList(updated);
  };

  const statusColor = (s: string) => s === "confirmed" ? "default" as const : s === "cancelled" ? "destructive" as const : "secondary" as const;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("kompenzacija")}</h1>

      <Tabs defaultValue="new">
        <TabsList>
          <TabsTrigger value="new">{t("add")}</TabsTrigger>
          <TabsTrigger value="history">{t("revaluationHistory")}</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex gap-4 items-end">
                <div className="w-72">
                  <Label>{t("selectPartnerForOffset")}</Label>
                  <Select value={partnerId} onValueChange={loadOpenItems}>
                    <SelectTrigger><SelectValue placeholder={t("selectPartner")} /></SelectTrigger>
                    <SelectContent>
                      {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
          </Card>

          {partnerId && (
            <div className="grid grid-cols-2 gap-4">
              {/* Receivables */}
              <Card>
                <CardHeader><CardTitle className="text-lg">{t("receivables")}</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>{t("documentNumber")}</TableHead>
                        <TableHead className="text-right">{t("available")}</TableHead>
                        <TableHead className="text-right">{t("offsetAmount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receivables.map((r, i) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Checkbox checked={r.selected} onCheckedChange={(v) => updateItem(receivables, setReceivables, i, { selected: !!v })} />
                          </TableCell>
                          <TableCell>{r.document_number}</TableCell>
                          <TableCell className="text-right font-mono">{fmtNum(r.remaining_amount)}</TableCell>
                          <TableCell>
                            <Input type="number" min={0} max={r.remaining_amount} step={0.01}
                              value={r.offsetAmount} disabled={!r.selected}
                              onChange={(e) => updateItem(receivables, setReceivables, i, { offsetAmount: Math.min(Number(e.target.value), r.remaining_amount) })}
                              className="h-8 w-28 text-right ml-auto" />
                          </TableCell>
                        </TableRow>
                      ))}
                      {receivables.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                  <p className="text-right font-bold mt-2">{t("total")}: {fmtNum(totalReceivableOffset)}</p>
                </CardContent>
              </Card>

              {/* Payables */}
              <Card>
                <CardHeader><CardTitle className="text-lg">{t("payables")}</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>{t("documentNumber")}</TableHead>
                        <TableHead className="text-right">{t("available")}</TableHead>
                        <TableHead className="text-right">{t("offsetAmount")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payables.map((p, i) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Checkbox checked={p.selected} onCheckedChange={(v) => updateItem(payables, setPayables, i, { selected: !!v })} />
                          </TableCell>
                          <TableCell>{p.document_number}</TableCell>
                          <TableCell className="text-right font-mono">{fmtNum(p.remaining_amount)}</TableCell>
                          <TableCell>
                            <Input type="number" min={0} max={p.remaining_amount} step={0.01}
                              value={p.offsetAmount} disabled={!p.selected}
                              onChange={(e) => updateItem(payables, setPayables, i, { offsetAmount: Math.min(Number(e.target.value), p.remaining_amount) })}
                              className="h-8 w-28 text-right ml-auto" />
                          </TableCell>
                        </TableRow>
                      ))}
                      {payables.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                  <p className="text-right font-bold mt-2">{t("total")}: {fmtNum(totalPayableOffset)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {partnerId && (receivables.length > 0 || payables.length > 0) && (
            <div className="flex items-center justify-between">
              {!isBalanced && totalReceivableOffset > 0 && (
                <p className="text-sm text-destructive">{t("amountsMustMatch")}</p>
              )}
              <div className="ml-auto">
                <Button onClick={() => confirmMutation.mutate()} disabled={!isBalanced || confirmMutation.isPending} size="lg">
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  {t("confirmKompenzacija")}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("documentNumber")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("partner")}</TableHead>
                    <TableHead className="text-right">{t("amount")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.document_number}</TableCell>
                      <TableCell>{h.document_date}</TableCell>
                      <TableCell>{(h.partners as any)?.name || "—"}</TableCell>
                      <TableCell className="text-right font-mono">{fmtNum(Number(h.total_amount))}</TableCell>
                      <TableCell><Badge variant={statusColor(h.status)}>{t(h.status as any) || h.status}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => downloadIos(h.id)} title="IOS">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
