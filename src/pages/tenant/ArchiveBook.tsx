import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/exportCsv";
import { Plus, Archive, AlertTriangle, Download } from "lucide-react";

const RETENTION_OPTIONS = [
  { value: "trajno", label: "Trajno (Permanent)", years: null },
  { value: "10", label: "10 godina", years: 10 },
  { value: "5", label: "5 godina", years: 5 },
  { value: "3", label: "3 godine", years: 3 },
  { value: "2", label: "2 godine", years: 2 },
];

export default function ArchiveBook() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ content_description: "", year_of_creation: new Date().getFullYear(), quantity: 1, retention_period: "10", notes: "", category_id: "" });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["archive_book", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("archive_book").select("*, document_categories(code, name_sr)")
        .eq("tenant_id", tenantId).order("entry_number", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["document_categories", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("document_categories").select("*").eq("tenant_id", tenantId).order("sort_order");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Stats
  const totalEntries = entries.length;
  const permanentEntries = entries.filter((e: any) => e.retention_period === "trajno").length;
  const transferEligible = entries.filter((e: any) =>
    e.retention_period === "trajno" && !e.transferred_to_archive &&
    (new Date().getFullYear() - e.year_of_creation) > 30
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const year = form.year_of_creation;
      const { data: maxEntry } = await supabase.from("archive_book")
        .select("entry_number").eq("tenant_id", tenantId).eq("year_of_creation", year)
        .order("entry_number", { ascending: false }).limit(1);
      const nextEntry = (maxEntry?.[0]?.entry_number || 0) + 1;
      const retOpt = RETENTION_OPTIONS.find(r => r.value === form.retention_period);

      await supabase.from("archive_book").insert({
        tenant_id: tenantId,
        entry_number: nextEntry,
        year_of_creation: year,
        content_description: form.content_description,
        category_id: form.category_id || null,
        quantity: form.quantity,
        retention_period: form.retention_period,
        retention_years: retOpt?.years || null,
        notes: form.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archive_book"] });
      setOpen(false);
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const markTransferred = async (entry: any) => {
    await supabase.from("archive_book").update({ transferred_to_archive: true, transfer_date: new Date().toISOString().split("T")[0] }).eq("id", entry.id);
    queryClient.invalidateQueries({ queryKey: ["archive_book"] });
    toast({ title: t("success") });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("dmsArchiveBook")}</h1>
          <p className="text-muted-foreground text-sm">{t("dmsArchiveBookDesc")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (entries.length === 0) return;
            exportToCsv(entries, [
              { key: "entry_number", label: "Entry" },
              { key: "year_of_creation", label: "Year" },
              { key: "content_description", label: "Description" },
              { key: "retention_period", label: "Retention" },
            ], "arhivska-knjiga");
          }}><Download className="h-4 w-4 mr-2" />{t("exportCsv")}</Button>
          <Button onClick={() => { setForm({ content_description: "", year_of_creation: new Date().getFullYear(), quantity: 1, retention_period: "10", notes: "", category_id: "" }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />{t("add")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{totalEntries}</div><p className="text-sm text-muted-foreground">{t("dmsTotal")}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{permanentEntries}</div><p className="text-sm text-muted-foreground">{t("dmsPermanent")}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{entries.filter((e: any) => e.retention_period !== "trajno").length}</div><p className="text-sm text-muted-foreground">{t("dmsTimeLimited")}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{entries.filter((e: any) => e.transferred_to_archive).length}</div><p className="text-sm text-muted-foreground">{t("dmsTransferred")}</p></CardContent></Card>
      </div>

      {/* Transfer alert */}
      {transferEligible.length > 0 && (
        <Card className="border-warning">
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="font-medium">{t("dmsTransferAlert")}</p>
              <p className="text-sm text-muted-foreground">{transferEligible.length} {t("dmsTransferAlertDesc")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("entryNumber")}</TableHead>
            <TableHead>{t("dmsYearCreation")}</TableHead>
            <TableHead>{t("description")}</TableHead>
            <TableHead>{t("dmsCategory")}</TableHead>
            <TableHead>{t("quantity")}</TableHead>
            <TableHead>{t("dmsRetentionPeriod")}</TableHead>
            <TableHead>{t("dmsTransferredStatus")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={8}>{t("loading")}</TableCell></TableRow>
          ) : entries.map((entry: any) => (
            <TableRow key={entry.id}>
              <TableCell className="font-mono">{entry.entry_number}</TableCell>
              <TableCell>{entry.year_of_creation}</TableCell>
              <TableCell>{entry.content_description}</TableCell>
              <TableCell>{entry.document_categories ? <Badge variant="outline">{entry.document_categories.code}</Badge> : "-"}</TableCell>
              <TableCell>{entry.quantity}</TableCell>
              <TableCell>
                <Badge variant={entry.retention_period === "trajno" ? "default" : "secondary"}>
                  {RETENTION_OPTIONS.find(r => r.value === entry.retention_period)?.label || entry.retention_period}
                </Badge>
              </TableCell>
              <TableCell>
                {entry.transferred_to_archive ? (
                  <Badge variant="default">{t("dmsTransferred")}</Badge>
                ) : entry.retention_period === "trajno" && (new Date().getFullYear() - entry.year_of_creation) > 30 ? (
                  <Badge variant="destructive">{t("dmsEligible")}</Badge>
                ) : "-"}
              </TableCell>
              <TableCell>
                {entry.retention_period === "trajno" && !entry.transferred_to_archive && (new Date().getFullYear() - entry.year_of_creation) > 30 && (
                  <Button size="sm" variant="outline" onClick={() => markTransferred(entry)}>
                    <Archive className="h-3 w-3 mr-1" />{t("dmsMarkTransferred")}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("dmsNewArchiveEntry")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("description")} *</Label><Textarea value={form.content_description} onChange={e => setForm({ ...form, content_description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("dmsYearCreation")}</Label><Input type="number" value={form.year_of_creation} onChange={e => setForm({ ...form, year_of_creation: parseInt(e.target.value) })} /></div>
              <div><Label>{t("quantity")}</Label><Input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) })} /></div>
            </div>
            <div>
              <Label>{t("dmsCategory")}</Label>
              <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder={t("dmsSelectCategory")} /></SelectTrigger>
                <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name_sr}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("dmsRetentionPeriod")}</Label>
              <Select value={form.retention_period} onValueChange={v => setForm({ ...form, retention_period: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RETENTION_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => createMutation.mutate()} disabled={!form.content_description}>{t("save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
