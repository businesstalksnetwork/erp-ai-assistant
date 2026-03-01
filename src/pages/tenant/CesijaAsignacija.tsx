import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";

interface CesijaForm {
  original_debtor_id: string;
  new_debtor_id: string;
  amount: string;
  currency: string;
  cesija_date: string;
  notes: string;
}

interface AsignacijaForm {
  original_creditor_id: string;
  new_creditor_id: string;
  amount: string;
  currency: string;
  asignacija_date: string;
  notes: string;
}

const emptyCesija: CesijaForm = { original_debtor_id: "", new_debtor_id: "", amount: "", currency: "RSD", cesija_date: format(new Date(), "yyyy-MM-dd"), notes: "" };
const emptyAsignacija: AsignacijaForm = { original_creditor_id: "", new_creditor_id: "", amount: "", currency: "RSD", asignacija_date: format(new Date(), "yyyy-MM-dd"), notes: "" };

export default function CesijaAsignacija() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [cesijaOpen, setCesijaOpen] = useState(false);
  const [asigOpen, setAsigOpen] = useState(false);
  const [cForm, setCForm] = useState<CesijaForm>(emptyCesija);
  const [aForm, setAForm] = useState<AsignacijaForm>(emptyAsignacija);

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: cesije = [] } = useQuery({
    queryKey: ["cesije", tenantId],
    queryFn: async () => {
      const { data } = await (supabase.from("cesije" as any) as any)
        .select("*, orig:partners!cesije_original_debtor_id_fkey(name), novo:partners!cesije_new_debtor_id_fkey(name)")
        .eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: asignacije = [] } = useQuery({
    queryKey: ["asignacije", tenantId],
    queryFn: async () => {
      const { data } = await (supabase.from("asignacije" as any) as any)
        .select("*, orig:partners!asignacije_original_creditor_id_fkey(name), novo:partners!asignacije_new_creditor_id_fkey(name)")
        .eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const saveCesijaMut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("cesije" as any) as any).insert({
        tenant_id: tenantId, original_debtor_id: cForm.original_debtor_id,
        new_debtor_id: cForm.new_debtor_id, amount: +cForm.amount, currency: cForm.currency,
        cesija_date: cForm.cesija_date, notes: cForm.notes, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cesije"] });
      toast.success("Cesija sačuvana");
      setCesijaOpen(false);
      setCForm(emptyCesija);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveAsigMut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("asignacije" as any) as any).insert({
        tenant_id: tenantId, original_creditor_id: aForm.original_creditor_id,
        new_creditor_id: aForm.new_creditor_id, amount: +aForm.amount, currency: aForm.currency,
        asignacija_date: aForm.asignacija_date, notes: aForm.notes, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asignacije"] });
      toast.success("Asignacija sačuvana");
      setAsigOpen(false);
      setAForm(emptyAsignacija);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const PartnerSelect = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Izaberite..." /></SelectTrigger>
        <SelectContent>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  const statusBadge = (s: string) => (
    <Badge variant={s === "posted" ? "default" : s === "confirmed" ? "secondary" : "outline"}>{s === "draft" ? "Nacrt" : s === "confirmed" ? "Potvrđeno" : "Proknjiženo"}</Badge>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cesija i Asignacija</h1>

      <Tabs defaultValue="cesija">
        <TabsList>
          <TabsTrigger value="cesija">Cesija ({cesije.length})</TabsTrigger>
          <TabsTrigger value="asignacija">Asignacija ({asignacije.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="cesija" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setCForm(emptyCesija); setCesijaOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nova cesija</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Prvobitni dužnik</TableHead>
                    <TableHead>Novi dužnik</TableHead>
                    <TableHead className="text-right">Iznos</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cesije.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.cesija_date}</TableCell>
                      <TableCell>{c.orig?.name || "-"}</TableCell>
                      <TableCell>{c.novo?.name || "-"}</TableCell>
                      <TableCell className="text-right">{Number(c.amount).toLocaleString("sr-RS", { minimumFractionDigits: 2 })} {c.currency}</TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                    </TableRow>
                  ))}
                  {cesije.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nema cesija</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="asignacija" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setAForm(emptyAsignacija); setAsigOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nova asignacija</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Prvobitni poverilac</TableHead>
                    <TableHead>Novi poverilac</TableHead>
                    <TableHead className="text-right">Iznos</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asignacije.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.asignacija_date}</TableCell>
                      <TableCell>{a.orig?.name || "-"}</TableCell>
                      <TableCell>{a.novo?.name || "-"}</TableCell>
                      <TableCell className="text-right">{Number(a.amount).toLocaleString("sr-RS", { minimumFractionDigits: 2 })} {a.currency}</TableCell>
                      <TableCell>{statusBadge(a.status)}</TableCell>
                    </TableRow>
                  ))}
                  {asignacije.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nema asignacija</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cesija Dialog */}
      <Dialog open={cesijaOpen} onOpenChange={setCesijaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova cesija</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <PartnerSelect label="Prvobitni dužnik *" value={cForm.original_debtor_id} onChange={v => setCForm({ ...cForm, original_debtor_id: v })} />
            <PartnerSelect label="Novi dužnik *" value={cForm.new_debtor_id} onChange={v => setCForm({ ...cForm, new_debtor_id: v })} />
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>Iznos *</Label><Input type="number" value={cForm.amount} onChange={e => setCForm({ ...cForm, amount: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>Valuta</Label>
                <Select value={cForm.currency} onValueChange={v => setCForm({ ...cForm, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="RSD">RSD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Datum</Label><Input type="date" value={cForm.cesija_date} onChange={e => setCForm({ ...cForm, cesija_date: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>Napomena</Label><Textarea value={cForm.notes} onChange={e => setCForm({ ...cForm, notes: e.target.value })} /></div>
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              GL knjiženje: DR 2040 (novi dužnik) / CR 2040 (prvobitni dužnik)
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCesijaOpen(false)}>Otkaži</Button>
            <Button onClick={() => saveCesijaMut.mutate()} disabled={!cForm.original_debtor_id || !cForm.new_debtor_id || !cForm.amount || saveCesijaMut.isPending}>
              {saveCesijaMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Sačuvaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Asignacija Dialog */}
      <Dialog open={asigOpen} onOpenChange={setAsigOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova asignacija</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <PartnerSelect label="Prvobitni poverilac *" value={aForm.original_creditor_id} onChange={v => setAForm({ ...aForm, original_creditor_id: v })} />
            <PartnerSelect label="Novi poverilac *" value={aForm.new_creditor_id} onChange={v => setAForm({ ...aForm, new_creditor_id: v })} />
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>Iznos *</Label><Input type="number" value={aForm.amount} onChange={e => setAForm({ ...aForm, amount: e.target.value })} /></div>
              <div className="grid gap-2">
                <Label>Valuta</Label>
                <Select value={aForm.currency} onValueChange={v => setAForm({ ...aForm, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="RSD">RSD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Datum</Label><Input type="date" value={aForm.asignacija_date} onChange={e => setAForm({ ...aForm, asignacija_date: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>Napomena</Label><Textarea value={aForm.notes} onChange={e => setAForm({ ...aForm, notes: e.target.value })} /></div>
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              GL knjiženje: DR 4350 (prvobitni dobavljač) / CR 4350 (novi dobavljač)
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsigOpen(false)}>Otkaži</Button>
            <Button onClick={() => saveAsigMut.mutate()} disabled={!aForm.original_creditor_id || !aForm.new_creditor_id || !aForm.amount || saveAsigMut.isPending}>
              {saveAsigMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Sačuvaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
