import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, Plus } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const REL_TYPES = ["affiliate", "subsidiary", "parent", "shareholder"] as const;
const TXN_TYPES = ["sale_goods", "purchase_goods", "service_rendered", "service_received", "loan_given", "loan_received", "royalty"] as const;
const METHODS = ["CUP", "RPM", "CPM", "TNMM", "PSM"] as const;

export default function TransferPricing() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: parties = [], isLoading: pLoading } = useQuery({
    queryKey: ["tp-parties", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("transfer_pricing_parties").select("*, partners(name)").eq("tenant_id", tenantId!).order("created_at");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: txns = [], isLoading: tLoading } = useQuery({
    queryKey: ["tp-txns", tenantId, year],
    queryFn: async () => {
      const { data } = await supabase.from("transfer_pricing_transactions").select("*, transfer_pricing_parties(partners(name))").eq("tenant_id", tenantId!).eq("fiscal_year", year).order("created_at");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const [newParty, setNewParty] = useState({ relationship_type: "affiliate", ownership_pct: "", country_code: "" });
  const addParty = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("transfer_pricing_parties").insert({
        tenant_id: tenantId!, relationship_type: newParty.relationship_type,
        ownership_pct: Number(newParty.ownership_pct) || null, country_code: newParty.country_code || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tp-parties"] }); toast({ title: t("relatedPartyAdded") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const [newTxn, setNewTxn] = useState({ party_id: "", transaction_type: "sale_goods", description: "", amount: "", arm_length_amount: "", method: "CUP" });
  const addTxn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("transfer_pricing_transactions").insert({
        tenant_id: tenantId!, party_id: newTxn.party_id, transaction_type: newTxn.transaction_type,
        description: newTxn.description, amount: Number(newTxn.amount) || 0,
        arm_length_amount: Number(newTxn.arm_length_amount) || null, method: newTxn.method, fiscal_year: year,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tp-txns"] }); toast({ title: t("transactionAdded") }); },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const totalAmount = txns.reduce((s, t: any) => s + Number(t.amount), 0);
  const totalArm = txns.reduce((s, t: any) => s + Number(t.arm_length_amount || t.amount), 0);
  const isLoading = pLoading || tLoading;

  return (
    <div className="space-y-6">
      <PageHeader title={t("transferPricing")} icon={Scale} description={t("transferPricingDesc")} />

      <div className="flex gap-4 flex-wrap items-center">
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{[2026, 2025, 2024].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>

        <Dialog>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />{t("relatedParty")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("newRelatedParty")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={newParty.relationship_type} onValueChange={v => setNewParty(p => ({ ...p, relationship_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REL_TYPES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder={t("ownershipPct")} value={newParty.ownership_pct} onChange={e => setNewParty(p => ({ ...p, ownership_pct: e.target.value }))} />
              <Input placeholder={t("countryCode")} value={newParty.country_code} onChange={e => setNewParty(p => ({ ...p, country_code: e.target.value }))} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">{t("cancel")}</Button></DialogClose>
              <Button onClick={() => addParty.mutate()} disabled={addParty.isPending}>{t("save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">{t("relatedParties")}</p><p className="text-2xl font-bold">{parties.length}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">{t("totalTransactions")}</p><p className="text-2xl font-bold">{fmtNum(totalAmount)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">{t("armsLengthValue")}</p><p className="text-2xl font-bold">{fmtNum(totalArm)}</p></CardContent></Card>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("transactions")} ({year})</CardTitle>
            {parties.length > 0 && (
              <Dialog>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{t("newTransaction")}</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t("newTransaction")}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Select value={newTxn.party_id} onValueChange={v => setNewTxn(p => ({ ...p, party_id: v }))}>
                      <SelectTrigger><SelectValue placeholder={t("selectRelatedParty")} /></SelectTrigger>
                      <SelectContent>{parties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.partners?.name || p.relationship_type} ({p.country_code})</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={newTxn.transaction_type} onValueChange={v => setNewTxn(p => ({ ...p, transaction_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TXN_TYPES.map(tt => <SelectItem key={tt} value={tt}>{tt.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input placeholder={t("description")} value={newTxn.description} onChange={e => setNewTxn(p => ({ ...p, description: e.target.value }))} />
                    <Input placeholder={t("amount")} type="number" value={newTxn.amount} onChange={e => setNewTxn(p => ({ ...p, amount: e.target.value }))} />
                    <Input placeholder={t("armsLengthValue")} type="number" value={newTxn.arm_length_amount} onChange={e => setNewTxn(p => ({ ...p, arm_length_amount: e.target.value }))} />
                    <Select value={newTxn.method} onValueChange={v => setNewTxn(p => ({ ...p, method: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="outline">{t("cancel")}</Button></DialogClose>
                    <Button onClick={() => addTxn.mutate()} disabled={addTxn.isPending || !newTxn.party_id}>{t("save")}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("relatedParty")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead>{t("method")}</TableHead>
                  <TableHead className="text-right">{t("amount")}</TableHead>
                  <TableHead className="text-right">{t("armsLengthValue")}</TableHead>
                  <TableHead className="text-right">{t("difference")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txns.map((txn: any) => {
                  const diff = Number(txn.amount) - Number(txn.arm_length_amount || txn.amount);
                  return (
                    <TableRow key={txn.id}>
                      <TableCell>{txn.transfer_pricing_parties?.partners?.name || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{txn.transaction_type.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell>{txn.description || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{txn.method}</Badge></TableCell>
                      <TableCell className="text-right">{fmtNum(Number(txn.amount))}</TableCell>
                      <TableCell className="text-right">{fmtNum(Number(txn.arm_length_amount || txn.amount))}</TableCell>
                      <TableCell className={`text-right ${Math.abs(diff) > 0 ? "text-destructive font-semibold" : ""}`}>{fmtNum(diff)}</TableCell>
                    </TableRow>
                  );
                })}
                {txns.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("noTransactionsForYear")} {year}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
