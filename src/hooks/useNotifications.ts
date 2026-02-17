import { useEffect, useRef } from 'react';
import { useReminders } from './useReminders';
import { useLimits, LimitsData } from './useLimits';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

const LIMIT_WARNING_THRESHOLD_80 = 80; // percent - first warning
const LIMIT_WARNING_THRESHOLD_90 = 90; // percent - critical warning

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' RSD';
}

export function useNotifications(companyId: string | null) {
  const { isSubscriptionExpired, isAdmin, isBookkeeper } = useAuth();
  const skipNotifications = isSubscriptionExpired && !isAdmin && !isBookkeeper;
  const { upcomingReminders } = useReminders(companyId);
  const { limits } = useLimits(companyId);
  const notifiedIds = useRef<Set<string>>(new Set());
  const permissionAsked = useRef(false);
  const limitNotifiedRef = useRef<{ 
    limit6M_80: boolean; 
    limit6M_90: boolean; 
    limit8M_80: boolean; 
    limit8M_90: boolean; 
  }>({ limit6M_80: false, limit6M_90: false, limit8M_80: false, limit8M_90: false });

  // Request notification permission on mount
  useEffect(() => {
    if (permissionAsked.current) return;
    permissionAsked.current = true;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Load previous notification state from localStorage
  useEffect(() => {
    if (!companyId) return;
    const stored = localStorage.getItem(`limit_notified_${companyId}`);
    if (stored) {
      try {
        limitNotifiedRef.current = JSON.parse(stored);
      } catch {
        limitNotifiedRef.current = { limit6M_80: false, limit6M_90: false, limit8M_80: false, limit8M_90: false };
      }
    } else {
      limitNotifiedRef.current = { limit6M_80: false, limit6M_90: false, limit8M_80: false, limit8M_90: false };
    }
  }, [companyId]);

  // Check and show limit notifications
  useEffect(() => {
    if (!companyId || !limits || skipNotifications) return;

    const showLimitNotification = (title: string, body: string, key: 'limit6M_80' | 'limit6M_90' | 'limit8M_80' | 'limit8M_90') => {
      if (limitNotifiedRef.current[key]) return;

      limitNotifiedRef.current[key] = true;
      localStorage.setItem(`limit_notified_${companyId}`, JSON.stringify(limitNotifiedRef.current));

      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: `limit-${key}`,
        });

        notification.onclick = () => {
          window.focus();
          window.location.href = '/dashboard';
        };
      } else {
        // Fallback to toast
        toast.warning(title, { description: body });
      }
    };

    // Check 6M limit at 80% (first warning)
    if (limits.limit6MPercent >= LIMIT_WARNING_THRESHOLD_80 && limits.limit6MPercent < LIMIT_WARNING_THRESHOLD_90) {
      showLimitNotification(
        '⚠️ Upozorenje: Godišnji limit',
        `Dostigli ste ${limits.limit6MPercent.toFixed(0)}% godišnjeg limita (6 miliona). Preostalo: ${formatCurrency(limits.limit6MRemaining)}`,
        'limit6M_80'
      );
    }

    // Check 6M limit at 90% (critical warning)
    if (limits.limit6MPercent >= LIMIT_WARNING_THRESHOLD_90) {
      showLimitNotification(
        '🚨 Kritično: Godišnji limit',
        `Dostigli ste ${limits.limit6MPercent.toFixed(0)}% godišnjeg limita (6 miliona)! Preostalo: ${formatCurrency(limits.limit6MRemaining)}`,
        'limit6M_90'
      );
    }

    // Check 8M limit at 80% (first warning)
    if (limits.limit8MPercent >= LIMIT_WARNING_THRESHOLD_80 && limits.limit8MPercent < LIMIT_WARNING_THRESHOLD_90) {
      showLimitNotification(
        '⚠️ Upozorenje: Klizni limit',
        `Dostigli ste ${limits.limit8MPercent.toFixed(0)}% kliznog limita (8 miliona). Preostalo: ${formatCurrency(limits.limit8MRemaining)}`,
        'limit8M_80'
      );
    }

    // Check 8M limit at 90% (critical warning)
    if (limits.limit8MPercent >= LIMIT_WARNING_THRESHOLD_90) {
      showLimitNotification(
        '🚨 Kritično: Klizni limit',
        `Dostigli ste ${limits.limit8MPercent.toFixed(0)}% kliznog limita (8 miliona)! Preostalo: ${formatCurrency(limits.limit8MRemaining)}`,
        'limit8M_90'
      );
    }

    // Reset notifications if limit drops below 75%
    if (limits.limit6MPercent < 75) {
      if (limitNotifiedRef.current.limit6M_80 || limitNotifiedRef.current.limit6M_90) {
        limitNotifiedRef.current.limit6M_80 = false;
        limitNotifiedRef.current.limit6M_90 = false;
        localStorage.setItem(`limit_notified_${companyId}`, JSON.stringify(limitNotifiedRef.current));
      }
    }
    if (limits.limit8MPercent < 75) {
      if (limitNotifiedRef.current.limit8M_80 || limitNotifiedRef.current.limit8M_90) {
        limitNotifiedRef.current.limit8M_80 = false;
        limitNotifiedRef.current.limit8M_90 = false;
        localStorage.setItem(`limit_notified_${companyId}`, JSON.stringify(limitNotifiedRef.current));
      }
    }
  }, [limits, companyId]);

  // Show notifications for upcoming reminders
  useEffect(() => {
    if (skipNotifications) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    upcomingReminders.forEach((reminder) => {
      if (notifiedIds.current.has(reminder.id)) return;
      
      notifiedIds.current.add(reminder.id);

      const notification = new Notification('Podsetnik za plaćanje', {
        body: `${reminder.title}${reminder.amount ? ` - ${new Intl.NumberFormat('sr-RS').format(reminder.amount)} RSD` : ''}`,
        icon: '/favicon.ico',
        tag: reminder.id,
      });

      notification.onclick = () => {
        window.focus();
        window.location.href = '/reminders';
      };
    });
  }, [upcomingReminders]);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  return {
    hasPermission: 'Notification' in window && Notification.permission === 'granted',
    canRequest: 'Notification' in window && Notification.permission === 'default',
    requestPermission,
    upcomingCount: upcomingReminders.length,
    limits,
  };
}
