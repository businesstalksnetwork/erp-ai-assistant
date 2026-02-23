import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowRightLeft, FileUp, MessageSquare, Calendar, FileText, Tag, UserPlus } from "lucide-react";

interface Props {
  opportunityId: string;
}

const ICONS: Record<string, any> = {
  stage_change: ArrowRightLeft,
  document_uploaded: FileUp,
  comment_added: MessageSquare,
  meeting_scheduled: Calendar,
  quote_created: FileText,
  tag_added: Tag,
  tag_removed: Tag,
  follower_added: UserPlus,
};

export function OpportunityActivityTab({ opportunityId }: Props) {
  const { t } = useLanguage();

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["opportunity-activities", opportunityId],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunity_activities" as any)
        .select("*, profiles(full_name)")
        .eq("opportunity_id", opportunityId)
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("activityLog")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : activities.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>
        ) : (
          <div className="space-y-3">
            {activities.map((a: any) => {
              const Icon = ICONS[a.activity_type] || ArrowRightLeft;
              return (
                <div key={a.id} className="flex gap-3 items-start text-sm">
                  <div className="mt-0.5 rounded-full bg-muted p-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <p>{a.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(a as any).profiles?.full_name || "System"} · {new Date(a.created_at).toLocaleString("sr-RS", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
