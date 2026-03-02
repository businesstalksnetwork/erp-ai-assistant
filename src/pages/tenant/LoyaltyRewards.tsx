import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Gift } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const REWARD_TYPES = ["discount_pct", "discount_fixed", "free_product", "voucher"] as const;

export default function LoyaltyRewards() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", points_cost: "", reward_type: "discount_pct" as string, reward_value: "" });

  const { data: rewards = [] } = useQuery({
    queryKey: ["loyalty_rewards", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("loyalty_rewards").select("*").eq("tenant_id", tenantId!).order("points_cost");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("loyalty_rewards").insert({
        tenant_id: tenantId!,
        name: form.name,
        points_cost: parseInt(form.points_cost) || 0,
        reward_type: form.reward_type,
        reward_value: parseFloat(form.reward_value) || 0,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty_rewards"] });
      setDialogOpen(false);
      setForm({ name: "", points_cost: "", reward_type: "discount_pct", reward_value: "" });
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("loyalty_rewards").update({ is_active: active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["loyalty_rewards"] }),
  });

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      discount_pct: t("loyaltyDiscountPercent"),
      discount_fixed: t("loyaltyDiscountFixed"),
      free_product: t("loyaltyFreeProduct"),
      voucher: t("loyaltyVoucher"),
    };
    return map[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("loyaltyRewards")}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />{t("addNew")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle><Gift className="h-4 w-4 inline mr-1" />{t("loyaltyRewards")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>{t("pointsCost")}</Label><Input type="number" value={form.points_cost} onChange={e => setForm(f => ({ ...f, points_cost: e.target.value }))} /></div>
              <div>
                <Label>{t("rewardType")}</Label>
                <Select value={form.reward_type} onValueChange={v => setForm(f => ({ ...f, reward_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REWARD_TYPES.map(rt => <SelectItem key={rt} value={rt}>{typeLabel(rt)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("rewardValue")}</Label><Input type="number" value={form.reward_value} onChange={e => setForm(f => ({ ...f, reward_value: e.target.value }))} /></div>
              <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.points_cost || createMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />{t("save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("pointsCost")}</TableHead>
              <TableHead>{t("rewardType")}</TableHead>
              <TableHead>{t("rewardValue")}</TableHead>
              <TableHead>{t("active")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rewards.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.points_cost?.toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline">{typeLabel(r.reward_type)}</Badge></TableCell>
                <TableCell>{r.reward_value}</TableCell>
                <TableCell><Switch checked={r.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: r.id, active: v })} /></TableCell>
              </TableRow>
            ))}
            {rewards.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No rewards</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
