// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Partner {
  id: string;
  name: string;
  code: string;
  discount_percent: number;
  free_trial_days: number;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerUser {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  created_at: string;
}

export function usePartners() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Partner[];
    },
  });

  const { data: partnerStats = {} } = useQuery({
    queryKey: ["partner-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("partner_id")
        .not("partner_id", "is", null);

      if (error) throw error;

      const stats: Record<string, number> = {};
      data.forEach((profile) => {
        if (profile.partner_id) {
          stats[profile.partner_id] = (stats[profile.partner_id] || 0) + 1;
        }
      });
      return stats;
    },
  });

  const { data: partnerUsers = {} } = useQuery({
    queryKey: ["partner-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, company_name, created_at, partner_id")
        .not("partner_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const usersByPartner: Record<string, PartnerUser[]> = {};
      data.forEach((profile) => {
        if (profile.partner_id) {
          if (!usersByPartner[profile.partner_id]) {
            usersByPartner[profile.partner_id] = [];
          }
          usersByPartner[profile.partner_id].push({
            id: profile.id,
            email: profile.email || "",
            full_name: profile.full_name,
            company_name: profile.company_name,
            created_at: profile.created_at,
          });
        }
      });
      return usersByPartner;
    },
  });

  const createPartner = useMutation({
    mutationFn: async (data: Omit<Partner, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("partners").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast({ title: "Partner uspešno dodat" });
    },
    onError: (error: Error) => {
      toast({
        title: "Greška pri dodavanju partnera",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePartner = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<Partner> & { id: string }) => {
      const { error } = await supabase
        .from("partners")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast({ title: "Partner uspešno ažuriran" });
    },
    onError: (error: Error) => {
      toast({
        title: "Greška pri ažuriranju partnera",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePartner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner-users"] });
      toast({ title: "Partner uspešno obrisan" });
    },
    onError: (error: Error) => {
      toast({
        title: "Greška pri brisanju partnera",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    partners,
    partnerStats,
    partnerUsers,
    isLoading,
    createPartner,
    updatePartner,
    deletePartner,
  };
}
