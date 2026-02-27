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
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { ExportButton } from "@/components/ExportButton";
import { PrintButton } from "@/components/PrintButton";
import { useToast } from "@/hooks/use-toast";
import { fmtNum } from "@/lib/utils";
import { BookText, Plus } from "lucide-react";

export default function KepKnjiga() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [locationId, setLocationId] = useState<string>("");
  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);

  const [form, setForm] = useState({
    entry_date: today,
    document_type: "receipt",
    document_number: "",
    description: "",
    goods_value: 0,
    services_value: 0,
    payment_type: "cash",
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("locations")
        .select("id, name")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["kep-entries", tenantId, locationId, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("kep_entries" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .gte("entry_date", dateFrom)
        .lte("entry_date", dateTo)
        .order("entry_date")
        .order("entry_number");
      if (locationId) q = q.eq("location_id", locationId);
      const { data } = await q;
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  const totals = entries.reduce(
    (acc, e) => ({
      goods: acc.goods + Number(e.goods_value),
      services: acc.services + Number(e.services_value),
      total: acc.total + Number(e.total_value),
    }),
    { goods: 0, services: 0, total: 0 }
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      // Get next entry number for this date+location
      const { data: maxEntry } = await supabase
        .from("kep_entries" as any)
        .select("entry_number")
        .eq("tenant_id", tenantId!)
        .eq("entry_date", form.entry_date)
        .eq("location_id", locationId || null)
        .order("entry_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextNumber = ((maxEntry as any)?.entry_number || 0) + 1;
      const totalValue = form.goods_value + form.services_value;

      const { error } = await supabase.from("kep_entries" as any).insert([{
        tenant_id: tenantId!,
        location_id: locationId || null,
        entry_date: form.entry_date,
        entry_number: nextNumber,
        document_type: form.document_type,
        document_number: form.document_number,
        description: form.description,
        goods_value: form.goods_value,
        services_value: form.services_value,
        total_value: totalValue,
        payment_type: form.payment_type,
      }] as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kep-entries"] });
      setOpen(false);
      setForm({ entry_date: today, document_type: "receipt", document_number: "", description: "", goods_value: 0, services_value: 0, payment_type: "cash" });
      toast({ title: "Stavka uneta u KEP" });
    },
    onError: (e: Error) => toast({ title: "Greška", description: e.message, variant: "destructive" }),
  });

  const paymentLabels: Record<string, string> = { cash: "Gotovina", card: "Kartica", transfer: "Prenos" };

  return (
    <div className="space-y-6">
      <PageHeader
        title="KEP Knjiga"
        description="Knjiga evidencije prometa (Pravilnik o evidenciji prometa)"
        icon={BookText}
        actions={
          <div className="flex gap-2 print:hidden">
            <ExportButton
              data={entries.map((e: any) => ({
                rb: e.entry_number,
                datum: e.entry_date,
                dokument: e.document_number,
                opis: e.description,
                roba: e.goods_value,
                usluge: e.services_value,
                ukupno: e.total_value,
                placanje: paymentLabels[e.payment_type] || e.payment_type,
              }))}
              columns={[
                { key: "rb", label: "R.b." },
                { key: "datum", label: "Datum" },
                { key: "dokument", label: "Dokument" },
                { key: "opis", label: "Opis" },
                { key: "roba", label: "Roba", formatter: (v) => fmtNum(Number(v)) },
                { key: "usluge", label: "Usluge", formatter: (v) => fmtNum(Number(v)) },
                { key: "ukupno", label: "Ukupno", formatter: (v) => fmtNum(Number(v)) },
                { key: "placanje", label: "Način plaćanja" },
              ]}
              filename="kep_knjiga"
            />
            <PrintButton />
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Nova stavka
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-4 print:hidden">
        <div>
          <Label>Lokacija</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Sve lokacije" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sve lokacije</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Od</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label>Do</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">R.b.</TableHead>
                <TableHead className="w-[100px]">Datum</TableHead>
                <TableHead>Dokument</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead className="text-right">Roba (RSD)</TableHead>
                <TableHead className="text-right">Usluge (RSD)</TableHead>
                <TableHead className="text-right">Ukupno (RSD)</TableHead>
                <TableHead>Plaćanje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("loading")}</TableCell></TableRow>
              ) : entries.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nema stavki za izabrani period</TableCell></TableRow>
              ) : entries.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono">{e.entry_number}</TableCell>
                  <TableCell>{e.entry_date}</TableCell>
                  <TableCell className="text-sm">{e.document_number || "—"}</TableCell>
                  <TableCell>{e.description || "—"}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(Number(e.goods_value))}</TableCell>
                  <TableCell className="text-right font-mono">{fmtNum(Number(e.services_value))}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{fmtNum(Number(e.total_value))}</TableCell>
                  <TableCell>{paymentLabels[e.payment_type] || e.payment_type}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {entries.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-bold">Ukupno:</TableCell>
                  <TableCell className="text-right font-bold font-mono">{fmtNum(totals.goods)}</TableCell>
                  <TableCell className="text-right font-bold font-mono">{fmtNum(totals.services)}</TableCell>
                  <TableCell className="text-right font-bold font-mono">{fmtNum(totals.total)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova KEP stavka</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Datum</Label>
                <Input type="date" value={form.entry_date} onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))} />
              </div>
              <div>
                <Label>Način plaćanja</Label>
                <Select value={form.payment_type} onValueChange={(v) => setForm((f) => ({ ...f, payment_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Gotovina</SelectItem>
                    <SelectItem value="card">Kartica</SelectItem>
                    <SelectItem value="transfer">Prenos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tip dokumenta</Label>
                <Input value={form.document_type} onChange={(e) => setForm((f) => ({ ...f, document_type: e.target.value }))} />
              </div>
              <div>
                <Label>Broj dokumenta</Label>
                <Input value={form.document_number} onChange={(e) => setForm((f) => ({ ...f, document_number: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Opis</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vrednost robe (RSD)</Label>
                <Input type="number" value={form.goods_value} onChange={(e) => setForm((f) => ({ ...f, goods_value: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Vrednost usluga (RSD)</Label>
                <Input type="number" value={form.services_value} onChange={(e) => setForm((f) => ({ ...f, services_value: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="p-3 bg-muted rounded-md text-center">
              <span className="text-sm text-muted-foreground">Ukupno: </span>
              <span className="text-lg font-bold font-mono">{fmtNum(form.goods_value + form.services_value)} RSD</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Otkaži</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || (form.goods_value + form.services_value <= 0)}>
              Sačuvaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
