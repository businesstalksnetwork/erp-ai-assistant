// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { uploadFile, getSignedUrl as getDoSignedUrl, isDoSpacesPath } from '@/lib/storage';

export interface Reminder {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  amount: number | null;
  due_date: string;
  reminder_date: string | null;
  is_completed: boolean;
  recurrence_type: 'none' | 'monthly' | 'quarterly' | 'yearly';
  recurrence_day: number | null;
  attachment_url: string | null;
  recipient_name: string | null;
  recipient_account: string | null;
  payment_model: string | null;
  payment_reference: string | null;
  payment_code: string | null;
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
      const reminder = reminders.find(r => r.id === id);
      
      // If completing a recurring reminder, create next occurrence
      if (is_completed && reminder?.recurrence_type !== 'none' && reminder?.recurrence_day) {
        const currentDue = new Date(reminder.due_date);
        const nextDate = new Date(currentDue);
        
        // Calculate next date based on recurrence type
        switch (reminder.recurrence_type) {
          case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case 'quarterly':
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
          case 'yearly':
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        }
        
        // Adjust day of month (handle months with fewer days)
        const maxDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        nextDate.setDate(Math.min(reminder.recurrence_day, maxDay));
        
        // Create next occurrence
        await supabase
          .from('payment_reminders')
          .insert({
            company_id: reminder.company_id,
            title: reminder.title,
            description: reminder.description,
            amount: reminder.amount,
            due_date: nextDate.toISOString().split('T')[0],
            reminder_date: reminder.reminder_date ? (() => {
              const diff = new Date(reminder.due_date).getTime() - new Date(reminder.reminder_date).getTime();
              return new Date(nextDate.getTime() - diff).toISOString().split('T')[0];
            })() : null,
            is_completed: false,
            recurrence_type: reminder.recurrence_type,
            recurrence_day: reminder.recurrence_day,
            attachment_url: reminder.attachment_url,
            recipient_name: reminder.recipient_name,
            recipient_account: reminder.recipient_account,
            payment_model: reminder.payment_model,
            payment_reference: reminder.payment_reference,
            payment_code: reminder.payment_code,
          });
      }

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

  // Upload attachment - now uses DigitalOcean Spaces
  const uploadAttachment = async (companyId: string, file: File): Promise<string> => {
    const result = await uploadFile({
      type: 'reminder',
      companyId,
      file,
    });

    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    return result.path!;
  };

  // Get signed URL - supports both old Supabase and new DO Spaces paths
  const getSignedUrl = async (path: string): Promise<string | null> => {
    if (isDoSpacesPath(path)) {
      // Get signed URL from DigitalOcean Spaces
      const result = await getDoSignedUrl(path, 3600);
      return result.success ? result.signedUrl! : null;
    } else {
      // Extract the path from the full URL if needed (old Supabase format)
      const pathOnly = path.includes('reminder-attachments/') 
        ? path.split('reminder-attachments/')[1] 
        : path;
      
      console.log('Getting signed URL for path:', pathOnly);
      
      const { data, error } = await supabase.storage
        .from('reminder-attachments')
        .createSignedUrl(pathOnly, 3600); // 1 hour

      if (error) {
        console.error('Error getting signed URL:', error);
        return null;
      }
      console.log('Signed URL generated:', data.signedUrl);
      return data.signedUrl;
    }
  };

  const upcomingReminders = reminders.filter(r => {
    if (r.is_completed) return false;
    
    // Get today's date in YYYY-MM-DD format for comparison
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Use reminder_date if set, otherwise use due_date
    const checkDate = r.reminder_date || r.due_date;
    
    // Compare date strings directly to avoid timezone issues
    return checkDate <= todayStr;
  });

  return {
    reminders,
    upcomingReminders,
    isLoading,
    createReminder,
    updateReminder,
    deleteReminder,
    toggleComplete,
    uploadAttachment,
    getSignedUrl,
  };
}
