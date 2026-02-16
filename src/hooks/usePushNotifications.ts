import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  // Check browser support
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Fetch VAPID public key
  useEffect(() => {
    async function fetchVapidKey() {
      try {
        const { data, error } = await supabase.functions.invoke('get-vapid-public-key');
        if (!error && data?.publicKey) {
          setVapidPublicKey(data.publicKey);
        }
      } catch (e) {
        console.error('Failed to fetch VAPID key:', e);
      }
    }
    fetchVapidKey();
  }, []);

  // Check existing subscription
  useEffect(() => {
    async function checkSubscription() {
      if (!isSupported || !user) return;
      try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        if (registration) {
          const subscription = await (registration as any).pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        }
      } catch (e) {
        console.error('Error checking push subscription:', e);
      }
    }
    checkSubscription();
  }, [isSupported, user]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !user || !vapidPublicKey) return false;
    setLoading(true);
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        toast({
          title: 'Dozvola odbijena',
          description: 'Morate dozvoliti notifikacije u browseru da biste ih primali.',
          variant: 'destructive',
        });
        setLoading(false);
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const subJson = subscription.toJSON();
      
      // Save to database
      const { error } = await supabase.from('push_subscriptions' as any).upsert({
        user_id: user.id,
        endpoint: subJson.endpoint!,
        p256dh: subJson.keys!.p256dh,
        auth: subJson.keys!.auth,
      }, { onConflict: 'user_id,endpoint' });

      if (error) throw error;

      // Update profile preference
      await supabase.from('profiles').update({ push_notifications_enabled: true } as any).eq('id', user.id);
      await refreshProfile();

      setIsSubscribed(true);
      toast({
        title: 'Push notifikacije aktivirane',
        description: 'Primaćete obaveštenja i kada aplikacija nije otvorena.',
      });
      return true;
    } catch (e: any) {
      console.error('Push subscription error:', e);
      toast({
        title: 'Greška',
        description: 'Nije moguće aktivirati push notifikacije.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported, user, vapidPublicKey, toast, refreshProfile]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      if (registration) {
        const subscription = await (registration as any).pushManager.getSubscription();
        if (subscription) {
          // Remove from DB
          await supabase.from('push_subscriptions' as any).delete().eq('user_id', user.id).eq('endpoint', subscription.endpoint);
          await subscription.unsubscribe();
        }
      }

      await supabase.from('profiles').update({ push_notifications_enabled: false } as any).eq('id', user.id);
      await refreshProfile();

      setIsSubscribed(false);
      toast({
        title: 'Push notifikacije isključene',
        description: 'Više nećete primati obaveštenja van aplikacije.',
      });
    } catch (e) {
      console.error('Unsubscribe error:', e);
    } finally {
      setLoading(false);
    }
  }, [user, toast, refreshProfile]);

  const sendTestNotification = useCallback(async () => {
    if (!user) return;
    try {
      // Create a test notification in the DB - the edge function would normally send push
      // For testing, show a local notification
      if (Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        if (registration) {
          registration.showNotification('PausalBox Test', {
            body: 'Push notifikacije rade ispravno! 🎉',
            icon: '/favicon.png',
            data: { url: '/profile?tab=settings' },
          });
        }
      }
      toast({
        title: 'Test poslat',
        description: 'Trebalo bi da vidite push notifikaciju.',
      });
    } catch (e) {
      console.error('Test notification error:', e);
    }
  }, [user, toast]);

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
}
