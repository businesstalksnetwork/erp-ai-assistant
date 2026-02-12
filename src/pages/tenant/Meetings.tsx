import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Calendar, Video, Phone, Mail, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const CHANNELS = ["in_person", "video_call", "phone_call", "email", "hybrid"] as const;
const STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;

interface MeetingForm {
  title: string; description: string; scheduled_at: string; duration_minutes: number;
  location: string; communication_channel: string; status: string; notes: string;
}

const emptyForm: MeetingForm = {
  title: "", description: "", scheduled_at: "", duration_minutes: 60,
  location: "", communication_channel: "in_person", status: "scheduled", notes: "",
};

const channelIcon = (ch: string) => {
  switch (ch) {
    case "video_call": return <Video className="h-3 w-3" />;
    case "phone_call": return <Phone className="h-3 w-3" />;
    case "email": return <Mail className="h-3 w-3" />;
    case "in_person": return <MapPin className="h-3 w-3" />;
    default: return <Users className="h-3 w-3" />;
  }
};

export default function Meetings() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<MeetingForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meetings", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("meetings")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("scheduled_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: MeetingForm) => {
      const payload = { ...f, tenant_id: tenantId!, duration_minutes: f.duration_minutes || 60 };
      if (editId) {
        const { error } = await supabase.from("meetings").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("meetings").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meetings"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (m: any) => {
    setEditId(m.id);
    setForm({
      title: m.title, description: m.description || "", scheduled_at: m.scheduled_at?.slice(0, 16) || "",
      duration_minutes: m.duration_minutes || 60, location: m.location || "",
      communication_channel: m.communication_channel || "in_person", status: m.status || "scheduled",
      notes: m.notes || "",
    });
    setOpen(true);
  };

  const now = new Date();
  const today = meetings.filter((m: any) => {
    const d = new Date(m.scheduled_at);
    return d.toDateString() === now.toDateString() && m.status !== "cancelled";
  });

  const upcoming = meetings.filter((m: any) => new Date(m.scheduled_at) > now && m.status === "scheduled");

  const filtered = meetings.filter((m: any) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (!search) return true;
    return m.title?.toLowerCase().includes(search.toLowerCase());
  });

  const statusColor = (s: string) => {
    if (s === "completed") return "default";
    if (s === "cancelled") return "destructive";
    if (s === "in_progress") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("meetings")}</h1>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("addMeeting")}</Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("today")}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{today.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("upcoming")}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{upcoming.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("completed")}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{meetings.filter((m: any) => m.status === "completed").length}</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative max-w-sm flex-1">
          <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-3" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("title")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("duration")}</TableHead>
                <TableHead>{t("channel")}</TableHead>
                <TableHead>{t("location")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
              ) : filtered.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.title}</TableCell>
                  <TableCell>{new Date(m.scheduled_at).toLocaleString("sr-RS", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                  <TableCell>{m.duration_minutes} min</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {channelIcon(m.communication_channel)}
                      <span className="text-xs">{t(m.communication_channel as any) || m.communication_channel}</span>
                    </div>
                  </TableCell>
                  <TableCell>{m.location || "—"}</TableCell>
                  <TableCell><Badge variant={statusColor(m.status) as any}>{t(m.status as any) || m.status}</Badge></TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>{t("edit")}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editMeeting") : t("addMeeting")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>{t("title")} *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("date")} *</Label><Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("duration")} (min)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("channel")}</Label>
                <Select value={form.communication_channel} onValueChange={v => setForm({ ...form, communication_channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANNELS.map(ch => <SelectItem key={ch} value={ch}>{t(ch as any) || ch}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("status")}</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>{t("location")}</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div className="grid gap-2"><Label>{t("description")}</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => mutation.mutate(form)} disabled={!form.title || !form.scheduled_at || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
