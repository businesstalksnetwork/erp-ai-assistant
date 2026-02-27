import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { getNotificationCategoriesForRole } from "@/config/roleNotificationCategories";
import type { TenantRole } from "@/config/rolePermissions";

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  type: "info" | "warning" | "action";
  category: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const { role } = useTenant();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Get allowed categories for this role
  const allowedCategories = getNotificationCategoriesForRole((role as TenantRole) || "user");

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .in("category", allowedCategories)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setNotifications(data as unknown as Notification[]);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }
    setLoading(false);
  }, [user, allowedCategories.join(",")]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as unknown as Notification;
          // Filter by allowed categories
          if (!allowedCategories.includes(newNotif.category as any)) return;

          setNotifications((prev) => [newNotif, ...prev].slice(0, 50));
          setUnreadCount((prev) => prev + 1);

          // Toast for high-priority notifications
          if (newNotif.type === "warning" || newNotif.type === "action") {
            toast(newNotif.title, { description: newNotif.message });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, t, allowedCategories.join(",")]);

  const markAsRead = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    if (error) {
      console.error("Failed to mark notification as read:", error);
      return;
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (error) {
      console.error("Failed to mark all notifications as read:", error);
      return;
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [user]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchNotifications };
}
