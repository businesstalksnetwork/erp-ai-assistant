import { useEffect, useRef } from 'react';
import { useReminders } from './useReminders';
import { useLimits, LimitsData } from './useLimits';
import { toast } from 'sonner';

const LIMIT_WARNING_THRESHOLD = 90; // percent

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sr-RS', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' RSD';
}

export function useNotifications(companyId: string | null) {
  const { upcomingReminders } = useReminders(companyId);
  const { limits } = useLimits(companyId);
  const notifiedIds = useRef<Set<string>>(new Set());
  const permissionAsked = useRef(false);
  const limitNotifiedRef = useRef<{ limit6M: boolean; limit8M: boolean }>({ limit6M: false, limit8M: false });

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
        limitNotifiedRef.current = { limit6M: false, limit8M: false };
      }
    } else {
      limitNotifiedRef.current = { limit6M: false, limit8M: false };
    }
  }, [companyId]);

  // Check and show limit notifications
  useEffect(() => {
    if (!companyId || !limits) return;

    const showLimitNotification = (title: string, body: string, key: 'limit6M' | 'limit8M') => {
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

    // Check 6M limit (yearly)
    if (limits.limit6MPercent >= LIMIT_WARNING_THRESHOLD) {
      showLimitNotification(
        '⚠️ Upozorenje: Godišnji limit',
        `Dostigli ste ${limits.limit6MPercent.toFixed(0)}% godišnjeg limita (6M). Preostalo: ${formatCurrency(limits.limit6MRemaining)}`,
        'limit6M'
      );
    }

    // Check 8M limit (rolling)
    if (limits.limit8MPercent >= LIMIT_WARNING_THRESHOLD) {
      showLimitNotification(
        '⚠️ Upozorenje: Klizni limit',
        `Dostigli ste ${limits.limit8MPercent.toFixed(0)}% kliznog limita (8M). Preostalo: ${formatCurrency(limits.limit8MRemaining)}`,
        'limit8M'
      );
    }

    // Reset notification if limit drops below threshold (e.g., new year for 6M)
    if (limits.limit6MPercent < LIMIT_WARNING_THRESHOLD - 5 && limitNotifiedRef.current.limit6M) {
      limitNotifiedRef.current.limit6M = false;
      localStorage.setItem(`limit_notified_${companyId}`, JSON.stringify(limitNotifiedRef.current));
    }
    if (limits.limit8MPercent < LIMIT_WARNING_THRESHOLD - 5 && limitNotifiedRef.current.limit8M) {
      limitNotifiedRef.current.limit8M = false;
      localStorage.setItem(`limit_notified_${companyId}`, JSON.stringify(limitNotifiedRef.current));
    }
  }, [limits, companyId]);

  // Show notifications for upcoming reminders
  useEffect(() => {
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
