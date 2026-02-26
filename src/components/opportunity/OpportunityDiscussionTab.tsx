import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";

interface Props {
  opportunityId: string;
  tenantId: string;
  tenantMembers: any[];
  onActivity: (type: string, description: string, metadata?: any) => void;
}

export function OpportunityDiscussionTab({ opportunityId, tenantId, tenantMembers, onActivity }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["opportunity-comments", opportunityId, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunity_comments" as any)
        .select("*, profiles(full_name)")
        .eq("opportunity_id", opportunityId)
        .is("parent_id", null)
        .order("created_at", { ascending: true });
      return data || [];
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!content.trim()) return;
      const { error } = await supabase.from("opportunity_comments" as any).insert([{
        tenant_id: tenantId,
        opportunity_id: opportunityId,
        user_id: user!.id,
        content: content.trim(),
      }]);
      if (error) throw error;
      onActivity("comment_added", `Comment by ${user?.email}`, { preview: content.trim().slice(0, 100) });
    },
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["opportunity-comments", opportunityId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renderContent = (text: string) => {
    return text.replace(/@\[([a-f0-9-]+)\]/g, (_, uid) => {
      const member = tenantMembers.find(m => m.user_id === uid);
      return `@${member?.profiles?.full_name || uid.slice(0, 8)}`;
    });
  };

  const getInitials = (name: string) => {
    return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "??";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (content.trim()) sendMutation.mutate();
    }
  };

  // Group messages by day for date separators
  const getDateKey = (dateStr: string) => new Date(dateStr).toLocaleDateString("sr-RS");

  let lastDateKey = "";

  return (
    <Card className="flex flex-col" style={{ minHeight: 400 }}>
      <CardHeader>
        <CardTitle className="text-base">{t("discussion")}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 max-h-[50vh] sm:max-h-[400px]">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>
          ) : (
            comments.map((c: any) => {
              const dateKey = getDateKey(c.created_at);
              const showDateSep = dateKey !== lastDateKey;
              lastDateKey = dateKey;
              return (
                <div key={c.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] text-muted-foreground font-medium px-2">{dateKey}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className={`flex gap-3 ${c.user_id === user?.id ? "flex-row-reverse" : ""}`}>
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs">{getInitials((c as any).profiles?.full_name || "")}</AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[85%] sm:max-w-[75%] rounded-lg p-3 text-sm ${c.user_id === user?.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <div className="font-medium text-xs mb-1 opacity-70">
                        {(c as any).profiles?.full_name || c.user_id?.slice(0, 8)}
                        <span className="ml-2">{new Date(c.created_at).toLocaleString("sr-RS", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                      <p className="whitespace-pre-wrap break-words">{renderContent(c.content)}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("writeComment")}
            className="min-h-[60px] resize-none"
          />
          <Button
            size="icon"
            className="shrink-0 self-end"
            onClick={() => sendMutation.mutate()}
            disabled={!content.trim() || sendMutation.isPending}
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
