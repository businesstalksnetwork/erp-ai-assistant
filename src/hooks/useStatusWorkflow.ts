import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";

interface UseStatusWorkflowOptions {
  table: string;
  queryKey: string[];
}

export function useStatusWorkflow({ table, queryKey }: UseStatusWorkflowOptions) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await (supabase.from(table as any) as any)
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: t("success") });
    },
    onError: (err: any) =>
      toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  return statusMutation;
}
