import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Reminder {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  amount: number | null;
  due_date: string;
  reminder_date: string | null;
  is_completed: boolean;
  created_at: string;
}

export function useReminders(companyId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_reminders')
        .select('*')
        .eq('company_id', companyId!)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data as Reminder[];
    },
    enabled: !!companyId,
  });

  const createReminder = useMutation({
    mutationFn: async (reminder: Omit<Reminder, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('payment_reminders')
        .insert(reminder)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast({ title: 'Podsetnik je kreiran' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  const updateReminder = useMutation({
    mutationFn: async ({ id, ...reminder }: Partial<Reminder> & { id: string }) => {
      const { data, error } = await supabase
        .from('payment_reminders')
        .update(reminder)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast({ title: 'Podsetnik je ažuriran' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payment_reminders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast({ title: 'Podsetnik je obrisan' });
    },
    onError: (error: Error) => {
      toast({ title: 'Greška', description: error.message, variant: 'destructive' });
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase
        .from('payment_reminders')
        .update({ is_completed })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  const upcomingReminders = reminders.filter(r => {
    if (r.is_completed) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminderDate = r.reminder_date ? new Date(r.reminder_date) : new Date(r.due_date);
    return reminderDate <= today;
  });

  return {
    reminders,
    upcomingReminders,
    isLoading,
    createReminder,
    updateReminder,
    deleteReminder,
    toggleComplete,
  };
}
