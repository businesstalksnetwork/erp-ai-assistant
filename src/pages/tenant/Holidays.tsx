import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useState, lazy, Suspense } from "react";

const WorkCalendarView = lazy(() => import("@/components/hr/WorkCalendarView"));

export default function Holidays() {
  const { t, locale: language } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", name_sr: "", date: "", is_recurring: false });
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const { data: national = [], isLoading: nl } = useQuery({
    queryKey: ["holidays-national", filterYear],
    queryFn: async () => {
      const { data } = await supabase.from("holidays").select("*").is("tenant_id", null).gte("date", `${filterYear}-01-01`).lte("date", `${filterYear}-12-31`).order("date");
      return data || [];
    },
  });

  const { data: company = [], isLoading: cl } = useQuery({
    queryKey: ["holidays-company", tenantId, filterYear],
    queryFn: async () => {
      const { data } = await supabase.from("holidays").select("*").eq("tenant_id", tenantId!).gte("date", `${filterYear}-01-01`).lte("date", `${filterYear}-12-31`).order("date");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const addMutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const { error } = await supabase.from("holidays").insert([{
        tenant_id: tenantId!,
        name: f.name,
        name_sr: f.name_sr || null,
        date: f.date,
        is_recurring: f.is_recurring,
      }]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["holidays-company"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holidays").delete().eq("id", id).eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["holidays-company"] }); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const HolidayTable = ({ data, isNational }: { data: any[]; isNational: boolean }) => (
    <Table>
      <TableHeader><TableRow>
        <TableHead>{t("name")}</TableHead>
        <TableHead>{language === "sr" ? "Naziv (SR)" : "Name (SR)"}</TableHead>
        <TableHead>{t("date")}</TableHead>
        <TableHead>{t("type")}</TableHead>
        {!isNational && <TableHead className="w-12"></TableHead>}
      </TableRow></TableHeader>
      <TableBody>
        {data.length === 0 ? <TableRow><TableCell colSpan={isNational ? 4 : 5} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
        : data.map((h: any) => (
          <TableRow key={h.id}>
            <TableCell className="font-medium">{h.name}</TableCell>
            <TableCell>{h.name_sr || "—"}</TableCell>
            <TableCell>{h.date}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <Badge variant={isNational ? "default" : "secondary"}>{isNational ? t("nationalHoliday") : t("companyHoliday")}</Badge>
                {h.is_recurring && <Badge variant="outline">{language === "sr" ? "Ponavlja se" : "Recurring"}</Badge>}
              </div>
            </TableCell>
            {!isNational && (
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(h.id)} disabled={deleteMutation.isPending}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("holidays")}</h1>
        <div className="flex gap-2">
          <Input type="number" className="w-24" value={filterYear} onChange={e => setFilterYear(+e.target.value)} />
          <Button onClick={() => { setForm({ name: "", name_sr: "", date: "", is_recurring: false }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("addHoliday")}</Button>
        </div>
      </div>

      <Tabs defaultValue="national">
        <TabsList>
          <TabsTrigger value="national">{t("nationalHoliday")}</TabsTrigger>
          <TabsTrigger value="company">{t("companyHoliday")}</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarDays className="h-4 w-4 mr-1" />{language === "sr" ? "Radni kalendar" : "Work Calendar"}</TabsTrigger>
        </TabsList>
        <TabsContent value="national"><Card><CardContent className="p-0">{nl ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : <HolidayTable data={national} isNational />}</CardContent></Card></TabsContent>
        <TabsContent value="company"><Card><CardContent className="p-0">{cl ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : <HolidayTable data={company} isNational={false} />}</CardContent></Card></TabsContent>
        <TabsContent value="calendar">
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <WorkCalendarView year={filterYear} />
          </Suspense>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("addHoliday")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>{t("name")} (EN) *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>{language === "sr" ? "Naziv (SR)" : "Name (SR)"}</Label><Input value={form.name_sr} onChange={e => setForm({ ...form, name_sr: e.target.value })} /></div>
            <div className="grid gap-2"><Label>{t("date")} *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="recurring" checked={form.is_recurring} onChange={e => setForm({ ...form, is_recurring: e.target.checked })} />
              <Label htmlFor="recurring">{language === "sr" ? "Ponavlja se svake godine" : "Recurring annually"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => addMutation.mutate(form)} disabled={!form.name || !form.date || addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
