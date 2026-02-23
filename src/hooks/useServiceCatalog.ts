import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ServiceCatalogItem {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  item_type: "services" | "products";
  default_unit_price: number | null;
  default_foreign_price: number | null;
  foreign_currency: string | null;
  unit: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ServiceCatalogInsert = Omit<ServiceCatalogItem, "id" | "created_at" | "updated_at">;
export type ServiceCatalogUpdate = Partial<Omit<ServiceCatalogItem, "id" | "company_id" | "created_at" | "updated_at">>;

export function useServiceCatalog(companyId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["service-catalog", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from("service_catalog")
        .select("*")
        .eq("company_id", companyId)
        .order("name");

      if (error) throw error;
      return data as ServiceCatalogItem[];
    },
    enabled: !!companyId,
  });

  const createService = useMutation({
    mutationFn: async (service: ServiceCatalogInsert) => {
      const { data, error } = await supabase
        .from("service_catalog")
        .insert(service)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-catalog", companyId] });
      toast({
        title: "Uspešno",
        description: "Stavka je dodata u šifarnik.",
      });
    },
    onError: (error) => {
      toast({
        title: "Greška",
        description: "Nije moguće dodati stavku: " + error.message,
        variant: "destructive",
      });
    },
  });

  const updateService = useMutation({
    mutationFn: async ({ id, ...updates }: ServiceCatalogUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("service_catalog")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-catalog", companyId] });
      toast({
        title: "Uspešno",
        description: "Stavka je ažurirana.",
      });
    },
    onError: (error) => {
      toast({
        title: "Greška",
        description: "Nije moguće ažurirati stavku: " + error.message,
        variant: "destructive",
      });
    },
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("service_catalog")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-catalog", companyId] });
      toast({
        title: "Uspešno",
        description: "Stavka je obrisana iz šifarnika.",
      });
    },
    onError: (error) => {
      toast({
        title: "Greška",
        description: "Nije moguće obrisati stavku: " + error.message,
        variant: "destructive",
      });
    },
  });

  return {
    services,
    activeServices: services.filter((s) => s.is_active),
    isLoading,
    createService,
    updateService,
    deleteService,
  };
}
