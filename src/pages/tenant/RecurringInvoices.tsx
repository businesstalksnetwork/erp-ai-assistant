import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Play, Pause, Trash2, PlusCircle, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";

interface TemplateLine {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

const emptyLine = (): TemplateLine => ({ description: "", quantity: 1, unit_price: 0, tax_rate: 20 });

export default function RecurringInvoices() {
  const { tenantId } = useTenant();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    template_name: "", frequency: "monthly",
    next_run_date: format(new Date(), "yyyy-MM-dd"), end_date: "",
    notes: "", auto_post: false, currency: "RSD",
  });
  const [lines, setLines] = useState<TemplateLine[]>([emptyLine()]);

  const FREQ_LABELS: Record<string, string> = {
    weekly: t("weekly"), monthly: t("monthly"), quarterly: t("quarterly"),
    semi_annual: t("semiAnnual"), annual: t("annual"),
  };

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["recurring-invoices", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("recurring_invoices").select("*, partners(name)").eq("tenant_id", tenantId).order("next_run_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const resetForm = () => {
    setForm({
      template_name: "", frequency: "monthly",
      next_run_date: format(new Date(), "yyyy-MM-dd"), end_date: "",
      notes: "", auto_post: false, currency: "RSD",
    });
    setLines([emptyLine()]);
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const validLines = lines.filter(l => l.description.trim());
      const { error } = await supabase.from("recurring_invoices").insert({
        tenant_id: tenantId!, template_name: form.template_name,
        frequency: form.frequency, next_run_date: form.next_run_date,
        end_date: form.end_date || null, notes: form.notes || null,
        auto_post: form.auto_post, currency: form.currency,
        lines: validLines as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("templateCreated") });
      qc.invalidateQueries({ queryKey: ["recurring-invoices"] });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("recurring_invoices").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-invoices"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("templateDeleted") });
      qc.invalidateQueries({ queryKey: ["recurring-invoices"] });
    },
  });

  const updateLine = (idx: number, field: keyof TemplateLine, value: string | number) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const linesSubtotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  const linesTax = lines.reduce((sum, l) => sum + l.quantity * l.unit_price * (l.tax_rate / 100), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("recurringInvoices")} description={t("recurringInvoicesDesc")} />
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setOpen(true); }}><Plus className="h-4 w-4 mr-2" /> {t("newTemplate")}</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("templates")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-60" /> : templates.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noTemplatesCreate")}</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("frequency")}</TableHead>
                  <TableHead>{t("nextDate")}</TableHead>
                  <TableHead>{t("currency")}</TableHead>
                  <TableHead>{t("autoPost")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((tpl: any) => (
                  <TableRow key={tpl.id}>
                    <TableCell className="font-medium">{tpl.template_name}</TableCell>
                    <TableCell>{FREQ_LABELS[tpl.frequency] || tpl.frequency}</TableCell>
                    <TableCell>{tpl.next_run_date}</TableCell>
                    <TableCell>{tpl.currency}</TableCell>
                    <TableCell>{tpl.auto_post ? t("yes") : t("no")}</TableCell>
                    <TableCell>
                      <Badge variant={tpl.is_active ? "default" : "secondary"}>
                        {tpl.is_active ? t("active") : t("paused")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => toggleMut.mutate({ id: tpl.id, is_active: !tpl.is_active })} title={tpl.is_active ? t("pause") : t("activate")}>
                        {tpl.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("deleteTemplate")}</AlertDialogTitle>
                            <AlertDialogDescription>{t("deleteTemplateDesc")}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMut.mutate(tpl.id)}>{t("delete")}</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("newRecurringInvoiceTemplate")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("templateName")}</Label>
              <Input value={form.template_name} onChange={(e) => setForm({ ...form, template_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("frequency")}</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQ_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("currency")}</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RSD">RSD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("nextDate")}</Label><Input type="date" value={form.next_run_date} onChange={(e) => setForm({ ...form, next_run_date: e.target.value })} /></div>
              <div><Label>{t("endDateOptional")}</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>

            {/* Line Items Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">{t("lineItems") || "Stavke"}</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, emptyLine()])}>
                  <PlusCircle className="h-3 w-3 mr-1" /> {t("addLine") || "Dodaj stavku"}
                </Button>
              </div>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">{t("description") || "Opis"}</TableHead>
                      <TableHead className="w-[15%]">{t("quantity") || "Kol."}</TableHead>
                      <TableHead className="w-[20%]">{t("unitPrice") || "Cena"}</TableHead>
                      <TableHead className="w-[15%]">{t("taxRate") || "PDV %"}</TableHead>
                      <TableHead className="w-[10%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell><Input value={line.description} onChange={(e) => updateLine(idx, "description", e.target.value)} placeholder={t("description") || "Opis"} /></TableCell>
                        <TableCell><Input type="number" min={0} value={line.quantity} onChange={(e) => updateLine(idx, "quantity", Number(e.target.value))} /></TableCell>
                        <TableCell><Input type="number" min={0} step="0.01" value={line.unit_price} onChange={(e) => updateLine(idx, "unit_price", Number(e.target.value))} /></TableCell>
                        <TableCell>
                          <Select value={String(line.tax_rate)} onValueChange={(v) => updateLine(idx, "tax_rate", Number(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="20">20%</SelectItem>
                              <SelectItem value="10">10%</SelectItem>
                              <SelectItem value="0">0%</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {lines.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-4 text-sm text-muted-foreground">
                <span>{t("subtotal") || "Osnovica"}: {linesSubtotal.toFixed(2)}</span>
                <span>{t("tax") || "PDV"}: {linesTax.toFixed(2)}</span>
                <span className="font-semibold text-foreground">{t("total") || "Ukupno"}: {(linesSubtotal + linesTax).toFixed(2)}</span>
              </div>
            </div>

            <div><Label>{t("note")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={form.auto_post} onCheckedChange={(v) => setForm({ ...form, auto_post: v })} />
              <Label>{t("automaticPosting")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.template_name || createMut.isPending}>
              {createMut.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
