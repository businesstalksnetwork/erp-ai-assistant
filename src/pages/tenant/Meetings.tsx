import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Video, Phone, Mail, MapPin, Users, X, CalendarDays, ClipboardCheck, ArrowLeft, FileText, Building2, Briefcase, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useState, useCallback, useEffect } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { useNavigate, useSearchParams } from "react-router-dom";

const CHANNELS = ["in_person", "video_call", "phone_call", "email", "hybrid"] as const;
const STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;

type DialogMode = "schedule" | "log";

interface MeetingForm {
  title: string; description: string; scheduled_at: string; duration_minutes: number;
  location: string; communication_channel: string; status: string; notes: string;
  opportunity_id: string | null;
  outcome: string; next_steps: string;
}

const emptyForm: MeetingForm = {
  title: "", description: "", scheduled_at: "", duration_minutes: 60,
  location: "", communication_channel: "in_person", status: "scheduled", notes: "",
  opportunity_id: null, outcome: "", next_steps: "",
};

interface Attendee {
  contact_id?: string;
  partner_id?: string;
  employee_id?: string;
  external_name?: string;
  external_email?: string;
  is_internal: boolean;
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

const statusColor = (s: string) => {
  if (s === "completed") return "default";
  if (s === "cancelled") return "destructive";
  if (s === "in_progress") return "secondary";
  return "outline";
};

export default function Meetings() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("schedule");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<MeetingForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [externalName, setExternalName] = useState("");
  const [externalEmail, setExternalEmail] = useState("");
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);

  // Handle URL params to auto-open schedule form from Opportunity Detail
  useEffect(() => {
    const oppId = searchParams.get("opportunity");
    const partnerId = searchParams.get("partner");
    if (oppId) {
      setDialogMode("schedule");
      setEditId(null);
      setForm(f => ({ ...emptyForm, status: "scheduled", opportunity_id: oppId }));
      setAttendees([]);
      if (partnerId) setSelectedPartnerIds([partnerId]);
      else setSelectedPartnerIds([]);
      setExternalName(""); setExternalEmail("");
      setShowForm(true);
      // Clear the URL params
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Data queries
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

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").eq("tenant_id", tenantId!).eq("status", "active").order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: partnerContacts = [] } = useQuery({
    queryKey: ["partner-contacts-multi", selectedPartnerIds],
    queryFn: async () => {
      if (selectedPartnerIds.length === 0) return [];
      const { data } = await supabase
        .from("contact_company_assignments")
        .select("contact_id, partner_id, contacts(id, first_name, last_name, email)")
        .in("partner_id", selectedPartnerIds);
      return data || [];
    },
    enabled: selectedPartnerIds.length > 0,
  });

  const mutation = useMutation({
    mutationFn: async (f: MeetingForm) => {
      const primaryPartnerId = selectedPartnerIds.length > 0 ? selectedPartnerIds[0] : null;
      const payload: any = {
        title: f.title, description: f.description || null, scheduled_at: f.scheduled_at,
        duration_minutes: f.duration_minutes || 60, location: f.location || null,
        communication_channel: f.communication_channel, status: f.status,
        notes: f.notes || null, tenant_id: tenantId!,
        partner_id: primaryPartnerId, opportunity_id: f.opportunity_id || null,
        outcome: dialogMode === "log" ? (f.outcome || null) : null,
        next_steps: dialogMode === "log" ? (f.next_steps || null) : null,
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

      if (meetingId) {
        await supabase.from("meeting_participants").delete().eq("meeting_id", meetingId);
        const participants = attendees.map(a => ({
          meeting_id: meetingId!,
          tenant_id: tenantId!,
          contact_id: a.contact_id || null,
          partner_id: a.partner_id || null,
          employee_id: a.employee_id || null,
          external_name: a.external_name || null,
          external_email: a.external_email || null,
          is_internal: a.is_internal,
        }));
        if (participants.length > 0) {
          const { error } = await supabase.from("meeting_participants").insert(participants);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["meetings"] }); setShowForm(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openSchedule = useCallback(() => {
    setEditId(null);
    setDialogMode("schedule");
    setForm({ ...emptyForm, status: "scheduled" });
    setAttendees([]);
    setSelectedPartnerIds([]);
    setExternalName(""); setExternalEmail("");
    setShowForm(true);
  }, []);

  const openLog = useCallback(() => {
    setEditId(null);
    setDialogMode("log");
    setForm({ ...emptyForm, status: "completed", scheduled_at: new Date().toISOString().slice(0, 16) });
    setAttendees([]);
    setSelectedPartnerIds([]);
    setExternalName(""); setExternalEmail("");
    setShowForm(true);
  }, []);

  const openEdit = async (m: any) => {
    setEditId(m.id);
    setDialogMode(m.status === "completed" ? "log" : "schedule");
    setForm({
      title: m.title, description: m.description || "", scheduled_at: m.scheduled_at?.slice(0, 16) || "",
      duration_minutes: m.duration_minutes || 60, location: m.location || "",
      communication_channel: m.communication_channel || "in_person", status: m.status || "scheduled",
      notes: m.notes || "", opportunity_id: m.opportunity_id || null,
      outcome: m.outcome || "", next_steps: m.next_steps || "",
    });
    const { data: parts } = await supabase
      .from("meeting_participants")
      .select("*, contacts(first_name, last_name, email), employees(full_name)")
      .eq("meeting_id", m.id);
    const partnerIds = new Set<string>();
    if (m.partner_id) partnerIds.add(m.partner_id);
    const loadedAttendees: Attendee[] = (parts || []).map((p: any) => {
      if (p.partner_id) partnerIds.add(p.partner_id);
      return {
        contact_id: p.contact_id || undefined,
        partner_id: p.partner_id || undefined,
        employee_id: p.employee_id || undefined,
        external_name: p.external_name || undefined,
        external_email: p.external_email || undefined,
        is_internal: p.is_internal || false,
        label: p.is_internal && p.employees
          ? p.employees.full_name
          : p.contacts
            ? `${p.contacts.first_name} ${p.contacts.last_name || ""}`
            : p.external_name || "—",
      };
    });
    setAttendees(loadedAttendees);
    setSelectedPartnerIds(Array.from(partnerIds));
    setExternalName(""); setExternalEmail("");
    setShowForm(true);
  };

  const togglePartner = (partnerId: string) => {
    setSelectedPartnerIds(prev =>
      prev.includes(partnerId) ? prev.filter(id => id !== partnerId) : [...prev, partnerId]
    );
  };

  const toggleContact = (c: any) => {
    const cId = c.contacts?.id;
    if (!cId) return;
    const exists = attendees.find(a => a.contact_id === cId);
    if (exists) {
      setAttendees(prev => prev.filter(a => a.contact_id !== cId));
    } else {
      setAttendees(prev => [...prev, {
        contact_id: cId,
        partner_id: c.partner_id || undefined,
        is_internal: false,
        label: `${c.contacts?.first_name} ${c.contacts?.last_name || ""}`,
      }]);
    }
  };

  const toggleEmployee = (emp: any) => {
    const exists = attendees.find(a => a.employee_id === emp.id);
    if (exists) {
      setAttendees(prev => prev.filter(a => a.employee_id !== emp.id));
    } else {
      setAttendees(prev => [...prev, { employee_id: emp.id, is_internal: true, label: emp.full_name }]);
    }
  };

  const addExternal = () => {
    if (!externalName.trim()) return;
    setAttendees(prev => [...prev, {
      external_name: externalName.trim(),
      external_email: externalEmail.trim() || undefined,
      is_internal: false,
      label: externalName.trim(),
    }]);
    setExternalName(""); setExternalEmail("");
  };

  const removeAttendee = (idx: number) => setAttendees(prev => prev.filter((_, i) => i !== idx));

  // Stats
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

  const contactsByPartner = new Map<string, any[]>();
  partnerContacts.forEach((pc: any) => {
    const pid = pc.partner_id;
    if (!contactsByPartner.has(pid)) contactsByPartner.set(pid, []);
    contactsByPartner.get(pid)!.push(pc);
  });

  const attendeeEmails = attendees
    .map(a => {
      if (a.external_email) return a.external_email;
      const pc = partnerContacts.find((c: any) => c.contacts?.id === a.contact_id);
      return pc?.contacts?.email;
    })
    .filter(Boolean);

  // ──────── FORM VIEW (full-screen inline) ────────
  if (showForm) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {editId
                ? t("editMeeting")
                : dialogMode === "schedule"
                  ? t("noviSastanak")
                  : t("evidentirajSastanakTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {dialogMode === "schedule" ? t("zakaziteNovi") : t("evidentirajteOdrzani")}
            </p>
          </div>
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ─── Left Column ─── */}
          <div className="space-y-6">
            {/* Card 1: Basic Info */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{t("osnovniPodaci")}</CardTitle>
                    <CardDescription>{dialogMode === "schedule" ? t("zakaziteNovi") : t("evidentirajteOdrzani")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("title")} *</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={t("title")} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("date")} *</Label>
                    <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("duration")} (min)</Label>
                    <Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("channel")}</Label>
                    <Select value={form.communication_channel} onValueChange={v => setForm({ ...form, communication_channel: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CHANNELS.map(ch => <SelectItem key={ch} value={ch}>{t(ch as any) || ch}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("status")}</Label>
                    <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("location")}</Label>
                  <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder={t("location")} />
                </div>

                <div className="space-y-2">
                  <Label>{t("description")}</Label>
                  <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder={t("agenda")} />
                </div>

                {/* Outcome & Next Steps — log mode only */}
                {dialogMode === "log" && (
                  <>
                    <div className="space-y-2">
                      <Label>{t("outcome")}</Label>
                      <Textarea value={form.outcome} onChange={e => setForm({ ...form, outcome: e.target.value })} rows={3} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("nextSteps")}</Label>
                      <Textarea value={form.next_steps} onChange={e => setForm({ ...form, next_steps: e.target.value })} rows={3} />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>{t("notes")}</Label>
                  <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Partners */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{t("partners")}</CardTitle>
                    <CardDescription>{t("povezaneKompanije")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {partners.length === 0 && <p className="text-sm text-muted-foreground">{t("noResults")}</p>}
                  {partners.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedPartnerIds.includes(p.id)}
                        onCheckedChange={() => togglePartner(p.id)}
                      />
                      <span className="text-sm">{p.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ─── Right Column ─── */}
          <div className="space-y-6">
            {/* Card 2: Attendees */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{t("ucesnici")}</CardTitle>
                    <CardDescription>{t("attendees")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Internal Staff */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("internalAttendees")}</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                    {employees.length === 0 && <p className="text-xs text-muted-foreground">{t("noResults")}</p>}
                    {employees.map((emp: any) => {
                      const checked = attendees.some(a => a.employee_id === emp.id);
                      return (
                        <div key={emp.id} className="flex items-center gap-2">
                          <Checkbox checked={checked} onCheckedChange={() => toggleEmployee(emp)} />
                          <span className="text-sm">{emp.full_name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Partner Contacts */}
                {selectedPartnerIds.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("contacts")}</Label>
                    <div className="border rounded-md p-3 space-y-3 max-h-48 overflow-y-auto">
                      {selectedPartnerIds.map(pid => {
                        const pName = partners.find((p: any) => p.id === pid)?.name || pid;
                        const contacts = contactsByPartner.get(pid) || [];
                        return (
                          <div key={pid}>
                            <div className="text-xs font-semibold text-muted-foreground mb-1">{pName}</div>
                            {contacts.length === 0 && <p className="text-xs text-muted-foreground italic">Nema kontakata</p>}
                            {contacts.map((pc: any) => {
                              const cName = `${pc.contacts?.first_name} ${pc.contacts?.last_name || ""}`;
                              const checked = attendees.some(a => a.contact_id === pc.contacts?.id);
                              return (
                                <div key={pc.contact_id} className="flex items-center gap-2 ml-2">
                                  <Checkbox checked={checked} onCheckedChange={() => toggleContact(pc)} />
                                  <span className="text-sm">{cName}</span>
                                  {pc.contacts?.email && <span className="text-xs text-muted-foreground">({pc.contacts.email})</span>}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* External Attendees */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("externalAttendee")}</Label>
                  <div className="flex gap-2">
                    <Input placeholder={t("fullName")} value={externalName} onChange={e => setExternalName(e.target.value)} className="flex-1" />
                    <Input placeholder={t("externalEmail")} value={externalEmail} onChange={e => setExternalEmail(e.target.value)} className="flex-1"
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addExternal(); } }} />
                    <Button type="button" variant="outline" size="icon" onClick={addExternal} disabled={!externalName.trim()}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Selected attendees badges */}
                {attendees.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("ucesnici")} ({attendees.length})
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {attendees.map((a, i) => (
                        <Badge key={i} variant={a.is_internal ? "default" : "secondary"} className="gap-1 pr-1">
                          {a.label}
                          {a.external_email && <span className="text-[10px] opacity-70">({a.external_email})</span>}
                          <X className="h-3 w-3 cursor-pointer ml-0.5" onClick={() => removeAttendee(i)} />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invite preview (schedule mode only) */}
                {dialogMode === "schedule" && attendeeEmails.length > 0 && (
                  <div className="bg-muted/50 rounded-md p-3 text-xs">
                    <span className="font-medium">{t("inviteWillBeSent")}</span>{" "}
                    {attendeeEmails.join(", ")}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card 4: Opportunity */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{t("opportunity")}</CardTitle>
                    <CardDescription>{t("poveziteSaPrilikom")}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Select value={form.opportunity_id || "__none"} onValueChange={v => setForm({ ...form, opportunity_id: v === "__none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {opportunities.map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>{o.title} {o.partners?.name ? `(${o.partners.name})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-background border-t py-4 -mx-6 px-6 flex justify-between items-center z-10">
          <Button variant="outline" onClick={() => setShowForm(false)}>{t("cancel")}</Button>
          <Button onClick={() => mutation.mutate(form)} disabled={!form.title || !form.scheduled_at || mutation.isPending} size="lg">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {dialogMode === "schedule" ? t("zakaziSastanak") : t("evidentirajSastanak")}
          </Button>
        </div>
      </div>
    );
  }

  // ──────── LIST VIEW ────────
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("meetings")}
        description="Schedule and track meetings with partners and opportunities"
        icon={Users}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="sm:size-default" onClick={() => navigate("/crm/meetings/calendar")}>
              <CalendarDays className="h-4 w-4 mr-2" /><span className="hidden sm:inline">{t("meetingsCalendar")}</span><span className="sm:hidden">Calendar</span>
            </Button>
            <Button variant="outline" size="sm" className="sm:size-default" onClick={openLog}>
              <ClipboardCheck className="h-4 w-4 mr-2" /><span className="hidden sm:inline">{t("evidentirajSastanak")}</span><span className="sm:hidden">Log</span>
            </Button>
            <Button size="sm" className="sm:size-default" onClick={openSchedule}>
              <Plus className="h-4 w-4 mr-2" /><span className="hidden sm:inline">{t("zakaziSastanak")}</span><span className="sm:hidden">New</span>
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("today")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{today.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("upcoming")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{upcoming.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{t("completed")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{meetings.filter((m: any) => m.status === "completed").length}</div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
        <div className="relative flex-1">
          <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{t(s as any) || s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
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
    </div>
  );
}
