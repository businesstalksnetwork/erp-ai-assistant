import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, Pencil, Save, X, Plus, Calendar, ShieldCheck, AlertTriangle, ShieldAlert, CheckCircle2, DollarSign, FileText, Target, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { StatsBar, type StatItem } from "@/components/shared/StatsBar";

const TYPE_COLORS: Record<string, string> = {
  customer: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  supplier: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  both: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const TIER_COLORS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  B: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  C: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  D: "bg-muted text-muted-foreground",
};

const CONTACT_ROLES = ["decision_maker", "influencer", "champion", "end_user", "billing", "technical", "primary"] as const;

const ROLE_LABELS: Record<string, string> = {
  decision_maker: "decisionMaker",
  influencer: "influencer",
  champion: "champion",
  end_user: "endUser",
  billing: "billing",
  technical: "technical",
  primary: "primaryContact",
};

export default function CompanyDetail() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);

  const { data: partner, isLoading } = useQuery({
    queryKey: ["partner-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("*, partner_category_assignments(category_id, company_categories(name, name_sr, color))")
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: linkedContacts = [] } = useQuery({
    queryKey: ["partner-contacts", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("contact_company_assignments")
        .select("*, contacts(id, first_name, last_name, email, phone, type)")
        .eq("partner_id", id!);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: relatedActivities = [] } = useQuery({
    queryKey: ["partner-activities", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("*")
        .eq("partner_id", id!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: relatedMeetings = [] } = useQuery({
    queryKey: ["partner-meetings", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("meetings")
        .select("id, title, scheduled_at, duration_minutes, status, communication_channel, outcome, next_steps")
        .eq("partner_id", id!)
        .order("scheduled_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: relatedInvoices = [] } = useQuery({
    queryKey: ["partner-invoices", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, total, status, partner_name")
        .eq("partner_id", id!)
        .order("invoice_date", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: relatedPOs = [] } = useQuery({
    queryKey: ["partner-pos", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, order_number, order_date, total, status")
        .eq("supplier_id", id!)
        .order("order_date", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: relatedOpportunities = [] } = useQuery({
    queryKey: ["partner-opportunities", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("id, title, stage, value, expected_close_date, salesperson_id")
        .eq("partner_id", id!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: relatedQuotes = [] } = useQuery({
    queryKey: ["partner-quotes", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("quotes")
        .select("id, quote_number, quote_date, total, status, currency, current_version, valid_until")
        .eq("partner_id", id!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (f: any) => {
      const { error } = await supabase.from("partners").update(f).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["partner-detail", id] }); setEditing(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ assignmentId, role }: { assignmentId: string; role: string | null }) => {
      const { error } = await supabase.from("contact_company_assignments").update({ role }).eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["partner-contacts", id] }); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!partner) return <div className="text-center py-20 text-muted-foreground">{t("noResults")}</div>;

  const typeLabel = (type: string) => {
    const map: Record<string, string> = { customer: t("customer"), supplier: t("supplier"), both: t("both") };
    return map[type] || type;
  };

  const fmt = (n: number) => new Intl.NumberFormat("sr-RS", { style: "currency", currency: "RSD", maximumFractionDigits: 0 }).format(n);

  const startEdit = () => {
    setForm({
      name: partner.name, display_name: partner.display_name || "",
      email: partner.email || "", phone: partner.phone || "", website: partner.website || "",
      address: partner.address || "", city: partner.city || "", postal_code: partner.postal_code || "",
      notes: partner.notes || "", contact_person: partner.contact_person || "",
    });
    setEditing(true);
  };

  // Credit status calculation
  const unpaidInvoices = relatedInvoices.filter((inv: any) => inv.status === "sent" || inv.status === "overdue");
  const outstandingBalance = unpaidInvoices.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
  const creditLimit = partner.credit_limit || 0;
  const creditUtilization = creditLimit > 0 ? Math.min(Math.round((outstandingBalance / creditLimit) * 100), 100) : 0;
  const creditColor = creditUtilization > 90 ? "text-destructive" : creditUtilization > 70 ? "text-amber-500" : "text-emerald-500";

  // Dormancy info
  const dormancyStatus = partner.dormancy_status || "active";
  const lastInvoiceDate = partner.last_invoice_date;
  const daysSinceInvoice = lastInvoiceDate
    ? Math.floor((Date.now() - new Date(lastInvoiceDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const txCount = relatedInvoices.length + relatedPOs.length;

  // Quick stats
  const totalRevenue = relatedInvoices
    .filter((inv: any) => inv.status === "paid" || inv.status === "posted")
    .reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
  const activeQuotes = relatedQuotes.filter((q: any) => q.status === "draft" || q.status === "sent").length;

  const quickStats: StatItem[] = [
    { label: t("totalRevenue"), value: fmt(totalRevenue), icon: DollarSign, color: "text-emerald-500" },
    { label: t("remainingBalance"), value: fmt(outstandingBalance), icon: BarChart3, color: outstandingBalance > 0 ? "text-amber-500" : "text-muted-foreground" },
    { label: t("opportunities"), value: relatedOpportunities.length, icon: Target, color: "text-primary" },
    { label: t("quotes"), value: activeQuotes, icon: FileText, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/crm/companies")}><ArrowLeft className="h-4 w-4 mr-1" />{t("back")}</Button>
        <h1 className="text-2xl font-bold">{partner.display_name || partner.name}</h1>
        <Badge className={TYPE_COLORS[partner.type] || ""}>{typeLabel(partner.type)}</Badge>
        {partner.account_tier && (
          <Badge className={TIER_COLORS[partner.account_tier] || ""}>{t("accountTier")}: {partner.account_tier}</Badge>
        )}
        <div className="flex gap-1">
          {partner.partner_category_assignments?.map((a: any) => (
            <Badge key={a.category_id} variant="outline" style={{ borderColor: a.company_categories?.color }}>
              {a.company_categories?.name_sr || a.company_categories?.name}
            </Badge>
          ))}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">{t("companyInfo")}</TabsTrigger>
          <TabsTrigger value="contacts">{t("contacts")} ({linkedContacts.length})</TabsTrigger>
          <TabsTrigger value="opportunities">{t("opportunities")} ({relatedOpportunities.length})</TabsTrigger>
          <TabsTrigger value="quotes">{t("quotes")} ({relatedQuotes.length})</TabsTrigger>
          <TabsTrigger value="meetings">{t("meetings")} ({relatedMeetings.length})</TabsTrigger>
          <TabsTrigger value="transactions">{t("invoices")} ({txCount})</TabsTrigger>
          <TabsTrigger value="activities">{t("activities")} ({relatedActivities.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-4">
            {/* Quick Stats */}
            <StatsBar stats={quickStats} />

            {/* Account Health Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  {t("accountHealth")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {/* Tier & Revenue */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{t("accountTier")}</p>
                    <div className="flex items-center gap-2">
                      {partner.account_tier ? (
                        <Badge className={`text-lg px-3 py-1 ${TIER_COLORS[partner.account_tier] || ""}`}>
                          {partner.account_tier}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("revenue12m")}: {fmt(partner.tier_revenue_12m || 0)}
                    </p>
                  </div>

                  {/* Dormancy Status */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{t("dormancyStatus")}</p>
                    <div className="flex items-center gap-2">
                      {dormancyStatus === "active" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                      {dormancyStatus === "at_risk" && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                      {dormancyStatus === "dormant" && <ShieldAlert className="h-5 w-5 text-destructive" />}
                      <span className="font-medium">
                        {t(dormancyStatus === "active" ? "dormancyActive" : dormancyStatus === "at_risk" ? "dormancyAtRisk" : "dormancyDormant")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("lastInvoiceDate")}: {lastInvoiceDate ? new Date(lastInvoiceDate).toLocaleDateString("sr-RS") : "—"}
                      {daysSinceInvoice !== null && ` (${daysSinceInvoice} ${t("daysInactive")})`}
                    </p>
                  </div>

                  {/* Credit Status */}
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{t("creditStatus")}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${creditColor}`}>{fmt(outstandingBalance)}</span>
                      <span className="text-sm text-muted-foreground">/ {fmt(creditLimit)}</span>
                    </div>
                    {creditLimit > 0 && (
                      <div className="space-y-1">
                        <Progress
                          value={creditUtilization}
                          className={`h-2 ${creditUtilization > 90 ? "[&>div]:bg-destructive" : creditUtilization > 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`}
                        />
                        <p className="text-xs text-muted-foreground">{t("creditUtilization")}: {creditUtilization}%</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Company Info Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t("companyInfo")}</CardTitle>
                {!editing ? (
                  <Button variant="outline" size="sm" onClick={startEdit}><Pencil className="h-4 w-4 mr-1" />{t("edit")}</Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" />{t("cancel")}</Button>
                    <Button size="sm" onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>
                      <Save className="h-4 w-4 mr-1" />{t("save")}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {editing && form ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2"><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                    <div className="grid gap-2"><Label>{t("displayName")}</Label><Input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></div>
                    <div className="grid gap-2"><Label>{t("email")}</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                    <div className="grid gap-2"><Label>{t("phone")}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                    <div className="grid gap-2"><Label>{t("website")}</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></div>
                    <div className="grid gap-2"><Label>{t("contactPerson")}</Label><Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
                    <div className="grid gap-2"><Label>{t("address")}</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                    <div className="grid gap-2"><Label>{t("city")}</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
                    <div className="grid gap-2"><Label>{t("postalCode")}</Label><Input value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} /></div>
                    <div className="grid gap-2 md:col-span-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 text-sm">
                    <div><span className="text-muted-foreground">{t("name")}:</span> <strong>{partner.name}</strong></div>
                    <div><span className="text-muted-foreground">{t("pib")}:</span> {partner.pib || "—"}</div>
                    <div><span className="text-muted-foreground">{t("maticniBroj")}:</span> {partner.maticni_broj || "—"}</div>
                    <div><span className="text-muted-foreground">{t("email")}:</span> {partner.email || "—"}</div>
                    <div><span className="text-muted-foreground">{t("phone")}:</span> {partner.phone || "—"}</div>
                    <div><span className="text-muted-foreground">{t("website")}:</span> {partner.website || "—"}</div>
                    <div><span className="text-muted-foreground">{t("contactPerson")}:</span> {partner.contact_person || "—"}</div>
                    <div><span className="text-muted-foreground">{t("address")}:</span> {partner.address || "—"}, {partner.city || ""} {partner.postal_code || ""}</div>
                    <div><span className="text-muted-foreground">{t("creditLimit")}:</span> {fmt(partner.credit_limit || 0)}</div>
                    <div><span className="text-muted-foreground">{t("paymentTermsDays")}:</span> {partner.payment_terms_days || 30}</div>
                    <div><span className="text-muted-foreground">{t("status")}:</span> <Badge variant={partner.is_active ? "default" : "secondary"}>{partner.is_active ? t("active") : t("inactive")}</Badge></div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("email")}</TableHead>
                    <TableHead>{t("phone")}</TableHead>
                    <TableHead>{t("type")}</TableHead>
                    <TableHead>{t("jobTitle")}</TableHead>
                    <TableHead>{t("contactRole")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedContacts.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
                  ) : linkedContacts.map((lc: any) => (
                    <TableRow key={lc.id} className="cursor-pointer" onClick={() => navigate(`/crm/contacts/${lc.contacts?.id}`)}>
                      <TableCell className="font-medium">{lc.contacts?.first_name} {lc.contacts?.last_name || ""}</TableCell>
                      <TableCell>{lc.contacts?.email || "—"}</TableCell>
                      <TableCell>{lc.contacts?.phone || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{lc.contacts?.type}</Badge></TableCell>
                      <TableCell>{lc.job_title || "—"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={lc.role || "__none"}
                          onValueChange={(v) => updateRoleMutation.mutate({ assignmentId: lc.id, role: v === "__none" ? null : v })}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">{t("noRole")}</SelectItem>
                            {CONTACT_ROLES.map(r => (
                              <SelectItem key={r} value={r}>{t(ROLE_LABELS[r] as any)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Opportunities Tab */}
        <TabsContent value="opportunities">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("opportunities")}</CardTitle>
              <Button size="sm" onClick={() => navigate("/crm/opportunities")}>
                <Plus className="h-4 w-4 mr-1" />{t("add")}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {relatedOpportunities.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("title")}</TableHead>
                      <TableHead>{t("stage")}</TableHead>
                      <TableHead className="text-right">{t("value")}</TableHead>
                      <TableHead>{t("expectedCloseDate")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatedOpportunities.map((opp: any) => (
                      <TableRow key={opp.id} className="cursor-pointer" onClick={() => navigate(`/crm/opportunities/${opp.id}`)}>
                        <TableCell className="font-medium">{opp.title}</TableCell>
                        <TableCell><Badge variant="secondary">{opp.stage}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums">{opp.value ? fmt(opp.value) : "—"}</TableCell>
                        <TableCell>{opp.expected_close_date ? new Date(opp.expected_close_date).toLocaleDateString("sr-RS") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quotes Tab */}
        <TabsContent value="quotes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("quotes")}</CardTitle>
              <Button size="sm" onClick={() => navigate("/sales/quotes")}>
                <Plus className="h-4 w-4 mr-1" />{t("add")}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {relatedQuotes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("quoteNumber")}</TableHead>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead className="text-right">{t("total")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("validUntil")}</TableHead>
                      <TableHead>V.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatedQuotes.map((q: any) => (
                      <TableRow key={q.id} className="cursor-pointer" onClick={() => navigate(`/sales/quotes/${q.id}`)}>
                        <TableCell className="font-medium">{q.quote_number}</TableCell>
                        <TableCell>{q.quote_date ? new Date(q.quote_date).toLocaleDateString("sr-RS") : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{q.total ? fmt(q.total) : "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{q.status}</Badge></TableCell>
                        <TableCell>{q.valid_until ? new Date(q.valid_until).toLocaleDateString("sr-RS") : "—"}</TableCell>
                        <TableCell><Badge variant="outline">v{q.current_version || 1}</Badge></TableCell>

                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meetings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("meetings")}</CardTitle>
              <Button size="sm" onClick={() => navigate(`/crm/meetings?partner=${id}`)}>
                <Plus className="h-4 w-4 mr-1" />{t("logMeeting")}
              </Button>
            </CardHeader>
            <CardContent>
              {relatedMeetings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("title")}</TableHead>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("outcome")}</TableHead>
                      <TableHead>{t("nextSteps")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatedMeetings.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.title}</TableCell>
                        <TableCell>{new Date(m.scheduled_at).toLocaleString("sr-RS", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                        <TableCell><Badge variant="secondary">{t(m.status as any) || m.status}</Badge></TableCell>
                        <TableCell className="max-w-[200px] truncate">{m.outcome || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{m.next_steps || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <div className="space-y-4">
            {relatedInvoices.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">{t("invoices")} ({relatedInvoices.length})</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("invoiceNumber")}</TableHead>
                        <TableHead>{t("date")}</TableHead>
                        <TableHead>{t("total")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relatedInvoices.map((inv: any) => (
                        <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate(`/accounting/invoices/${inv.id}`)}>
                          <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                          <TableCell>{new Date(inv.invoice_date).toLocaleDateString("sr-RS")}</TableCell>
                          <TableCell>{fmt(inv.total)}</TableCell>
                          <TableCell><Badge variant="secondary">{inv.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
            {relatedPOs.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">{t("purchaseOrders")} ({relatedPOs.length})</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("orderNumber")}</TableHead>
                        <TableHead>{t("date")}</TableHead>
                        <TableHead>{t("total")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relatedPOs.map((po: any) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-medium">{po.order_number}</TableCell>
                          <TableCell>{new Date(po.order_date).toLocaleDateString("sr-RS")}</TableCell>
                          <TableCell>{fmt(po.total)}</TableCell>
                          <TableCell><Badge variant="secondary">{po.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
            {relatedInvoices.length === 0 && relatedPOs.length === 0 && (
              <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activities">
          <Card>
            <CardContent className="pt-6">
              {relatedActivities.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>
              ) : (
                <div className="space-y-3">
                  {relatedActivities.map((a: any) => (
                    <div key={a.id} className="flex items-start gap-3 text-sm border-b pb-3 last:border-0">
                      <Badge variant="outline">{a.type}</Badge>
                      <div>
                        <p>{a.description}</p>
                        <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("sr-RS")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
