import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, CreditCard, Search } from "lucide-react";

export default function GiftCards() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ card_number: "", initial_balance: "", issued_to_name: "", expires_at: "" });

  const { data: giftCards = [] } = useQuery({
    queryKey: ["gift_cards", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("gift_cards").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) return;
      const cardNum = form.card_number || `GC-${Date.now().toString(36).toUpperCase()}`;
      const balance = parseFloat(form.initial_balance) || 0;
      const { data: card, error } = await supabase.from("gift_cards").insert({
        tenant_id: tenantId,
        card_number: cardNum,
        initial_balance: balance,
        current_balance: balance,
        issued_to_name: form.issued_to_name || null,
        expires_at: form.expires_at || null,
      } as any).select().single();
      if (error) throw error;
      // Log initial load
      await supabase.from("gift_card_transactions").insert({
        tenant_id: tenantId,
        gift_card_id: card.id,
        transaction_type: "load",
        amount: balance,
        balance_after: balance,
        created_by: user?.id,
        notes: "Inicijalno punjenje",
      } as any);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["gift_cards"] }); setDialogOpen(false); setForm({ card_number: "", initial_balance: "", issued_to_name: "", expires_at: "" }); toast({ title: t("success") }); },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const totalBalance = giftCards.reduce((s: number, gc: any) => s + Number(gc.current_balance || 0), 0);
  const activeCards = giftCards.filter((gc: any) => gc.status === "active");
  const filtered = giftCards.filter((gc: any) =>
    !search || gc.card_number.toLowerCase().includes(search.toLowerCase()) ||
    gc.issued_to_name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (s: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default", used: "secondary", expired: "destructive", cancelled: "outline",
    };
    return <Badge variant={map[s] || "outline"}>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Poklon kartice</h1>
          <p className="text-sm text-muted-foreground">Izdavanje i upravljanje poklon karticama za POS.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova kartica</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" />Ukupno kartica</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{giftCards.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Aktivne</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">{activeCards.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ukupno stanje</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalBalance.toLocaleString("sr-RS")} RSD</p></CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Pretraži po broju ili imenu..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Broj kartice</TableHead>
            <TableHead>Izdato za</TableHead>
            <TableHead>Početni iznos</TableHead>
            <TableHead>Trenutno stanje</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>Ističe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((gc: any) => (
            <TableRow key={gc.id}>
              <TableCell className="font-mono font-medium">{gc.card_number}</TableCell>
              <TableCell>{gc.issued_to_name || "—"}</TableCell>
              <TableCell>{Number(gc.initial_balance).toLocaleString("sr-RS")} RSD</TableCell>
              <TableCell className="font-bold">{Number(gc.current_balance).toLocaleString("sr-RS")} RSD</TableCell>
              <TableCell>{statusBadge(gc.status)}</TableCell>
              <TableCell className="text-sm">{gc.expires_at ? new Date(gc.expires_at).toLocaleDateString() : "—"}</TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova poklon kartica</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Broj kartice (opciono)</Label><Input value={form.card_number} onChange={e => setForm(f => ({ ...f, card_number: e.target.value }))} placeholder="Auto-generisan ako prazno" /></div>
            <div><Label>Početni iznos (RSD)</Label><Input type="number" value={form.initial_balance} onChange={e => setForm(f => ({ ...f, initial_balance: e.target.value }))} /></div>
            <div><Label>Ime primaoca</Label><Input value={form.issued_to_name} onChange={e => setForm(f => ({ ...f, issued_to_name: e.target.value }))} /></div>
            <div><Label>Datum isteka</Label><Input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={() => createMutation.mutate()} disabled={!form.initial_balance || createMutation.isPending}>Kreiraj</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
