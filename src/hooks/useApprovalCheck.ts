import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

export function useApprovalCheck(tenantId: string | null, entityType: string) {
  const { user } = useAuth();
  const { t } = useLanguage();

  const checkApproval = async (
    entityId: string,
    amount: number,
    onApproved: () => void | Promise<void>
  ) => {
    if (!tenantId) {
      await onApproved();
      return;
    }

    // 1. Find active workflow for this entity type
    const { data: workflow } = await supabase
      .from("approval_workflows")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("entity_type", entityType)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    // No workflow → proceed immediately
    if (!workflow) {
      await onApproved();
      return;
    }

    // Amount below threshold → proceed
    if (workflow.threshold_amount && amount < workflow.threshold_amount) {
      await onApproved();
      return;
    }

    // 2. Check if already approved
    const { data: existingApproval } = await supabase
      .from("approval_requests")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("status", "approved")
      .limit(1)
      .maybeSingle();

    if (existingApproval) {
      await onApproved();
      return;
    }

    // 3. Check if pending request already exists
    const { data: pendingRequest } = await supabase
      .from("approval_requests")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (pendingRequest) {
      toast.error(t("approvalPending" as any) || "Approval is already pending for this item.");
      return;
    }

    // 4. Create approval request
    const { error } = await supabase.from("approval_requests").insert([{
      tenant_id: tenantId,
      workflow_id: workflow.id,
      entity_type: entityType,
      entity_id: entityId,
      requested_by: user?.id || null,
      status: "pending",
    }]);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Fire module event + notification
    try {
      await Promise.all([
        supabase.functions.invoke("process-module-event", {
          body: {
            tenant_id: tenantId,
            event_type: "approval.requested",
            source_module: "approvals",
            payload: { entity_type: entityType, entity_id: entityId, amount },
          },
        }),
        supabase.functions.invoke("create-notification", {
          body: {
            tenant_id: tenantId,
            type: "approval_required",
            title: "Approval Required",
            message: `A ${entityType} requires approval (amount: ${amount}).`,
          },
        }),
      ]);
    } catch {
      // Non-critical
    }

    toast.info(t("approvalSubmitted" as any) || "Approval request submitted. Action requires approval before proceeding.");
  };

  return { checkApproval };
}
