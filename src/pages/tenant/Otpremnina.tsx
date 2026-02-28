import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { fmtNum } from "@/lib/utils";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { UserMinus, Plus, BookOpen } from "lucide-react";

export default function Otpremnina() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);

  const [form, setForm] = useState({
    employee_id: "",
    reason: "redundancy" as "retirement" | "redundancy" | "other",
    years_of_service: 0,
    calculation_base: 0,
    multiplier: 0.333,
    notes: "",
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, full_name, start_date, hire_date")
        .eq("tenant_id", tenantId!)
        .eq("status", "active")
        .order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["severance-payments", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("severance_payments" as any)
        .select("*, employees(full_name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  const totalAmount = form.calculation_base * form.multiplier * form.years_of_service;

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("severance_payments" as any).insert([{
        tenant_id: tenantId!,
        employee_id: form.employee_id,
        reason: form.reason,
        years_of_service: form.years_of_service,
        calculation_base: form.calculation_base,
        multiplier: form.multiplier,
        total_amount: totalAmount,
        notes: form.notes,
        created_by: user?.id,
      }] as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["severance-payments"] });
      setOpen(false);
      toast({ title: "Otpremnina kreirana" });
    },
    onError: (e: Error) => toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const handleGlPost = async (payment: any) => {
    if (!tenantId || !user) return;
    setPosting(payment.id);
    try {
      const totalAmt = Number(payment.total_amount);
      const journalId = await postWithRuleOrFallback({
        tenantId,
        userId: user.id,
        modelCode: "SEVERANCE_PAYMENT",
        amount: totalAmt,
        entryDate: payment.payment_date || new Date().toISOString().split("T")[0],
        description: `Otpremnina - ${payment.employees?.full_name || "Zaposleni"}`,
        reference: `SEV-${payment.id.slice(0, 8)}`,
        context: {},
        fallbackLines: [
          { accountCode: "5290", debit: totalAmt, credit: 0, description: "Rashod otpremnine", sortOrder: 1 },
          { accountCode: "4500", debit: 0, credit: totalAmt, description: "Obaveza za otpremninu", sortOrder: 2 },
        ],
      });
      await supabase.from("severance_payments" as any).update({ gl_posted: true, journal_entry_id: journalId } as any).eq("id", payment.id);
      qc.invalidateQueries({ queryKey: ["severance-payments"] });
      toast({ title: "GL knjiženje uspešno" });
    } catch (e: any) {
      toast({ title: "Greška", description: e.message, variant: "destructive" });
    } finally {
      setPosting(null);
    }
  };

  const handleEmployeeSelect = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    let years = 0;
    if (emp) {
      const start = emp.hire_date || emp.start_date;
      if (start) {
        years = Math.round((Date.now() - new Date(start).getTime()) / (365.25 * 86400000) * 10) / 10;
      }
    }
    setForm((f) => ({ ...f, employee_id: empId, years_of_service: years }));
  };

  const reasonLabels: Record<string, string> = {
    retirement: "Odlazak u penziju",
    redundancy: "Tehnološki višak",
    other: "Ostalo",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Otpremnina"
        description="Obračun otpremnina prema Zakonu o radu čl. 158"
        icon={UserMinus}
        actions={
          <Button onClick={() => setOpen(true)} className="print:hidden">
            <Plus className="h-4 w-4 mr-2" />Nova otpremnina
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zaposleni</TableHead>
                <TableHead>Razlog</TableHead>
                <TableHead className="text-right">God. staža</TableHead>
                <TableHead className="text-right">Osnov</TableHead>
                <TableHead className="text-right">Koef.</TableHead>
                <TableHead className="text-right">Iznos (RSD)</TableHead>
                <TableHead>GL</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("loading")}</TableCell></TableRow>
              ) : payments.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nema otpremnina</TableCell></TableRow>
              ) : payments.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.employees?.full_name}</TableCell>
                  <TableCell>{reasonLabels[p.reason] || p.reason}</TableCell>
                  <TableCell className="text-right">{Number(p.years_of_service).toFixed(1)}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(Number(p.calculation_base))}</TableCell>
                  <TableCell className="text-right">{Number(p.multiplier).toFixed(3)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{fmtNum(Number(p.total_amount))}</TableCell>
                  <TableCell>
                    {p.gl_posted ? (
                      <Badge variant="default">Proknjiženo</Badge>
                    ) : (
                      <Badge variant="outline">Čeka</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!p.gl_posted && (
                      <Button size="sm" variant="outline" onClick={() => handleGlPost(p)} disabled={posting === p.id}>
                        <BookOpen className="h-3 w-3 mr-1" />Proknjiži
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova otpremnina</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Zaposleni</Label>
              <Select value={form.employee_id} onValueChange={handleEmployeeSelect}>
                <SelectTrigger><SelectValue placeholder="Izaberite zaposlenog" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Razlog</Label>
              <Select value={form.reason} onValueChange={(v) => setForm((f) => ({ ...f, reason: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="retirement">Odlazak u penziju</SelectItem>
                  <SelectItem value="redundancy">Tehnološki višak</SelectItem>
                  <SelectItem value="other">Ostalo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Godine staža</Label>
                <Input type="number" step="0.1" value={form.years_of_service} onChange={(e) => setForm((f) => ({ ...f, years_of_service: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Osnov (prosečna zarada)</Label>
                <Input type="number" value={form.calculation_base} onChange={(e) => setForm((f) => ({ ...f, calculation_base: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Koeficijent</Label>
                <Input type="number" step="0.001" value={form.multiplier} onChange={(e) => setForm((f) => ({ ...f, multiplier: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="p-3 bg-muted rounded-md text-center">
              <span className="text-sm text-muted-foreground">Ukupan iznos: </span>
              <span className="text-lg font-bold font-mono">{fmtNum(totalAmount)} RSD</span>
            </div>
            <div>
              <Label>Napomena</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Otkaži</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.employee_id || totalAmount <= 0 || createMutation.isPending}>
              Sačuvaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
