import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, Plus, CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react";
import { format } from "date-fns";

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-warning" />,
  approved: <CheckCircle className="h-4 w-4 text-success" />,
  rejected: <XCircle className="h-4 w-4 text-destructive" />,
  completed: <CheckCircle className="h-4 w-4 text-primary" />,
};

export default function DocumentApprovals() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [initDialogOpen, setInitDialogOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");

  // Fetch active document workflows
  const { data: docWorkflows = [], isLoading } = useQuery({
    queryKey: ["document_workflows", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("document_workflows" as any)
        .select("*, documents(name, status), approval_workflows(name, min_approvers)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch approval workflows configured for documents
  const { data: workflows = [] } = useQuery({
    queryKey: ["approval_workflows_docs", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("approval_workflows")
        .select("id, name, entity_type, min_approvers")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .in("entity_type", ["document", "all"]);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch pending documents for workflow initiation
  const { data: pendingDocs = [] } = useQuery({
    queryKey: ["pending_docs_for_approval", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("documents")
        .select("id, name, status")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "draft"])
        .order("name")
        .limit(100);
      return data || [];
    },
    enabled: !!tenantId && initDialogOpen,
  });

  // Fetch approval steps for a workflow
  const { data: approvalSteps = [] } = useQuery({
    queryKey: ["doc_approval_steps", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("document_approval_steps" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const initiateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDocId || !selectedWorkflowId) throw new Error("Select document and workflow");
      const { error } = await supabase.from("document_workflows" as any).insert({
        tenant_id: tenantId!,
        document_id: selectedDocId,
        workflow_id: selectedWorkflowId,
        status: "pending",
        initiated_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document_workflows"] });
      setInitDialogOpen(false);
      toast({ title: t("workflowInitiated") || "Radni tok pokrenut" });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ workflowId, action, comment }: { workflowId: string; action: string; comment?: string }) => {
      // Add approval step
      const { error: stepErr } = await supabase.from("document_approval_steps" as any).insert({
        tenant_id: tenantId!,
        document_workflow_id: workflowId,
        approver_user_id: user?.id!,
        action,
        comment: comment || null,
        acted_at: new Date().toISOString(),
      });
      if (stepErr) throw stepErr;

      // Check if enough approvals
      const wf = docWorkflows.find((w: any) => w.id === workflowId);
      const minApprovers = (wf as any)?.approval_workflows?.min_approvers || 1;
      const currentSteps = approvalSteps.filter((s: any) => s.document_workflow_id === workflowId && s.action === "approve");

      if (action === "reject") {
        await supabase.from("document_workflows" as any).update({ status: "rejected" }).eq("id", workflowId);
      } else if (currentSteps.length + 1 >= minApprovers) {
        await supabase.from("document_workflows" as any).update({ status: "approved", completed_at: new Date().toISOString() }).eq("id", workflowId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document_workflows"] });
      queryClient.invalidateQueries({ queryKey: ["doc_approval_steps"] });
      toast({ title: t("actionCompleted") || "Akcija završena" });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            {t("documentApprovals") || "Odobravanje dokumenata"}
          </h1>
          <p className="text-muted-foreground text-sm">{t("documentApprovalsDesc") || "Upravljajte tokovima odobravanja dokumenata"}</p>
        </div>
        <Button onClick={() => setInitDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("initiateApproval") || "Pokreni odobravanje"}
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">{t("loading")}</p>}

      <div className="space-y-3">
        {docWorkflows.map((dw: any) => {
          const steps = approvalSteps.filter((s: any) => s.document_workflow_id === dw.id);
          const isPending = dw.status === "pending";

          return (
            <Card key={dw.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {STATUS_ICONS[dw.status] || STATUS_ICONS.pending}
                    <div>
                      <p className="font-medium">{(dw as any).documents?.name || "Dokument"}</p>
                      <p className="text-xs text-muted-foreground">
                        {(dw as any).approval_workflows?.name} • {format(new Date(dw.created_at), "dd.MM.yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={dw.status === "approved" ? "default" : dw.status === "rejected" ? "destructive" : "outline"}>
                      {dw.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {steps.filter((s: any) => s.action === "approve").length}/{(dw as any).approval_workflows?.min_approvers || 1}
                    </span>
                    {isPending && (
                      <div className="flex gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-success gap-1"
                          onClick={() => approveMutation.mutate({ workflowId: dw.id, action: "approve" })}
                        >
                          <CheckCircle className="h-3 w-3" />
                          {t("approve") || "Odobri"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive gap-1"
                          onClick={() => approveMutation.mutate({ workflowId: dw.id, action: "reject" })}
                        >
                          <XCircle className="h-3 w-3" />
                          {t("reject") || "Odbij"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                {steps.length > 0 && (
                  <div className="mt-3 pl-7 space-y-1">
                    {steps.map((step: any) => (
                      <div key={step.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ArrowRight className="h-3 w-3" />
                        <Badge variant={step.action === "approve" ? "default" : "destructive"} className="text-xs">{step.action}</Badge>
                        <span>{step.acted_at ? format(new Date(step.acted_at), "dd.MM.yyyy HH:mm") : ""}</span>
                        {step.comment && <span className="italic">"{step.comment}"</span>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {!isLoading && docWorkflows.length === 0 && (
          <p className="text-center text-muted-foreground py-8">{t("noWorkflows") || "Nema aktivnih tokova odobravanja"}</p>
        )}
      </div>

      {/* Initiate Approval Dialog */}
      <Dialog open={initDialogOpen} onOpenChange={setInitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("initiateApproval") || "Pokreni odobravanje"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedDocId} onValueChange={setSelectedDocId}>
              <SelectTrigger><SelectValue placeholder={t("selectDocument") || "Izaberite dokument"} /></SelectTrigger>
              <SelectContent>
                {pendingDocs.map((doc: any) => (
                  <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedWorkflowId} onValueChange={setSelectedWorkflowId}>
              <SelectTrigger><SelectValue placeholder={t("selectWorkflow") || "Izaberite tok"} /></SelectTrigger>
              <SelectContent>
                {workflows.map((wf: any) => (
                  <SelectItem key={wf.id} value={wf.id}>{wf.name} ({wf.min_approvers} {t("approvers") || "odobravača"})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInitDialogOpen(false)}>{t("cancel")}</Button>
            <Button disabled={!selectedDocId || !selectedWorkflowId || initiateMutation.isPending} onClick={() => initiateMutation.mutate()}>
              {t("start") || "Pokreni"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
