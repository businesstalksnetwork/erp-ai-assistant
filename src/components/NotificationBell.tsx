import { Bell, Eye, FileText, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppNotifications, AppNotification } from '@/hooks/useAppNotifications';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { sr } from 'date-fns/locale';

function getNotificationIcon(type: string) {
  switch (type) {
    case 'invoice_viewed':
      return <Eye className="h-4 w-4 text-primary" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

function NotificationItem({ notification, onRead }: { notification: AppNotification; onRead: (n: AppNotification) => void }) {
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: sr });

  return (
    <button
      onClick={() => onRead(notification)}
      className={cn(
        "w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-accent/50 transition-colors border-b border-border last:border-b-0",
        !notification.is_read && "bg-primary/5"
      )}
    >
      <div className="mt-0.5 flex-shrink-0">{getNotificationIcon(notification.type)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium truncate", !notification.is_read && "text-foreground")}>
            {notification.title}
          </span>
          {!notification.is_read && (
            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.message}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo}</p>
      </div>
    </button>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useAppNotifications();
  const navigate = useNavigate();

  const handleRead = async (notification: AppNotification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="font-semibold text-sm">Obaveštenja</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={markAllAsRead}>
              <CheckCheck className="h-3.5 w-3.5" />
              Označi sve
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nema obaveštenja
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onRead={handleRead} />
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
