import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { addMonths, format } from "date-fns";

interface LoanForm {
  type: string;
  description: string;
  principal: number;
  interest_rate: number;
  term_months: number;
  start_date: string;
  currency: string;
  status: string;
}

const emptyForm: LoanForm = {
  type: "receivable",
  description: "",
  principal: 0,
  interest_rate: 0,
  term_months: 12,
  start_date: new Date().toISOString().split("T")[0],
  currency: "RSD",
  status: "active",
};

function calcSchedule(principal: number, annualRate: number, termMonths: number, startDate: string) {
  const monthlyRate = annualRate / 100 / 12;
  const payment = monthlyRate > 0
    ? (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths))
    : principal / termMonths;
  const rows = [];
  let balance = principal;
  for (let i = 1; i <= termMonths; i++) {
    const interest = balance * monthlyRate;
    const principalPmt = payment - interest;
    balance = Math.max(balance - principalPmt, 0);
    rows.push({
      period: i,
      date: format(addMonths(new Date(startDate), i), "yyyy-MM-dd"),
      principal: principalPmt,
      interest,
      payment,
      balance,
    });
  }
  return rows;
}

export default function Loans() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<LoanForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["loans", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("loans").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const payload = { ...form, tenant_id: tenantId };
      if (editId) {
        const { error } = await supabase.from("loans").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("loans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans", tenantId] });
      toast({ title: t("loanSaved") });
      setDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans", tenantId] });
      toast({ title: t("loanDeleted") });
      setDeleteId(null);
    },
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (l: any) => {
    setEditId(l.id);
    setForm({ type: l.type, description: l.description || "", principal: Number(l.principal), interest_rate: Number(l.interest_rate), term_months: l.term_months, start_date: l.start_date, currency: l.currency, status: l.status });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("loans")}</h1>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />{t("addLoan")}</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>{t("loans")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">{t("loading")}</p>
          ) : loans.length === 0 ? (
            <p className="text-muted-foreground">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead>{t("principal")}</TableHead>
                  <TableHead>{t("interestRate")}</TableHead>
                  <TableHead>{t("termMonths")}</TableHead>
                  <TableHead>{t("startDate")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((l: any) => (
                  <Collapsible key={l.id} open={expandedId === l.id} onOpenChange={(o) => setExpandedId(o ? l.id : null)} asChild>
                    <>
                      <TableRow>
                        <TableCell>{l.type === "receivable" ? t("receivable") : t("payable")}</TableCell>
                        <TableCell>{l.description || "—"}</TableCell>
                        <TableCell>{Number(l.principal).toLocaleString()} {l.currency}</TableCell>
                        <TableCell>{l.interest_rate}%</TableCell>
                        <TableCell>{l.term_months}</TableCell>
                        <TableCell>{l.start_date}</TableCell>
                        <TableCell><Badge variant={l.status === "active" ? "default" : "secondary"}>{t(l.status)}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon"><ChevronDown className="h-4 w-4" /></Button>
                            </CollapsibleTrigger>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(l.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={8} className="p-4 bg-muted/30">
                            <p className="font-medium mb-2">{t("paymentSchedule")}</p>
                            <div className="max-h-64 overflow-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>{t("date")}</TableHead>
                                    <TableHead>{t("principalPayment")}</TableHead>
                                    <TableHead>{t("interestPayment")}</TableHead>
                                    <TableHead>{t("monthlyPayment")}</TableHead>
                                    <TableHead>{t("remainingBalance")}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {calcSchedule(Number(l.principal), Number(l.interest_rate), l.term_months, l.start_date).map((r) => (
                                    <TableRow key={r.period}>
                                      <TableCell>{r.period}</TableCell>
                                      <TableCell>{r.date}</TableCell>
                                      <TableCell>{r.principal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                      <TableCell>{r.interest.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                      <TableCell>{r.payment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                      <TableCell>{r.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t("editLoan") : t("addLoan")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("loanType")}</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receivable">{t("receivable")}</SelectItem>
                  <SelectItem value="payable">{t("payable")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("description")}</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("principal")}</Label>
                <Input type="number" value={form.principal} onChange={(e) => setForm({ ...form, principal: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("interestRate")} (%)</Label>
                <Input type="number" step="0.01" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("termMonths")}</Label>
                <Input type="number" value={form.term_months} onChange={(e) => setForm({ ...form, term_months: Number(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("startDate")}</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("currency")}</Label>
                <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>{t("status")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("active")}</SelectItem>
                    <SelectItem value="completed">{t("completed")}</SelectItem>
                    <SelectItem value="defaulted">{t("defaulted")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmation")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
