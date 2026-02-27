import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Sun, RefreshCw, ChevronDown } from "lucide-react";
import { SimpleMarkdown } from "./SimpleMarkdown";

interface Props {
  tenantId: string;
}

export function AiMorningBriefing({ tenantId }: Props) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(true);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["ai-daily-digest", tenantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("ai-daily-digest", {
        body: { tenant_id: tenantId, language: locale, user_id: session.user.id },
      });
      if (error) throw error;
      return data as { digest: string; date: string; sections_count: number };
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 30, // 30 min cache
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (!data) return null;

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-accent/5 to-background border-primary/20">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Sun className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm">
                {t("morningBriefing")}
              </CardTitle>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => refetch()}
              disabled={isFetching}
              title={t("refresh")}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="text-xs">
            <SimpleMarkdown content={data.digest} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
