import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { ResponsiveTable, ResponsiveColumn } from "@/components/shared/ResponsiveTable";
import { fmtNum } from "@/lib/utils";

interface AopForm {
  aop_number: string;
  name_sr: string;
  name_en: string;
  account_from: string;
  account_to: string;
  formula: string;
  parent_aop: string;
  sort_order: number;
  is_total_row: boolean;
  sign_convention: string;
}

const EMPTY_FORM: AopForm = {
  aop_number: "", name_sr: "", name_en: "", account_from: "", account_to: "",
  formula: "", parent_aop: "", sort_order: 0, is_total_row: false, sign_convention: "normal",
};

export default function AopPositions() {
  const { t, locale } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const sr = locale === "sr";
  const [tab, setTab] = useState("bilans_stanja");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AopForm>(EMPTY_FORM);

  // Preview state
  const [previewYear, setPreviewYear] = useState(new Date().getFullYear());
  const [showPreview, setShowPreview] = useState(false);

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["aop-positions", tenantId, tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aop_positions")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("report_type", tab)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  const { data: previewData = [] } = useQuery({
    queryKey: ["aop-preview", tenantId, tab, previewYear],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_aop_report", {
        p_tenant_id: tenantId!,
        p_report_type: tab,
        p_to_date: `${previewYear}-12-31`,
      });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!tenantId && showPreview,
  });

  const saveMutation = useMutation({
    mutationFn: async (f: AopForm) => {
      const payload = {
        tenant_id: tenantId!,
        report_type: tab,
        aop_number: f.aop_number,
        name_sr: f.name_sr,
        name_en: f.name_en || null,
        account_from: f.account_from || null,
        account_to: f.account_to || null,
        formula: f.formula || null,
        parent_aop: f.parent_aop || null,
        sort_order: f.sort_order,
        is_total_row: f.is_total_row,
        sign_convention: f.sign_convention,
      };
      if (editId) {
        const { error } = await supabase.from("aop_positions").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("aop_positions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aop-positions"] });
      qc.invalidateQueries({ queryKey: ["aop-preview"] });
      setOpen(false);
      toast({ title: t("success") });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("aop_positions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["aop-positions"] }); toast({ title: t("success") }); },
  });

  const openCreate = () => { setEditId(null); setForm({ ...EMPTY_FORM, sort_order: positions.length * 10 }); setOpen(true); };
  const openEdit = (r: any) => {
    setEditId(r.id);
    setForm({
      aop_number: r.aop_number, name_sr: r.name_sr, name_en: r.name_en || "",
      account_from: r.account_from || "", account_to: r.account_to || "",
      formula: r.formula || "", parent_aop: r.parent_aop || "",
      sort_order: r.sort_order, is_total_row: r.is_total_row, sign_convention: r.sign_convention,
    });
    setOpen(true);
  };

  const columns: ResponsiveColumn<any>[] = [
    { key: "aop", label: "AOP", render: (r) => <span className="font-mono font-medium">{r.aop_number}</span> },
    { key: "name", label: sr ? "Naziv" : "Name", primary: true, render: (r) => (
      <div>
        <span className={r.is_total_row ? "font-bold" : ""}>{r.name_sr}</span>
        {r.name_en && <span className="text-xs text-muted-foreground ml-2">({r.name_en})</span>}
      </div>
    )},
    { key: "range", label: sr ? "Konta" : "Accounts", render: (r) => r.account_from ? `${r.account_from}–${r.account_to}` : (r.formula ? "formula" : "–") },
    { key: "sort", label: "#", render: (r) => r.sort_order },
    { key: "total", label: sr ? "Zbir" : "Total", render: (r) => r.is_total_row ? <Badge variant="secondary">{sr ? "Zbir" : "Total"}</Badge> : null },
    { key: "actions", label: "", render: (r) => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>{t("edit")}</Button>
        <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-3 w-3" /></Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={sr ? "APR AOP pozicije" : "APR AOP Positions"}
        description={sr ? "Definicije AOP pozicija za bilans stanja i bilans uspeha prema APR obrascima" : "AOP position definitions for Balance Sheet and Income Statement per APR forms"}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="bilans_stanja">{sr ? "Bilans stanja" : "Balance Sheet"}</TabsTrigger>
            <TabsTrigger value="bilans_uspeha">{sr ? "Bilans uspeha" : "Income Statement"}</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? (sr ? "Sakrij pregled" : "Hide Preview") : (sr ? "Pregled" : "Preview")}
            </Button>
            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />{t("add")}</Button>
          </div>
        </div>

        <TabsContent value={tab}>
          {showPreview ? (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-4 mb-4">
                  <Label>{t("year")}</Label>
                  <Input type="number" className="w-24" value={previewYear} onChange={e => setPreviewYear(+e.target.value)} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 w-20">AOP</th>
                        <th className="text-left p-2">{sr ? "Naziv" : "Name"}</th>
                        <th className="text-right p-2 w-32">{sr ? "Tekuća godina" : "Current Year"}</th>
                        <th className="text-right p-2 w-32">{sr ? "Prethodna godina" : "Prior Year"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((r: any, i: number) => (
                        <tr key={i} className={`border-b ${r.is_total_row ? "font-bold bg-muted/50" : ""}`}>
                          <td className="p-2 font-mono">{r.aop_number}</td>
                          <td className="p-2">{r.name_sr}</td>
                          <td className="p-2 text-right font-mono">{fmtNum(Number(r.current_year))}</td>
                          <td className="p-2 text-right font-mono">{fmtNum(Number(r.prior_year))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <ResponsiveTable data={positions} columns={columns} keyExtractor={(r) => r.id} onRowClick={openEdit} />
              )}
            </CardContent></Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} AOP</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>AOP *</Label><Input value={form.aop_number} onChange={e => setForm({ ...form, aop_number: e.target.value })} placeholder="0001" /></div>
              <div className="grid gap-2"><Label>{sr ? "R.br." : "Sort"}</Label><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: +e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>{sr ? "Naziv (SR)" : "Name (SR)"} *</Label><Input value={form.name_sr} onChange={e => setForm({ ...form, name_sr: e.target.value })} /></div>
            <div className="grid gap-2"><Label>{sr ? "Naziv (EN)" : "Name (EN)"}</Label><Input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{sr ? "Konto od" : "Account From"}</Label><Input value={form.account_from} onChange={e => setForm({ ...form, account_from: e.target.value })} placeholder="0000" /></div>
              <div className="grid gap-2"><Label>{sr ? "Konto do" : "Account To"}</Label><Input value={form.account_to} onChange={e => setForm({ ...form, account_to: e.target.value })} placeholder="0099" /></div>
            </div>
            <div className="grid gap-2"><Label>{sr ? "Formula" : "Formula"}</Label><Input value={form.formula} onChange={e => setForm({ ...form, formula: e.target.value })} placeholder="AOP001 + AOP002" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{sr ? "Nadređeni AOP" : "Parent AOP"}</Label><Input value={form.parent_aop} onChange={e => setForm({ ...form, parent_aop: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>{sr ? "Predznak" : "Sign"}</Label>
                <Select value={form.sign_convention} onValueChange={v => setForm({ ...form, sign_convention: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">{sr ? "Normalan" : "Normal"}</SelectItem>
                    <SelectItem value="reversed">{sr ? "Obrnut" : "Reversed"}</SelectItem>
                    <SelectItem value="absolute">{sr ? "Apsolutni" : "Absolute"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_total_row} onCheckedChange={v => setForm({ ...form, is_total_row: v })} />
              <Label>{sr ? "Zbir red" : "Total Row"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.aop_number || !form.name_sr || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
