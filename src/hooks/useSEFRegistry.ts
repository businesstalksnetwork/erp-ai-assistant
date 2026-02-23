// @ts-nocheck
import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SEFRegistryResult {
  found: boolean;
  isActive: boolean;
  registrationDate?: string;
  deletionDate?: string;
}

export function useSEFRegistry() {
  const [isChecking, setIsChecking] = useState(false);

  const checkPibInRegistry = useCallback(async (pib: string): Promise<SEFRegistryResult> => {
    if (!pib || pib.length !== 9) {
      return { found: false, isActive: false };
    }

    setIsChecking(true);
    
    try {
      const { data, error } = await supabase
        .from('sef_registry')
        .select('pib, registration_date, deletion_date')
        .eq('pib', pib.trim())
        .maybeSingle();

      if (error) {
        console.error('SEF registry check error:', error);
        return { found: false, isActive: false };
      }

      if (!data) {
        return { found: false, isActive: false };
      }

      return {
        found: true,
        isActive: !data.deletion_date, // Active if no deletion date
        registrationDate: data.registration_date,
        deletionDate: data.deletion_date,
      };
    } catch (error) {
      console.error('SEF registry check error:', error);
      return { found: false, isActive: false };
    } finally {
      setIsChecking(false);
    }
  }, []);

  const getRegistryStats = useCallback(async () => {
    const { count: total } = await supabase
      .from('sef_registry')
      .select('*', { count: 'exact', head: true });

    const { count: active } = await supabase
      .from('sef_registry')
      .select('*', { count: 'exact', head: true })
      .is('deletion_date', null);

    return {
      total: total || 0,
      active: active || 0,
      deleted: (total || 0) - (active || 0),
    };
  }, []);

  return {
    checkPibInRegistry,
    getRegistryStats,
    isChecking,
  };
}
