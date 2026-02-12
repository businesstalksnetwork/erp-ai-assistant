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
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function Holidays() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", date: "", is_recurring: false });
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

  const mutation = useMutation({
    mutationFn: async (f: typeof form) => {
      const { error } = await supabase.from("holidays").insert([{ tenant_id: tenantId!, name: f.name, date: f.date, is_recurring: f.is_recurring }]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["holidays-company"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const HolidayTable = ({ data, isNational }: { data: any[]; isNational: boolean }) => (
    <Table>
      <TableHeader><TableRow>
        <TableHead>{t("name")}</TableHead>
        <TableHead>{t("date")}</TableHead>
        <TableHead>{t("type")}</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {data.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
        : data.map((h: any) => (
          <TableRow key={h.id}>
            <TableCell>{h.name}</TableCell>
            <TableCell>{h.date}</TableCell>
            <TableCell><Badge variant={isNational ? "default" : "secondary"}>{isNational ? t("nationalHoliday") : t("companyHoliday")}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("holidays")}</h1>
        <div className="flex gap-2">
          <Input type="number" className="w-24" value={filterYear} onChange={e => setFilterYear(+e.target.value)} />
          <Button onClick={() => { setForm({ name: "", date: "", is_recurring: false }); setOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t("addHoliday")}</Button>
        </div>
      </div>

      <Tabs defaultValue="national">
        <TabsList><TabsTrigger value="national">{t("nationalHoliday")}</TabsTrigger><TabsTrigger value="company">{t("companyHoliday")}</TabsTrigger></TabsList>
        <TabsContent value="national"><Card><CardContent className="p-0">{nl ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : <HolidayTable data={national} isNational />}</CardContent></Card></TabsContent>
        <TabsContent value="company"><Card><CardContent className="p-0">{cl ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : <HolidayTable data={company} isNational={false} />}</CardContent></Card></TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("addHoliday")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>{t("name")} *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>{t("date")} *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.name || !form.date || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
