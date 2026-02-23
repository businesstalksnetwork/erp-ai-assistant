import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
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
  const isNative = Capacitor.isNativePlatform();
  const listenersAdded = useRef(false);

  // Check browser/native support
  useEffect(() => {
    if (isNative) {
      setIsSupported(true);
    } else {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setIsSupported(supported);
      if (supported) {
        setPermission(Notification.permission);
      }
    }
  }, [isNative]);

  // Fetch VAPID public key (web only)
  useEffect(() => {
    if (isNative) return;
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
  }, [isNative]);

  // Check existing subscription (web) or native token (native)
  useEffect(() => {
    if (!user) return;

    if (isNative) {
      async function checkNativeToken() {
        try {
          const { data } = await supabase.from('native_push_tokens' as any).select('id').eq('user_id', user!.id).maybeSingle();
          setIsSubscribed(!!data);
        } catch (e) {
          console.error('Error checking native push token:', e);
        }
      }
      checkNativeToken();
    } else {
      async function checkSubscription() {
        if (!isSupported) return;
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
    }
  }, [isSupported, user, isNative]);

  const subscribe = useCallback(async () => {
    if (!user) return false;

    if (isNative) {
      setLoading(true);
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const permStatus = await PushNotifications.checkPermissions();
        let status = permStatus.receive;
        if (status === 'prompt') {
          const result = await PushNotifications.requestPermissions();
          status = result.receive;
        }
        setPermission(status as NotificationPermission);
        if (status !== 'granted') {
          toast({
            title: 'Dozvola odbijena',
            description: 'Morate dozvoliti notifikacije u podešavanjima uređaja.',
            variant: 'destructive',
          });
          setLoading(false);
          return false;
        }

        if (!listenersAdded.current) {
          listenersAdded.current = true;
          PushNotifications.addListener('registration', async (ev) => {
            const token = ev.value;
            const platform = Capacitor.getPlatform() as 'android' | 'ios';
            const { error } = await supabase.from('native_push_tokens' as any).upsert(
              { user_id: user.id, token, platform },
              { onConflict: 'user_id,platform' }
            );
            if (!error) {
              setIsSubscribed(true);
              await supabase.from('profiles').update({ push_notifications_enabled: true } as any).eq('id', user.id);
              await refreshProfile();
              toast({
                title: 'Push notifikacije aktivirane',
                description: 'Primaćete obaveštenja i kada aplikacija nije otvorena.',
              });
            }
          });
          PushNotifications.addListener('registrationError', (err) => {
            console.error('Push registration error:', err);
            toast({
              title: 'Greška',
              description: 'Nije moguće registrovati push notifikacije.',
              variant: 'destructive',
            });
          });
        }

        await PushNotifications.register();
        return true;
      } catch (e: any) {
        console.error('Native push subscription error:', e);
        toast({
          title: 'Greška',
          description: 'Nije moguće aktivirati push notifikacije.',
          variant: 'destructive',
        });
        return false;
      } finally {
        setLoading(false);
      }
    }

    // Web push
    if (!isSupported || !vapidPublicKey) return false;
    setLoading(true);
    try {
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

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const subJson = subscription.toJSON();

      const { error } = await supabase.from('push_subscriptions' as any).upsert({
        user_id: user.id,
        endpoint: subJson.endpoint!,
        p256dh: subJson.keys!.p256dh,
        auth: subJson.keys!.auth,
      }, { onConflict: 'user_id,endpoint' });
      if (error) throw error;

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
  }, [isSupported, isNative, user, vapidPublicKey, toast, refreshProfile]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isNative) {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        await PushNotifications.unregister();
        await supabase.from('native_push_tokens' as any).delete().eq('user_id', user.id);
      } else {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        if (registration) {
          const subscription = await (registration as any).pushManager.getSubscription();
          if (subscription) {
            await supabase.from('push_subscriptions' as any).delete().eq('user_id', user.id).eq('endpoint', subscription.endpoint);
            await subscription.unsubscribe();
          }
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
  }, [user, isNative, toast, refreshProfile]);

  const sendTestNotification = useCallback(async () => {
    if (!user) return;
    try {
      if (isNative) {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        await PushNotifications.createChannel({
          id: 'reminders',
          name: 'Podsetnici',
          importance: 4,
          visibility: 1,
        });
        toast({
          title: 'Test poslat',
          description: 'Native push kanal kreiran. Za testiranje pošaljite push sa servera.',
        });
      } else if (Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        if (registration) {
          registration.showNotification('PausalBox Test', {
            body: 'Push notifikacije rade ispravno! 🎉',
            icon: '/favicon.png',
            data: { url: '/profile?tab=settings' },
          });
        }
        toast({
          title: 'Test poslat',
          description: 'Trebalo bi da vidite push notifikaciju.',
        });
      }
    } catch (e) {
      console.error('Test notification error:', e);
    }
  }, [user, isNative, toast]);

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
