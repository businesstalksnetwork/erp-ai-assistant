import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Lock, Unlock, Trash2 } from "lucide-react";

export default function FiscalPeriods() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "" });

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["fiscal-periods", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("fiscal_periods")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("fiscal_periods").insert({
        tenant_id: tenantId!,
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal-periods"] });
      toast({ title: t("success") });
      setDialogOpen(false);
      setForm({ name: "", start_date: "", end_date: "" });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase.from("fiscal_periods").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal-periods"] });
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fiscal_periods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fiscal-periods"] });
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const statusBadge = (status: string) => {
    const variant = status === "open" ? "default" : status === "closed" ? "secondary" : "destructive";
    const label = status === "open" ? t("open") : status === "closed" ? t("closed") : t("locked");
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (isLoading) return <p>{t("loading")}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("fiscalPeriods")}</h1>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("startDate")}</TableHead>
              <TableHead>{t("endDate")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
            ) : periods.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.start_date}</TableCell>
                <TableCell>{p.end_date}</TableCell>
                <TableCell>{statusBadge(p.status)}</TableCell>
                <TableCell className="text-right space-x-1">
                  {p.status === "open" && (
                    <Button variant="ghost" size="icon" onClick={() => toggleStatus.mutate({ id: p.id, newStatus: "closed" })} title={t("closePeriod")}><Lock className="h-4 w-4" /></Button>
                  )}
                  {p.status === "closed" && (
                    <Button variant="ghost" size="icon" onClick={() => toggleStatus.mutate({ id: p.id, newStatus: "open" })} title={t("reopenPeriod")}><Unlock className="h-4 w-4" /></Button>
                  )}
                  {p.status === "open" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>{t("confirm")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(p.id)}>{t("delete")}</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("add")} — {t("fiscalPeriods")}</DialogTitle></DialogHeader>
          <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
            <div className="space-y-1"><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="2025" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label>{t("startDate")}</Label><Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} required /></div>
              <div className="space-y-1"><Label>{t("endDate")}</Label><Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} required /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={createMutation.isPending}>{t("save")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
