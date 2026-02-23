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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Video, Phone, Mail, MapPin, Users, X } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/shared/PageHeader";

const CHANNELS = ["in_person", "video_call", "phone_call", "email", "hybrid"] as const;
const STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;

interface MeetingForm {
  title: string; description: string; scheduled_at: string; duration_minutes: number;
  location: string; communication_channel: string; status: string; notes: string;
  partner_id: string | null; opportunity_id: string | null;
  outcome: string; next_steps: string;
}

const emptyForm: MeetingForm = {
  title: "", description: "", scheduled_at: "", duration_minutes: 60,
  location: "", communication_channel: "in_person", status: "scheduled", notes: "",
  partner_id: null, opportunity_id: null, outcome: "", next_steps: "",
};

interface Attendee {
  contact_id?: string;
  partner_id?: string;
  external_name?: string;
  label: string;
}

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
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [externalName, setExternalName] = useState("");

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meetings", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("meetings")
        .select("*, partners(name), opportunities(title)")
        .eq("tenant_id", tenantId!)
        .order("scheduled_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ["opportunities-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("opportunities").select("id, title, partners(name)").eq("tenant_id", tenantId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: partnerContacts = [] } = useQuery({
    queryKey: ["partner-contacts-for-meeting", form.partner_id],
    queryFn: async () => {
      if (!form.partner_id) return [];
      const { data } = await supabase
        .from("contact_company_assignments")
        .select("contact_id, contacts(id, first_name, last_name)")
        .eq("partner_id", form.partner_id);
      return data || [];
    },
    enabled: !!form.partner_id,
  });

  const { data: meetingTypes = [] } = useQuery({
    queryKey: ["meeting-types", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("meeting_types").select("*").eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const mutation = useMutation({
    mutationFn: async (f: MeetingForm) => {
      const payload: any = {
        title: f.title, description: f.description || null, scheduled_at: f.scheduled_at,
        duration_minutes: f.duration_minutes || 60, location: f.location || null,
        communication_channel: f.communication_channel, status: f.status,
        notes: f.notes || null, tenant_id: tenantId!,
        partner_id: f.partner_id || null, opportunity_id: f.opportunity_id || null,
        outcome: f.outcome || null, next_steps: f.next_steps || null,
      };

      let meetingId = editId;
      if (editId) {
        const { error } = await supabase.from("meetings").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("meetings").insert([payload]).select("id").single();
        if (error) throw error;
        meetingId = data.id;
      }

      // Upsert participants
      if (meetingId) {
        await supabase.from("meeting_participants").delete().eq("meeting_id", meetingId);
        const participants = attendees.map(a => ({
          meeting_id: meetingId!,
          tenant_id: tenantId!,
          contact_id: a.contact_id || null,
          partner_id: a.partner_id || null,
          external_name: a.external_name || null,
          is_internal: false,
        }));
        if (participants.length > 0) {
          const { error } = await supabase.from("meeting_participants").insert(participants);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meetings"] }); setOpen(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAdd = useCallback((prefill?: Partial<MeetingForm>) => {
    setEditId(null);
    setForm({ ...emptyForm, ...prefill });
    setAttendees([]);
    setExternalName("");
    setOpen(true);
  }, []);

  const openEdit = async (m: any) => {
    setEditId(m.id);
    setForm({
      title: m.title, description: m.description || "", scheduled_at: m.scheduled_at?.slice(0, 16) || "",
      duration_minutes: m.duration_minutes || 60, location: m.location || "",
      communication_channel: m.communication_channel || "in_person", status: m.status || "scheduled",
      notes: m.notes || "", partner_id: m.partner_id || null, opportunity_id: m.opportunity_id || null,
      outcome: m.outcome || "", next_steps: m.next_steps || "",
    });
    // Load existing participants
    const { data: parts } = await supabase
      .from("meeting_participants")
      .select("*, contacts(first_name, last_name)")
      .eq("meeting_id", m.id);
    setAttendees((parts || []).map((p: any) => ({
      contact_id: p.contact_id || undefined,
      partner_id: p.partner_id || undefined,
      external_name: p.external_name || undefined,
      label: p.contacts ? `${p.contacts.first_name} ${p.contacts.last_name || ""}` : p.external_name || "—",
    })));
    setExternalName("");
    setOpen(true);
  };

  const toggleContact = (c: any) => {
    const exists = attendees.find(a => a.contact_id === c.contacts?.id);
    if (exists) {
      setAttendees(prev => prev.filter(a => a.contact_id !== c.contacts?.id));
    } else {
      setAttendees(prev => [...prev, {
        contact_id: c.contacts?.id,
        partner_id: form.partner_id || undefined,
        label: `${c.contacts?.first_name} ${c.contacts?.last_name || ""}`,
      }]);
    }
  };

  const addExternal = () => {
    if (!externalName.trim()) return;
    setAttendees(prev => [...prev, { external_name: externalName.trim(), label: externalName.trim() }]);
    setExternalName("");
  };

  const removeAttendee = (idx: number) => setAttendees(prev => prev.filter((_, i) => i !== idx));

  const now = new Date();
  const today = meetings.filter((m: any) => {
    const d = new Date(m.scheduled_at);
    return d.toDateString() === now.toDateString() && m.status !== "cancelled";
  });
  const upcoming = meetings.filter((m: any) => new Date(m.scheduled_at) > now && m.status === "scheduled");

  const filtered = meetings.filter((m: any) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (!search) return true;
    return m.title?.toLowerCase().includes(search.toLowerCase()) || m.partners?.name?.toLowerCase().includes(search.toLowerCase());
  });

  const statusColor = (s: string) => {
    if (s === "completed") return "default";
    if (s === "cancelled") return "destructive";
    if (s === "in_progress") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("meetings")}
        description="Schedule and track meetings with partners and opportunities"
        icon={Users}
        actions={<Button onClick={() => openAdd()}><Plus className="h-4 w-4 mr-2" />{t("addMeeting")}</Button>}
      />

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("today")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{today.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("upcoming")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{upcoming.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("completed")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{meetings.filter((m: any) => m.status === "completed").length}</div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="relative max-w-sm flex-1">
          <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />
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
                <TableHead>{t("partner")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("duration")}</TableHead>
                <TableHead>{t("channel")}</TableHead>
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
                  <TableCell>{m.partners?.name || "—"}</TableCell>
                  <TableCell>{new Date(m.scheduled_at).toLocaleString("sr-RS", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                  <TableCell>{m.duration_minutes} min</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {channelIcon(m.communication_channel)}
                      <span className="text-xs">{t(m.communication_channel as any) || m.communication_channel}</span>
                    </div>
                  </TableCell>
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

      {/* Meeting Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? t("editMeeting") : t("addMeeting")}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>{t("title")} *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("partner")}</Label>
                <Select value={form.partner_id || "__none"} onValueChange={v => setForm({ ...form, partner_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("linkedOpportunity")}</Label>
                <Select value={form.opportunity_id || "__none"} onValueChange={v => setForm({ ...form, opportunity_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {opportunities.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.title} {o.partners?.name ? `(${o.partners.name})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>{t("date")} *</Label><Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} /></div>
              <div className="grid gap-2"><Label>{t("duration")} (min)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid gap-2"><Label>{t("description")}</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>

            {/* Attendees section */}
            <div className="grid gap-2">
              <Label>{t("attendees")}</Label>
              {form.partner_id && partnerContacts.length > 0 && (
                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                  {partnerContacts.map((pc: any) => {
                    const cName = `${pc.contacts?.first_name} ${pc.contacts?.last_name || ""}`;
                    const checked = attendees.some(a => a.contact_id === pc.contacts?.id);
                    return (
                      <div key={pc.contact_id} className="flex items-center gap-2">
                        <Checkbox checked={checked} onCheckedChange={() => toggleContact(pc)} />
                        <span className="text-sm">{cName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {!form.partner_id && <p className="text-xs text-muted-foreground">{t("noPartnerSelected")}</p>}

              {/* External attendee input */}
              <div className="flex gap-2">
                <Input placeholder={t("addExternalAttendee")} value={externalName} onChange={e => setExternalName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addExternal(); } }} />
                <Button type="button" variant="outline" size="sm" onClick={addExternal} disabled={!externalName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Selected attendees */}
              {attendees.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {attendees.map((a, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {a.label}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removeAttendee(i)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2"><Label>{t("outcome")}</Label><Textarea value={form.outcome} onChange={e => setForm({ ...form, outcome: e.target.value })} rows={2} /></div>
            <div className="grid gap-2"><Label>{t("nextSteps")}</Label><Textarea value={form.next_steps} onChange={e => setForm({ ...form, next_steps: e.target.value })} rows={2} /></div>
            <div className="grid gap-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
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
