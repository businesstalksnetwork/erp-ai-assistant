import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Calculator, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function WithholdingTax() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { entities: legalEntities } = useLegalEntities();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    gross_amount: "", tax_rate: "20", income_type: "services",
    country_code: "", treaty_applied: false, treaty_rate: "", notes: "",
  });

  const taxAmount = Number(form.gross_amount || 0) * (Number(form.treaty_applied ? form.treaty_rate || form.tax_rate : form.tax_rate) / 100);
  const netAmount = Number(form.gross_amount || 0) - taxAmount;

  const incomeTypes: Record<string, string> = {
    services: t("services"), royalties: t("royalties"), interest: t("interest"),
    dividends: t("dividends"), capital_gains: t("capitalGains"), other: t("other"),
  };
  const statusLabels: Record<string, string> = {
    draft: t("draft"), calculated: t("calculated"), paid: t("paid"), reported: t("reported"),
  };

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["withholding-tax", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("withholding_tax").select("*, partners(name)").eq("tenant_id", tenantId).order("payment_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const effectiveRate = form.treaty_applied && form.treaty_rate ? Number(form.treaty_rate) : Number(form.tax_rate);
      const gross = Number(form.gross_amount);
      const tax = Math.round(gross * effectiveRate / 100 * 100) / 100;
      const { error } = await supabase.from("withholding_tax").insert({
        tenant_id: tenantId!, gross_amount: gross, tax_rate: Number(form.tax_rate),
        tax_amount: tax, net_amount: gross - tax, income_type: form.income_type,
        country_code: form.country_code || null, treaty_applied: form.treaty_applied,
        treaty_rate: form.treaty_applied && form.treaty_rate ? Number(form.treaty_rate) : null,
        notes: form.notes || null, created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("calculationCreated") });
      qc.invalidateQueries({ queryKey: ["withholding-tax"] });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("withholding_tax").delete().eq("id", id).eq("status", "draft");
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("success") });
      qc.invalidateQueries({ queryKey: ["withholding-tax"] });
    },
  });

  const totalTax = records.reduce((s: number, r: any) => s + Number(r.tax_amount || 0), 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader title={t("withholdingTax")} description={t("withholdingTaxDesc")} />

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {t("totalWithholdingTax")}: <span className="font-semibold">{totalTax.toLocaleString("sr-RS")} RSD</span>
        </p>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> {t("newCalculation")}</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" /> {t("calculations")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">{t("loading")}</p>
          ) : records.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("incomeType")}</TableHead>
                  <TableHead>{t("country")}</TableHead>
                  <TableHead className="text-right">{t("gross")}</TableHead>
                  <TableHead className="text-right">{t("rate")}</TableHead>
                  <TableHead className="text-right">{t("tax")}</TableHead>
                  <TableHead className="text-right">{t("net")}</TableHead>
                  <TableHead>{t("treaty")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.payment_date}</TableCell>
                    <TableCell>{incomeTypes[r.income_type] || r.income_type}</TableCell>
                    <TableCell>{r.country_code || "—"}</TableCell>
                    <TableCell className="text-right">{Number(r.gross_amount).toLocaleString("sr-RS")}</TableCell>
                    <TableCell className="text-right">{r.treaty_applied ? `${r.treaty_rate}%` : `${r.tax_rate}%`}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(r.tax_amount).toLocaleString("sr-RS")}</TableCell>
                    <TableCell className="text-right">{Number(r.net_amount).toLocaleString("sr-RS")}</TableCell>
                    <TableCell>{r.treaty_applied ? <Badge variant="outline">{t("yes")}</Badge> : t("no")}</TableCell>
                    <TableCell><Badge variant="secondary">{statusLabels[r.status] || r.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {r.status === "draft" && (
                        <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(r.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("newWithholdingCalc")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("grossAmountRSD")}</Label><Input type="number" min="0" step="0.01" value={form.gross_amount} onChange={(e) => setForm({ ...form, gross_amount: e.target.value })} /></div>
              <div><Label>{t("statutoryRate")}</Label><Input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("incomeType")}</Label>
                <Select value={form.income_type} onValueChange={(v) => setForm({ ...form, income_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(incomeTypes).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("countryISO")}</Label><Input value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value.toUpperCase() })} maxLength={2} /></div>
            </div>
            {form.gross_amount && (
              <Card className="bg-muted/50">
                <CardContent className="p-3 grid grid-cols-3 text-center">
                  <div><p className="text-xs text-muted-foreground">{t("tax")}</p><p className="font-semibold">{Math.round(taxAmount).toLocaleString("sr-RS")} RSD</p></div>
                  <div><p className="text-xs text-muted-foreground">{t("net")}</p><p className="font-semibold">{Math.round(netAmount).toLocaleString("sr-RS")} RSD</p></div>
                  <div><p className="text-xs text-muted-foreground">{t("effectiveRate")}</p><p className="font-semibold">{form.tax_rate}%</p></div>
                </CardContent>
              </Card>
            )}
            <div><Label>{t("note")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.gross_amount || createMut.isPending}>
              {createMut.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
