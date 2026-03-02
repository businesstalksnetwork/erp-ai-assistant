import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { FileText, Plus, AlertTriangle } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { toast } from "sonner";

export default function BlanketAgreements() {
  const { locale } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const sr = locale === "sr";
  const t = (en: string, srText: string) => sr ? srText : en;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    agreement_number: "",
    supplier_id: "",
    start_date: "",
    end_date: "",
    total_value: 0,
    currency: "RSD",
    notes: "",
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-blanket", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<any[]> => {
      const { data } = await (supabase as any).from("partners").select("id, name").eq("tenant_id", tenantId!).eq("is_supplier", true).order("name");
      return data || [];
    },
  });

  const { data: agreements, isLoading } = useQuery({
    queryKey: ["blanket-agreements", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("blanket_agreements")
        .select("*, partners:supplier_id(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createAgreement = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("blanket_agreements").insert({
        ...form,
        tenant_id: tenantId!,
        consumed_value: 0,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blanket-agreements"] });
      setOpen(false);
      setForm({ agreement_number: "", supplier_id: "", start_date: "", end_date: "", total_value: 0, currency: "RSD", notes: "" });
      toast.success(t("Agreement created", "Ugovor kreiran"));
    },
    onError: () => toast.error(t("Failed to create agreement", "Neuspelo kreiranje ugovora")),
  });

  const activateAgreement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("blanket_agreements").update({ status: "active" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blanket-agreements"] });
      toast.success(t("Agreement activated", "Ugovor aktiviran"));
    },
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "active": return "default";
      case "draft": return "secondary";
      case "expired": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Blanket Agreements", "Okvirni ugovori")}
        description={t("Manage framework agreements with suppliers", "Upravljajte okvirnim ugovorima sa dobavljačima")}
      />

      <div className="flex items-center gap-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />{t("New Agreement", "Novi ugovor")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("New Blanket Agreement", "Novi okvirni ugovor")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("Agreement Number", "Broj ugovora")}</Label>
                <Input value={form.agreement_number} onChange={e => setForm(f => ({ ...f, agreement_number: e.target.value }))} />
              </div>
              <div>
                <Label>{t("Supplier", "Dobavljač")}</Label>
                <Select value={form.supplier_id} onValueChange={v => setForm(f => ({ ...f, supplier_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("Select supplier", "Izaberite dobavljača")} /></SelectTrigger>
                  <SelectContent>
                    {(suppliers || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("Start Date", "Datum početka")}</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <Label>{t("End Date", "Datum završetka")}</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("Total Value", "Ukupna vrednost")}</Label>
                  <Input type="number" value={form.total_value} onChange={e => setForm(f => ({ ...f, total_value: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>{t("Currency", "Valuta")}</Label>
                  <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>{t("Notes", "Napomene")}</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <Button onClick={() => createAgreement.mutate()} disabled={!form.agreement_number || !form.supplier_id} className="w-full">
                {t("Create Agreement", "Kreiraj ugovor")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Agreement #", "Br. ugovora")}</TableHead>
              <TableHead>{t("Supplier", "Dobavljač")}</TableHead>
              <TableHead>{t("Period", "Period")}</TableHead>
              <TableHead className="text-right">{t("Total Value", "Ukupna vrednost")}</TableHead>
              <TableHead>{t("Consumption", "Potrošnja")}</TableHead>
              <TableHead>{t("Status", "Status")}</TableHead>
              <TableHead>{t("Actions", "Akcije")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(agreements || []).map((a: any) => {
              const consumedPct = a.total_value > 0 ? (a.consumed_value / a.total_value) * 100 : 0;
              const isExpiringSoon = a.end_date && new Date(a.end_date) <= new Date(Date.now() + 30 * 86400000);
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.agreement_number}</TableCell>
                  <TableCell>{a.partners?.name || "—"}</TableCell>
                  <TableCell>
                    <span className="text-sm">{a.start_date} → {a.end_date}</span>
                    {isExpiringSoon && a.status === "active" && (
                      <AlertTriangle className="inline ml-2 h-4 w-4 text-yellow-500" />
                    )}
                  </TableCell>
                  <TableCell className="text-right">{fmtNum(a.total_value || 0)} {a.currency}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={consumedPct} className="h-2 w-24" />
                      <span className="text-xs text-muted-foreground">{Math.round(consumedPct)}%</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={statusColor(a.status) as any}>{a.status}</Badge></TableCell>
                  <TableCell>
                    {a.status === "draft" && (
                      <Button variant="outline" size="sm" onClick={() => activateAgreement.mutate(a.id)}>
                        {t("Activate", "Aktiviraj")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {(agreements || []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {t("No agreements yet", "Nema ugovora")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
