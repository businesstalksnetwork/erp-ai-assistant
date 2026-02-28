import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

interface Props {
  messageIndex: number;
  conversationId?: string;
  module?: string;
}

export function AiFeedbackButtons({ messageIndex, conversationId, module }: Props) {
  const [submitted, setSubmitted] = useState<string | null>(null);
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { t } = useLanguage();

  const submit = async (feedback: "positive" | "negative") => {
    if (!user || !tenantId || submitted) return;
    setSubmitted(feedback);
    try {
      await supabase.from("ai_feedback" as any).insert({
        tenant_id: tenantId,
        user_id: user.id,
        conversation_id: conversationId || null,
        message_index: messageIndex,
        feedback,
        context_module: module || null,
      });
      toast.success(t("aiFeedbackThanks"));
    } catch {
      // silent
    }
  };

  if (submitted) {
    return (
      <span className="text-[10px] text-muted-foreground ml-6">
        {submitted === "positive" ? "👍" : "👎"}
      </span>
    );
  }

  return (
    <div className="flex gap-0.5 ml-6 mt-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 text-muted-foreground hover:text-green-600"
        onClick={() => submit("positive")}
        title={t("aiFeedbackPositive")}
      >
        <ThumbsUp className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 text-muted-foreground hover:text-red-500"
        onClick={() => submit("negative")}
        title={t("aiFeedbackNegative")}
      >
        <ThumbsDown className="h-3 w-3" />
      </Button>
    </div>
  );
}
