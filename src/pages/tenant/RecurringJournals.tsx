import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
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
import { toast } from "sonner";
import { Plus, Play, Pause, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const FREQ_LABELS: Record<string, string> = {
  weekly: "Nedeljno",
  monthly: "Mesečno",
  quarterly: "Kvartalno",
  semi_annual: "Polugodišnje",
  annual: "Godišnje",
};

export default function RecurringJournals() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    template_name: "",
    description: "",
    frequency: "monthly",
    next_run_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    auto_post: false,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["recurring-journals", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("recurring_journals")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("next_run_date");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("recurring_journals").insert({
        tenant_id: tenantId!,
        template_name: form.template_name,
        description: form.description || null,
        frequency: form.frequency,
        next_run_date: form.next_run_date,
        end_date: form.end_date || null,
        auto_post: form.auto_post,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Šablon kreiran");
      qc.invalidateQueries({ queryKey: ["recurring-journals"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("recurring_journals").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-journals"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_journals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Šablon obrisan");
      qc.invalidateQueries({ queryKey: ["recurring-journals"] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ponavljajuća knjiženja"
        description="Automatsko generisanje periodičnih temeljnica (mesečna razgraničenja, obračun troškova)"
      />

      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novi šablon
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Šabloni</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-60" />
          ) : templates.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nema šablona.</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naziv</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead>Frekvencija</TableHead>
                  <TableHead>Sledeće</TableHead>
                  <TableHead>Auto-post</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.template_name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">{t.description || "—"}</TableCell>
                    <TableCell>{FREQ_LABELS[t.frequency] || t.frequency}</TableCell>
                    <TableCell>{t.next_run_date}</TableCell>
                    <TableCell>{t.auto_post ? "Da" : "Ne"}</TableCell>
                    <TableCell>
                      <Badge variant={t.is_active ? "default" : "secondary"}>
                        {t.is_active ? "Aktivan" : "Pauziran"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => toggleMut.mutate({ id: t.id, is_active: !t.is_active })}>
                        {t.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(t.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novi šablon ponavljajućeg knjiženja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Naziv šablona</Label>
              <Input value={form.template_name} onChange={(e) => setForm({ ...form, template_name: e.target.value })} placeholder="npr. Mesečno razgraničenje" />
            </div>
            <div>
              <Label>Opis</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Frekvencija</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQ_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sledeći datum</Label>
                <Input type="date" value={form.next_run_date} onChange={(e) => setForm({ ...form, next_run_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Krajnji datum (opciono)</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.auto_post} onCheckedChange={(v) => setForm({ ...form, auto_post: v })} />
              <Label>Automatsko knjiženje</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Otkaži</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.template_name || createMut.isPending}>
              {createMut.isPending ? "Čuvanje..." : "Sačuvaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
