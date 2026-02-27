import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

export function useLeaveRequest(employeeId: string | undefined) {
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  const ownRequests = useQuery({
    queryKey: ["my-leave-requests", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("employee_id", employeeId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
  });

  const validate = async (startDate: string, endDate: string, leaveType: string) => {
    const { data, error } = await supabase.rpc("validate_leave_request", {
      p_employee_id: employeeId!,
      p_tenant_id: tenantId!,
      p_start_date: startDate,
      p_end_date: endDate,
      p_leave_type: leaveType,
    });
    if (error) throw error;
    return data as { valid: boolean; days?: number; error?: string; available?: number; requested?: number };
  };

  const submitMutation = useMutation({
    mutationFn: async (params: {
      leaveType: string;
      startDate: string;
      endDate: string;
      reason?: string;
    }) => {
      const { data, error } = await supabase.rpc("submit_leave_request", {
        p_employee_id: employeeId!,
        p_tenant_id: tenantId!,
        p_leave_type: params.leaveType,
        p_start_date: params.startDate,
        p_end_date: params.endDate,
        p_reason: params.reason || null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: async (requestId) => {
      qc.invalidateQueries({ queryKey: ["my-leave-requests"] });
      qc.invalidateQueries({ queryKey: ["profile-leave-balance"] });
      toast.success("Zahtev za odsustvo je poslat");

      // Notify HR/admin roles about the new leave request
      try {
        if (employeeId && tenantId) {
          const { data: emp } = await supabase
            .from("employees")
            .select("first_name, last_name")
            .eq("id", employeeId)
            .single();

          const empName = emp ? `${emp.first_name} ${emp.last_name}` : "Employee";

          // Get HR-related user IDs from tenant_members
          const { data: hrUsers } = await supabase
            .from("tenant_members")
            .select("user_id")
            .eq("tenant_id", tenantId)
            .in("role", ["admin", "hr_manager", "finance_director"]);

          const targetIds = hrUsers?.map((u) => u.user_id) || [];

          if (targetIds.length > 0) {
            await supabase.functions.invoke("create-notification", {
              body: {
                tenant_id: tenantId,
                target_user_ids: targetIds,
                type: "info",
                category: "hr",
                title: "Novi zahtev za odsustvo",
                message: `${empName} je podneo/la zahtev za odsustvo.`,
                entity_type: "leave_request",
                entity_id: requestId,
              },
            });
          }
        }
      } catch {
        // Notification failure should not block the success flow
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: "cancelled" as any })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-leave-requests"] });
      qc.invalidateQueries({ queryKey: ["profile-leave-balance"] });
      toast.success("Zahtev otkazan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ownRequests, validate, submitMutation, cancelMutation };
}
