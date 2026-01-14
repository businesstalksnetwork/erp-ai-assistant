import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ForeignPaymentInstruction {
  id: string;
  company_id: string;
  currency: string;
  instructions: string;
  created_at: string;
  updated_at: string;
}

interface CreateInstructionData {
  company_id: string;
  currency: string;
  instructions: string;
}

interface UpdateInstructionData {
  id: string;
  currency?: string;
  instructions?: string;
}

export function useForeignPaymentInstructions(companyId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: instructions, isLoading, error } = useQuery({
    queryKey: ['foreign-payment-instructions', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await supabase
        .from('foreign_payment_instructions')
        .select('*')
        .eq('company_id', companyId)
        .order('currency');
      
      if (error) throw error;
      return data as ForeignPaymentInstruction[];
    },
    enabled: !!companyId,
  });

  const createInstruction = useMutation({
    mutationFn: async (data: CreateInstructionData) => {
      const { data: result, error } = await supabase
        .from('foreign_payment_instructions')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foreign-payment-instructions', companyId] });
      toast({
        title: 'Uspešno',
        description: 'Instrukcija za plaćanje je sačuvana.',
      });
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast({
          title: 'Greška',
          description: 'Instrukcija za ovu valutu već postoji.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Greška',
          description: 'Nije moguće sačuvati instrukciju.',
          variant: 'destructive',
        });
      }
    },
  });

  const updateInstruction = useMutation({
    mutationFn: async ({ id, ...data }: UpdateInstructionData) => {
      const { data: result, error } = await supabase
        .from('foreign_payment_instructions')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foreign-payment-instructions', companyId] });
      toast({
        title: 'Uspešno',
        description: 'Instrukcija za plaćanje je ažurirana.',
      });
    },
    onError: () => {
      toast({
        title: 'Greška',
        description: 'Nije moguće ažurirati instrukciju.',
        variant: 'destructive',
      });
    },
  });

  const deleteInstruction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('foreign_payment_instructions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foreign-payment-instructions', companyId] });
      toast({
        title: 'Uspešno',
        description: 'Instrukcija za plaćanje je obrisana.',
      });
    },
    onError: () => {
      toast({
        title: 'Greška',
        description: 'Nije moguće obrisati instrukciju.',
        variant: 'destructive',
      });
    },
  });

  const getInstructionByCurrency = (currency: string): ForeignPaymentInstruction | undefined => {
    return instructions?.find(i => i.currency === currency);
  };

  return {
    instructions: instructions || [],
    isLoading,
    error,
    createInstruction,
    updateInstruction,
    deleteInstruction,
    getInstructionByCurrency,
  };
}
