import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function getVapidPublicKey(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("get-vapid-public-key");
  if (error || !data?.publicKey) return null;
  return data.publicKey;
}

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function subscribeToPush(userId: string, tenantId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) return false;

  const registration = await navigator.serviceWorker.ready;
  
  const subscription = await (registration as any).pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  const json = subscription.toJSON();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      tenant_id: tenantId,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) {
    console.error("Failed to save push subscription:", error);
    return false;
  }

  await (supabase
    .from("profiles") as any)
    .update({ push_notifications_enabled: true })
    .eq("user_id", userId);

  return true;
}

export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await (registration as any).pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      // Remove from DB
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", subscription.endpoint);
    }

    await (supabase
      .from("profiles") as any)
      .update({ push_notifications_enabled: false })
      .eq("user_id", userId);

    return true;
  } catch (e) {
    console.error("Failed to unsubscribe:", e);
    return false;
  }
}

export async function isCurrentlySubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await (registration as any).pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}
