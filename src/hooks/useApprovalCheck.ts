import { useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ApprovalCheckHook {
  checkAndRequestApproval: (
    entityType: string,
    entityId: string,
    amount: number,
    onApproved: () => void | Promise<void>
  ) => Promise<void>;
}

export function useApprovalCheck(): ApprovalCheckHook {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();

  const checkAndRequestApproval = useCallback(async (
    entityType: string,
    entityId: string,
    amount: number,
    onApproved: () => void | Promise<void>,
  ) => {
    if (!tenantId) return;

    // 1. Find matching workflow
    const { data: workflows } = await supabase
      .from("approval_workflows")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("entity_type", entityType)
      .eq("is_active", true)
      .order("threshold_amount", { ascending: true });

    const workflow = (workflows || []).find(
      (w: any) => !w.threshold_amount || amount >= w.threshold_amount
    );

    if (!workflow) {
      // No workflow → auto-approve
      await onApproved();
      return;
    }

    // 2. Check if user has required role (auto-approve if they do)
    const { data: membership } = await supabase
      .from("user_tenants")
      .select("role")
      .eq("user_id", user?.id || "")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (membership && workflow.required_roles.includes(membership.role)) {
      await onApproved();
      return;
    }

    // 3. Check for existing pending request
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
      toast.error(t("approvalPending") || "Approval is already pending for this item.");
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

    toast.info(t("approvalSubmitted") || "Approval request submitted. Action requires approval before proceeding.");
  }, [tenantId, user, t]);

  return { checkAndRequestApproval };
}
