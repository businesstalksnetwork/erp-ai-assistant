import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useNotifications } from "@/hooks/useNotifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bell, Search, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function NotificationHistory() {
  const { t } = useLanguage();
  const { notifications, loading, markAsRead, markAllAsRead, deleteNotification, clearAllRead } = useNotifications();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.message.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || n.type === typeFilter;
      const matchRead = readFilter === "all" || (readFilter === "unread" ? !n.is_read : n.is_read);
      return matchSearch && matchType && matchRead;
    });
  }, [notifications, search, typeFilter, readFilter]);

  const typeBadgeColor = (type: string) => {
    if (type === "warning") return "destructive";
    if (type === "action") return "default";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("notificationHistory")}</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t("notifications")}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={clearAllRead}>
              {t("clearRead")}
            </Button>
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              {t("markAllRead")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allTypes")}</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="action">{t("action")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={readFilter} onValueChange={setReadFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="unread">{t("pending")}</SelectItem>
                <SelectItem value="read">{t("completed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-center py-10 text-muted-foreground">{t("loading")}</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Bell className="h-8 w-8" />
              <span className="text-sm">{t("noNotifications")}</span>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {filtered.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 p-4 ${!n.is_read ? "bg-accent/10" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={typeBadgeColor(n.type)} className="text-xs">{n.type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <p className={`text-sm ${!n.is_read ? "font-medium" : ""}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!n.is_read && (
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markAsRead(n.id)}>
                        {t("markAllRead")}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive" onClick={() => deleteNotification(n.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
