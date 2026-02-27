import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface UseDiscountApprovalOptions {
  tenantId: string | null;
  quoteId: string | null;
  discountPct: number;
}

export function useDiscountApproval({ tenantId, quoteId, discountPct }: UseDiscountApprovalOptions) {
  const { user, roles } = useAuth();

  // Fetch the discount rule for the user's role
  const { data: rule } = useQuery({
    queryKey: ["discount-approval-rule", tenantId, roles],
    queryFn: async () => {
      if (!tenantId || roles.length === 0) return null;
      const { data } = await supabase
        .from("discount_approval_rules")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("role", roles)
        .order("max_discount_pct", { ascending: false })
        .limit(1);
      return (data as any)?.[0] || null;
    },
    enabled: !!tenantId && roles.length > 0,
  });

  // Fetch existing approval request for this quote
  const { data: approvalRequest, refetch: refetchApproval } = useQuery({
    queryKey: ["discount-approval-request", tenantId, quoteId],
    queryFn: async () => {
      if (!tenantId || !quoteId) return null;
      const { data } = await supabase
        .from("approval_requests")
        .select("id, status")
        .eq("tenant_id", tenantId)
        .eq("entity_type", "quote_discount")
        .eq("entity_id", quoteId)
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!tenantId && !!quoteId,
  });

  const maxAllowed = rule?.max_discount_pct ?? 100;
  const threshold = rule?.requires_approval_above ?? rule?.max_discount_pct ?? 100;
  const needsApproval = discountPct > threshold;
  const approvalStatus: "none" | "pending" | "approved" | "rejected" =
    !approvalRequest ? "none" : (approvalRequest.status as any);

  const submitForApproval = async () => {
    if (!tenantId || !quoteId || !user) return;

    // Find a workflow for quote_discount
    const { data: workflow } = await supabase
      .from("approval_workflows")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("entity_type", "quote_discount")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!workflow) {
      // Auto-create a basic workflow
      const { data: newWf, error: wfErr } = await supabase
        .from("approval_workflows")
        .insert({
          tenant_id: tenantId,
          name: "Discount Approval",
          entity_type: "quote_discount",
          min_approvers: 1,
          required_roles: ["admin", "manager"],
          is_active: true,
        })
        .select("id")
        .single();
      if (wfErr) { toast.error(wfErr.message); return; }
      await createRequest(newWf!.id);
    } else {
      await createRequest(workflow.id);
    }
  };

  const createRequest = async (workflowId: string) => {
    if (!tenantId || !quoteId || !user) return;
    const { error } = await supabase.from("approval_requests").insert({
      tenant_id: tenantId,
      workflow_id: workflowId,
      entity_type: "quote_discount",
      entity_id: quoteId,
      requested_by: user.id,
      status: "pending",
    });
    if (error) { toast.error(error.message); return; }

    try {
      await Promise.all([
        supabase.functions.invoke("process-module-event", {
          body: {
            tenant_id: tenantId,
            event_type: "approval.requested",
            source_module: "crm",
            payload: { entity_type: "quote_discount", entity_id: quoteId, discount_pct: 0 },
          },
        }),
        supabase.functions.invoke("create-notification", {
          body: {
            tenant_id: tenantId,
            type: "approval_required",
            title: "Discount Approval Required",
            message: `A quote discount requires approval.`,
          },
        }),
      ]);
    } catch { /* non-critical */ }

    refetchApproval();
    toast.info("Approval request submitted.");
  };

  return { needsApproval, maxAllowed, approvalStatus, submitForApproval };
}
