import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, CheckCircle, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Notification } from "@/hooks/useNotifications";

const typeIcons = {
  warning: AlertTriangle,
  action: CheckCircle,
  info: Info,
};

const typeColors = {
  warning: "text-yellow-500",
  action: "text-blue-500",
  info: "text-muted-foreground",
};

// Map entity_type to route
function entityRoute(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  const routes: Record<string, string> = {
    invoice: "/accounting/invoices",
    approval: "/settings/approvals",
    product: "/inventory/products",
    return_case: "/returns",
    leave_request: "/hr/leave-requests",
    journal_entry: "/accounting/journal",
  };
  return routes[entityType] || null;
}

interface Props {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

export function NotificationDropdown({ notifications, onMarkAsRead, onMarkAllAsRead, onClose }: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleClick = (n: Notification) => {
    if (!n.is_read) onMarkAsRead(n.id);
    const route = entityRoute(n.entity_type, n.entity_id);
    if (route) {
      navigate(route);
      onClose();
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-popover shadow-lg z-50">
      <div className="flex items-center justify-between p-3 border-b">
        <h4 className="text-sm font-semibold">{t("notifications")}</h4>
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onMarkAllAsRead}>
          {t("markAllRead")}
        </Button>
      </div>
      <ScrollArea className="max-h-80">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Bell className="h-8 w-8" />
            <span className="text-sm">{t("noNotifications")}</span>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((n) => {
              const Icon = typeIcons[n.type] || Info;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left p-3 hover:bg-accent/50 transition-colors flex gap-3 ${
                    !n.is_read ? "bg-accent/20" : ""
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${typeColors[n.type]}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${!n.is_read ? "font-medium" : ""}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
