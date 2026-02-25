import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, RefreshCw, Pencil } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface CurrencyForm {
  code: string;
  name: string;
  symbol: string;
  is_base: boolean;
  is_active: boolean;
}

const emptyForm: CurrencyForm = { code: "", name: "", symbol: "", is_base: false, is_active: true };

export default function Currencies() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CurrencyForm>(emptyForm);
  const [nbsImporting, setNbsImporting] = useState(false);

  const { data: currencies = [], isLoading: currLoading } = useQuery({
    queryKey: ["currencies", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("currencies").select("*").eq("tenant_id", tenantId).order("code");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: rates = [], isLoading: ratesLoading } = useQuery({
    queryKey: ["exchange_rates", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("exchange_rates").select("*").eq("tenant_id", tenantId).order("rate_date", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenantId!,
        code: form.code.toUpperCase(),
        name: form.name,
        symbol: form.symbol || null,
        is_base: form.is_base,
        is_active: form.is_active,
      };
      if (editId) {
        const { error } = await supabase.from("currencies").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("currencies").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["currencies", tenantId] });
      toast({ title: t("success") });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const handleNbsImport = async () => {
    setNbsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("nbs-exchange-rates", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      toast({ title: t("success"), description: `${t("importExchangeRates")}: ${data.imported} (${data.date})` });
    } catch (err: any) {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    } finally {
      setNbsImporting(false);
    }
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({ code: c.code, name: c.name, symbol: c.symbol || "", is_base: c.is_base, is_active: c.is_active });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("currencies")}</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleNbsImport} disabled={nbsImporting}>
            <RefreshCw className={`h-4 w-4 mr-1 ${nbsImporting ? "animate-spin" : ""}`} />{t("importNow")}
          </Button>
          <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />{t("add")}</Button>
        </div>
      </div>
      <Tabs defaultValue="currencies">
        <TabsList>
          <TabsTrigger value="currencies">{t("currencies")}</TabsTrigger>
          <TabsTrigger value="rates">{t("exchangeRates")}</TabsTrigger>
        </TabsList>
        <TabsContent value="currencies">
          <Card>
            <CardHeader><CardTitle>{t("currencies")}</CardTitle></CardHeader>
            <CardContent>
              {currLoading ? <p className="text-muted-foreground">{t("loading")}</p> : currencies.length === 0 ? <p className="text-muted-foreground">{t("noResults")}</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("code")}</TableHead>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("symbol")}</TableHead>
                      <TableHead>{t("baseCurrency")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currencies.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.code}</TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.symbol || "—"}</TableCell>
                        <TableCell>{c.is_base ? <Badge>{t("baseCurrency")}</Badge> : "—"}</TableCell>
                        <TableCell><Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? t("active") : t("inactive")}</Badge></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="rates">
          <Card>
            <CardHeader><CardTitle>{t("exchangeRates")}</CardTitle></CardHeader>
            <CardContent>
              {ratesLoading ? <p className="text-muted-foreground">{t("loading")}</p> : rates.length === 0 ? <p className="text-muted-foreground">{t("noResults")}</p> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("fromCurrency")}</TableHead>
                      <TableHead>{t("toCurrency")}</TableHead>
                      <TableHead>{t("rate")}</TableHead>
                      <TableHead>{t("source")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rates.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.rate_date}</TableCell>
                        <TableCell>{r.from_currency}</TableCell>
                        <TableCell>{r.to_currency}</TableCell>
                        <TableCell>{Number(r.rate).toFixed(4)}</TableCell>
                        <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t("edit") : t("add")} {t("currencies")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("code")}</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="EUR" maxLength={3} />
              </div>
              <div className="grid gap-2">
                <Label>{t("symbol")}</Label>
                <Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} placeholder="€" maxLength={5} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("name")}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Euro" />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("baseCurrency")}</Label>
              <Switch checked={form.is_base} onCheckedChange={(v) => setForm({ ...form, is_base: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("active")}</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.code || !form.name}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
