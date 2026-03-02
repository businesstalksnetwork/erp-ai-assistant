import { useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ApprovalCheckHook {
  checkApproval: (
    entityId: string,
    amount: number,
    onApproved: () => void | Promise<void>
  ) => Promise<void>;
  checkAndRequestApproval: (
    entityType: string,
    entityId: string,
    amount: number,
    onApproved: () => void | Promise<void>
  ) => Promise<void>;
}

export function useApprovalCheck(tenantId?: string | null, entityType?: string): ApprovalCheckHook {
  const { t } = useLanguage();
  const { user } = useAuth();

  const checkAndRequestApproval = useCallback(async (
    et: string,
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
      .eq("entity_type", et)
      .eq("is_active", true)
      .order("threshold_amount", { ascending: true });

    const workflow = (workflows || []).find(
      (w: any) => !w.threshold_amount || amount >= w.threshold_amount
    );

    if (!workflow) {
      await onApproved();
      return;
    }

    // 2. Check if user has required role (auto-approve if they do)
    const { data: membership } = await supabase
      .from("tenant_members")
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
      .eq("entity_type", et)
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
      entity_type: et,
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
            payload: { entity_type: et, entity_id: entityId, amount },
          },
        }),
        supabase.functions.invoke("create-notification", {
          body: {
            tenant_id: tenantId,
            type: "approval_required",
            title: "Approval Required",
            message: `A ${et} requires approval (amount: ${amount}).`,
          },
        }),
      ]);
    } catch {
      // Non-critical
    }

    toast.info(t("approvalSubmitted") || "Approval request submitted. Action requires approval before proceeding.");
  }, [tenantId, user, t]);

  // Convenience wrapper when entityType is provided at hook level
  const checkApproval = useCallback(async (
    entityId: string,
    amount: number,
    onApproved: () => void | Promise<void>,
  ) => {
    await checkAndRequestApproval(entityType || "", entityId, amount, onApproved);
  }, [checkAndRequestApproval, entityType]);

  return { checkApproval, checkAndRequestApproval };
}
