import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Check, X } from "lucide-react";

export default function PendingApprovals() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [actionDialog, setActionDialog] = useState<{ request: any; action: "approved" | "rejected" } | null>(null);
  const [comment, setComment] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["pending-approvals", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("approval_requests")
        .select("*, approval_workflows(name, min_approvers, required_roles)")
        .eq("tenant_id", tenantId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch step counts for each request
      const ids = (data || []).map((r: any) => r.id);
      if (ids.length === 0) return [];
      const { data: steps } = await supabase
        .from("approval_steps")
        .select("request_id, action")
        .in("request_id", ids);

      const stepCounts: Record<string, number> = {};
      (steps || []).forEach((s: any) => {
        if (s.action === "approved") {
          stepCounts[s.request_id] = (stepCounts[s.request_id] || 0) + 1;
        }
      });

      return (data || []).map((r: any) => ({
        ...r,
        approved_steps: stepCounts[r.id] || 0,
      }));
    },
    enabled: !!tenantId,
  });

  const actMutation = useMutation({
    mutationFn: async ({ requestId, action, workflowMinApprovers }: { requestId: string; action: "approved" | "rejected"; workflowMinApprovers: number }) => {
      // Insert step
      await supabase.from("approval_steps").insert({
        request_id: requestId,
        approver_user_id: user!.id,
        action,
        comment: comment || null,
        tenant_id: tenantId!,
      });

      if (action === "rejected") {
        // Immediate rejection
        await supabase.from("approval_requests").update({ status: "rejected" }).eq("id", requestId);
      } else {
        // Check if we've reached min_approvers
        const { count } = await supabase
          .from("approval_steps")
          .select("id", { count: "exact", head: true })
          .eq("request_id", requestId)
          .eq("action", "approved");

        if ((count || 0) >= workflowMinApprovers) {
          await supabase.from("approval_requests").update({ status: "approved" }).eq("id", requestId);
        }
      }

      // Fire notification
      try {
        await supabase.functions.invoke("create-notification", {
          body: {
            tenant_id: tenantId,
            type: action === "approved" ? "approval_approved" : "approval_rejected",
            title: `Approval ${action}`,
            message: `Your ${action === "approved" ? "request was approved" : "request was rejected"}${comment ? `: ${comment}` : ""}`,
          },
        });
      } catch { /* non-critical */ }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-approvals"] });
      const action = actionDialog?.action;
      toast({ title: action === "approved" ? t("requestApproved") : t("requestRejected") });
      setActionDialog(null);
      setComment("");
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const handleAction = () => {
    if (!actionDialog) return;
    actMutation.mutate({
      requestId: actionDialog.request.id,
      action: actionDialog.action,
      workflowMinApprovers: actionDialog.request.approval_workflows?.min_approvers || 1,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pendingApprovalsPage")}
        description={t("pendingApprovalsDesc")}
        icon={CheckSquare}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("entityType")}</TableHead>
                <TableHead>{t("workflowName")}</TableHead>
                <TableHead>{t("requestedBy")}</TableHead>
                <TableHead>{t("stepsCompleted")}</TableHead>
                <TableHead>{t("createdAt")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6}>{t("loading")}</TableCell></TableRow>
              ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noApprovalsPending")}</TableCell></TableRow>
              ) : requests.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell><Badge variant="outline">{r.entity_type}</Badge></TableCell>
                  <TableCell>{r.approval_workflows?.name || "-"}</TableCell>
                  <TableCell className="text-sm">{r.requested_by || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={r.approved_steps >= (r.approval_workflows?.min_approvers || 1) ? "default" : "secondary"}>
                      {r.approved_steps} / {r.approval_workflows?.min_approvers || 1}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => { setActionDialog({ request: r, action: "approved" }); setComment(""); }}>
                        <Check className="h-3 w-3 mr-1" />{t("approveRequest")}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => { setActionDialog({ request: r, action: "rejected" }); setComment(""); }}>
                        <X className="h-3 w-3 mr-1" />{t("rejectRequest")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog?.action === "approved" ? t("approveRequest") : t("rejectRequest")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("approvalComment")} ({t("optional")})</Label>
              <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder={t("approvalComment")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>{t("cancel")}</Button>
            <Button
              variant={actionDialog?.action === "rejected" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={actMutation.isPending}
            >
              {actionDialog?.action === "approved" ? t("approveRequest") : t("rejectRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
