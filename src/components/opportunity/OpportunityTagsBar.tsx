import { useLanguage } from "@/i18n/LanguageContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface Props {
  opportunityId: string;
  tenantId: string;
  onActivity: (type: string, description: string, metadata?: any) => void;
}

const TAG_COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280"];

export function OpportunityTagsBar({ opportunityId, tenantId, onActivity }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newTag, setNewTag] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { data: tags = [] } = useQuery({
    queryKey: ["opportunity-tags", opportunityId],
    queryFn: async () => {
      const { data } = await supabase
        .from("opportunity_tags" as any)
        .select("*")
        .eq("opportunity_id", opportunityId)
        .order("created_at");
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newTag.trim()) return;
      const { error } = await supabase.from("opportunity_tags" as any).insert([{
        tenant_id: tenantId,
        opportunity_id: opportunityId,
        tag: newTag.trim(),
        color: newColor,
        created_by: user?.id,
      }]);
      if (error) throw error;
      onActivity("tag_added", `Tag added: ${newTag.trim()}`, { tag: newTag.trim() });
    },
    onSuccess: () => {
      setNewTag("");
      setPopoverOpen(false);
      qc.invalidateQueries({ queryKey: ["opportunity-tags", opportunityId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase.from("opportunity_tags" as any).delete().eq("id", tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity-tags", opportunityId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map((tag: any) => (
        <Badge
          key={tag.id}
          className="gap-1 cursor-pointer"
          style={{ backgroundColor: tag.color, color: "#fff" }}
          onClick={() => removeMutation.mutate(tag.id)}
        >
          {tag.tag}
          <X className="h-3 w-3" />
        </Badge>
      ))}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
            <Plus className="h-3 w-3 mr-1" />{t("addTag")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 space-y-2">
          <Input
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            placeholder={t("addTag")}
            className="h-8 text-sm"
            onKeyDown={e => { if (e.key === "Enter") addMutation.mutate(); }}
          />
          <div className="flex gap-1">
            {TAG_COLORS.map(c => (
              <button
                key={c}
                className={`w-6 h-6 rounded-full border-2 ${newColor === c ? "border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                onClick={() => setNewColor(c)}
              />
            ))}
          </div>
          <Button size="sm" className="w-full" onClick={() => addMutation.mutate()} disabled={!newTag.trim()}>
            {t("save")}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
