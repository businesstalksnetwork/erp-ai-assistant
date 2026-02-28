import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { useOpportunityStages } from "@/hooks/useOpportunityStages";
import { OpportunityOverviewTab } from "@/components/opportunity/OpportunityOverviewTab";
import { OpportunityDocumentsTab } from "@/components/opportunity/OpportunityDocumentsTab";
import { OpportunityDiscussionTab } from "@/components/opportunity/OpportunityDiscussionTab";
import { OpportunityActivityTab } from "@/components/opportunity/OpportunityActivityTab";
import { OpportunityTagsBar } from "@/components/opportunity/OpportunityTagsBar";
import { PartialWonDialog } from "@/components/opportunity/PartialWonDialog";
import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export default function OpportunityDetail() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: stages = [] } = useOpportunityStages();
  const [partialWonOpen, setPartialWonOpen] = useState(false);

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

  const { data: followers = [] } = useQuery({
    queryKey: ["opportunity-followers", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunity_followers" as any)
        .select("*, profiles(full_name)")
        .eq("opportunity_id", id!);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: tenantMembers = [] } = useQuery({
    queryKey: ["tenant-members-list", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_members")
        .select("user_id, role")
        .eq("tenant_id", tenantId!)
        .eq("status", "active");
      const userIds = (data || []).map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      return (data || []).map((m: any) => ({
        ...m,
        profiles: profiles?.find((p: any) => p.id === m.user_id) || { full_name: "" },
      }));
    },
    enabled: !!tenantId,
  });

  const logActivity = useCallback(async (activityType: string, description: string, metadata?: any) => {
    if (!tenantId || !id) return;
    await supabase.from("opportunity_activities" as any).insert([{
      tenant_id: tenantId,
      opportunity_id: id,
      user_id: user?.id,
      activity_type: activityType,
      description,
      metadata: metadata || {},
    }]);
    qc.invalidateQueries({ queryKey: ["opportunity-activities", id] });
  }, [tenantId, id, user?.id, qc]);

  const stageMutation = useMutation({
    mutationFn: async (newStage: string) => {
      const stageObj = stages.find(s => s.code === newStage);
      const closedAt = (stageObj?.is_won || stageObj?.is_lost) ? new Date().toISOString() : null;
      const { error } = await supabase.from("opportunities").update({ stage: newStage, closed_at: closedAt }).eq("id", id!);
      if (error) throw error;
      const oldStage = stages.find(s => s.code === opp?.stage);
      await logActivity("stage_change", `Stage: ${oldStage?.name_sr || opp?.stage} → ${stageObj?.name_sr || newStage}`, { from: opp?.stage, to: newStage });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["opportunity", id] }); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  const partialWonMutation = useMutation({
    mutationFn: async (data: { won_amount: number; lost_amount: number; won_reason: string; lost_reason: string; create_followup: boolean }) => {
      const partialStage = stages.find(s => (s as any).is_partial);
      if (!partialStage) throw new Error("Partial won stage not found");

      const updates: any = {
        stage: partialStage.code,
        won_amount: data.won_amount,
        lost_amount: data.lost_amount,
        won_reason: data.won_reason || null,
        lost_reason: data.lost_reason || null,
        closed_at: new Date().toISOString(),
      };

      // Create follow-up opportunity if requested
      if (data.create_followup && data.lost_amount > 0) {
        const { data: followup, error: fErr } = await supabase.from("opportunities").insert([{
          tenant_id: tenantId!,
          title: `${opp!.title} — Follow-up`,
          partner_id: opp!.partner_id,
          contact_id: opp!.contact_id,
          lead_id: opp!.lead_id,
          value: data.lost_amount,
          currency: opp!.currency || "RSD",
          probability: 30,
          stage: stages[0]?.code || "qualification",
          description: `Follow-up from partially won deal. Lost reason: ${data.lost_reason || "—"}`,
        }]).select("id").single();
        if (fErr) throw fErr;
        if (followup) updates.followup_opportunity_id = followup.id;
      }

      const { error } = await supabase.from("opportunities").update(updates).eq("id", id!);
      if (error) throw error;
      await logActivity("partial_won", `Deal partially won: ${data.won_amount} won, ${data.lost_amount} lost`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity", id] });
      setPartialWonOpen(false);
      toast.success(t("success"));
    },
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
      await logActivity("quote_created", `Quote created: ${quoteNumber}`);
    },
    onSuccess: () => { toast.success(t("conversionSuccess")); navigate("/sales/quotes"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFollowerMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("opportunity_followers" as any).insert([{
        tenant_id: tenantId!,
        opportunity_id: id!,
        user_id: userId,
      }]);
      if (error) throw error;
      const member = tenantMembers.find((m: any) => m.user_id === userId);
      await logActivity("follower_added", `Follower added: ${member?.profiles?.full_name || userId.slice(0, 8)}`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["opportunity-followers", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeFollowerMutation = useMutation({
    mutationFn: async (followerId: string) => {
      const { error } = await supabase.from("opportunity_followers" as any).delete().eq("id", followerId).eq("tenant_id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["opportunity-followers", id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const fmt = useMemo(() => {
    if (!opp) return (n: number) => String(n);
    return (n: number) => new Intl.NumberFormat("sr-RS", { style: "currency", currency: opp.currency || "RSD" }).format(n);
  }, [opp?.currency]);

  const isClosed = useMemo(() => stages.some(s => s.code === opp?.stage && (s.is_won || s.is_lost || (s as any).is_partial)), [stages, opp?.stage]);
  const currentStage = useMemo(() => stages.find(s => s.code === opp?.stage), [stages, opp?.stage]);
  const currentStageIdx = useMemo(() => stages.findIndex(s => s.code === opp?.stage), [stages, opp?.stage]);
  const contactName = useMemo(() => {
    if (!opp) return "—";
    return opp.contacts ? `${opp.contacts.first_name} ${opp.contacts.last_name || ""}` : opp.leads ? (opp.leads.first_name || opp.leads.name) : opp.partners?.name || "—";
  }, [opp]);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!opp) return <div className="text-center py-20 text-muted-foreground">{t("noResults")}</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/crm/opportunities")}>
            <ArrowLeft className="h-4 w-4 mr-1" />{t("back")}
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold truncate">{opp.title}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap pl-9 sm:pl-0">
          <Badge
            variant={currentStage?.is_won ? "default" : currentStage?.is_lost ? "destructive" : "secondary"}
            style={currentStage?.color ? { backgroundColor: currentStage.color, color: "#fff" } : undefined}
          >
            {currentStage?.name_sr || currentStage?.name || opp.stage}
          </Badge>
          <OpportunityTagsBar opportunityId={id!} tenantId={tenantId!} onActivity={logActivity} />
        </div>
      </div>

      {/* Stage progression */}
      {!isClosed && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("stage")}</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-2 px-2 pb-1">
              <div className="flex gap-1 min-w-max">
                {stages.map((s, idx) => {
                  const isActive = opp.stage === s.code;
                  const isPast = idx < currentStageIdx;
                  return (
                    <Button
                      key={s.code}
                      variant={isActive ? "default" : isPast ? "secondary" : "outline"}
                      size="sm"
                      className={cn("relative gap-1.5", isPast && "opacity-80")}
                      style={isActive && s.color ? { backgroundColor: s.color, color: "#fff" } : undefined}
                      onClick={() => {
                        if ((s as any).is_partial) {
                          setPartialWonOpen(true);
                        } else {
                          stageMutation.mutate(s.code);
                        }
                      }}
                      disabled={stageMutation.isPending}
                    >
                      {isPast && <Check className="h-3 w-3" />}
                      {s.name_sr || s.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed content */}
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-max">
            <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
            <TabsTrigger value="documents">{t("documents")}</TabsTrigger>
            <TabsTrigger value="discussion">{t("discussion")}</TabsTrigger>
            <TabsTrigger value="activity">{t("activityLog")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <OpportunityOverviewTab
            opp={opp}
            isClosed={isClosed}
            fmt={fmt}
            contactName={contactName}
            oppPartners={oppPartners}
            oppMeetings={oppMeetings}
            followers={followers}
            tenantMembers={tenantMembers}
            onCreateQuote={() => createQuoteMutation.mutate()}
            onLogMeeting={() => navigate(`/crm/meetings?opportunity=${id}&partner=${opp.partner_id || ""}`)}
            onAddFollower={(userId) => addFollowerMutation.mutate(userId)}
            onRemoveFollower={(followerId) => removeFollowerMutation.mutate(followerId)}
            createQuotePending={createQuoteMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="documents">
          <OpportunityDocumentsTab opportunityId={id!} tenantId={tenantId!} onActivity={logActivity} />
        </TabsContent>

        <TabsContent value="discussion">
          <OpportunityDiscussionTab opportunityId={id!} tenantId={tenantId!} tenantMembers={tenantMembers} onActivity={logActivity} />
        </TabsContent>

        <TabsContent value="activity">
          <OpportunityActivityTab opportunityId={id!} />
        </TabsContent>
      </Tabs>

      {opp && (
        <PartialWonDialog
          open={partialWonOpen}
          onOpenChange={setPartialWonOpen}
          dealValue={opp.value || 0}
          currency={opp.currency || "RSD"}
          onSubmit={(data) => partialWonMutation.mutate(data)}
          isPending={partialWonMutation.isPending}
        />
      )}
    </div>
  );
}
