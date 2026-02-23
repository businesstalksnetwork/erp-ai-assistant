import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, FileText, Plus, Calendar } from "lucide-react";
import { toast } from "sonner";

const STAGES = ["qualification", "proposal", "negotiation", "closed_won", "closed_lost"] as const;

export default function OpportunityDetail() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: opp, isLoading } = useQuery({
    queryKey: ["opportunity", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunities")
        .select("*, partners(name), leads(name, first_name, last_name), contacts(first_name, last_name)")
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  // Multi-partner support
  const { data: oppPartners = [] } = useQuery({
    queryKey: ["opportunity-partners", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunity_partners" as any)
        .select("*, partners(name)")
        .eq("opportunity_id", id!);
      return data || [];
    },
    enabled: !!id,
  });

  // Linked meetings
  const { data: oppMeetings = [] } = useQuery({
    queryKey: ["opportunity-meetings", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("meetings")
        .select("id, title, scheduled_at, status, outcome, next_steps, partners(name)")
        .eq("opportunity_id", id!)
        .order("scheduled_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const stageMutation = useMutation({
    mutationFn: async (newStage: string) => {
      const closedAt = (newStage === "closed_won" || newStage === "closed_lost") ? new Date().toISOString() : null;
      const { error } = await supabase.from("opportunities").update({ stage: newStage, closed_at: closedAt }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["opportunity", id] }); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createQuoteMutation = useMutation({
    mutationFn: async () => {
      const quoteNumber = `QT-${Date.now().toString().slice(-8)}`;
      const { error } = await supabase.from("quotes").insert([{
        tenant_id: tenantId!,
        quote_number: quoteNumber,
        opportunity_id: opp!.id,
        partner_id: opp!.partner_id || null,
        partner_name: opp!.partners?.name || "",
        quote_date: new Date().toISOString().split("T")[0],
        status: "draft",
        currency: opp!.currency || "RSD",
        notes: opp!.description || opp!.notes || "",
      }]);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(t("conversionSuccess")); navigate("/crm/quotes"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!opp) return <div className="text-center py-20 text-muted-foreground">{t("noResults")}</div>;

  const fmt = (n: number) => new Intl.NumberFormat("sr-RS", { style: "currency", currency: opp.currency || "RSD" }).format(n);
  const isClosed = opp.stage === "closed_won" || opp.stage === "closed_lost";
  const contactName = opp.contacts ? `${opp.contacts.first_name} ${opp.contacts.last_name || ""}` : opp.leads ? (opp.leads.first_name || opp.leads.name) : opp.partners?.name || "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/crm/opportunities")}><ArrowLeft className="h-4 w-4 mr-1" />{t("back")}</Button>
        <h1 className="text-2xl font-bold">{opp.title}</h1>
        <Badge variant={opp.stage === "closed_won" ? "default" : opp.stage === "closed_lost" ? "destructive" : "secondary"}>
          {t(opp.stage as any)}
        </Badge>
      </div>

      {/* Stage buttons */}
      {!isClosed && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("stage")}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {STAGES.map(s => (
                <Button key={s} variant={opp.stage === s ? "default" : "outline"} size="sm"
                  onClick={() => stageMutation.mutate(s)} disabled={stageMutation.isPending}>
                  {t(s as any)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("companyInfo")}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><span className="text-muted-foreground">{t("value")}:</span> <strong>{fmt(opp.value)}</strong></div>
            <div><span className="text-muted-foreground">{t("probability")}:</span> {opp.probability}%</div>
            <div><span className="text-muted-foreground">{t("contactPerson")}:</span> {contactName}</div>
            <div><span className="text-muted-foreground">{t("expectedCloseDate")}:</span> {opp.expected_close_date || "—"}</div>
            {opp.closed_at && <div><span className="text-muted-foreground">{t("closedAt")}:</span> {new Date(opp.closed_at).toLocaleDateString("sr-RS")}</div>}
            {opp.description && <div><span className="text-muted-foreground">{t("description")}:</span> {opp.description}</div>}
            {opp.notes && <div><span className="text-muted-foreground">{t("notes")}:</span> {opp.notes}</div>}

            {/* Multi-partner display */}
            {oppPartners.length > 0 && (
              <div>
                <span className="text-muted-foreground">{t("opportunityPartners")}:</span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {oppPartners.map((op: any) => (
                    <Badge key={op.id} variant="outline">{(op as any).partners?.name}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("actions")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {!isClosed && (
              <Button variant="outline" className="w-full justify-start" onClick={() => createQuoteMutation.mutate()} disabled={createQuoteMutation.isPending}>
                <FileText className="h-4 w-4 mr-2" />{t("createQuote")}
              </Button>
            )}
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate(`/crm/meetings?opportunity=${id}&partner=${opp.partner_id || ""}`)}>
              <Calendar className="h-4 w-4 mr-2" />{t("logMeeting")}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Meetings section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("meetings")} ({oppMeetings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {oppMeetings.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">{t("noResults")}</p>
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
                {oppMeetings.map((m: any) => (
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
    </div>
  );
}
