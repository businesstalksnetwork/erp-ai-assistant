import { useEffect, useRef } from 'react';
import { useReminders } from './useReminders';

export function useNotifications(companyId: string | null) {
  const { upcomingReminders } = useReminders(companyId);
  const notifiedIds = useRef<Set<string>>(new Set());
  const permissionAsked = useRef(false);

  // Request notification permission on mount
  useEffect(() => {
    if (permissionAsked.current) return;
    permissionAsked.current = true;

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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
  };
}
