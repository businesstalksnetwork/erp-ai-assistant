import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus, Star, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntitySelector } from "@/components/shared/EntitySelector";
import { format } from "date-fns";

const TIER_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  bronze: "outline",
  silver: "secondary",
  gold: "default",
  platinum: "default",
};

export default function LoyaltyMembers() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [detailMember, setDetailMember] = useState<any>(null);
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["loyalty_members", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_members")
        .select("*, partners(name)")
        .eq("tenant_id", tenantId!)
        .order("lifetime_points", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners_for_loyalty", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId!).order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["loyalty_programs_active", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("loyalty_programs").select("id").eq("tenant_id", tenantId!).eq("is_active", true).limit(1);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: memberTx = [] } = useQuery({
    queryKey: ["loyalty_member_tx", detailMember?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_transactions")
        .select("*")
        .eq("member_id", detailMember.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!detailMember?.id,
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPartner || !programs[0]) throw new Error("Select a partner and ensure an active program exists");
      // Accruing 0 will auto-enroll via the RPC
      const { data, error } = await supabase.rpc("accrue_loyalty_points", {
        p_tenant_id: tenantId!,
        p_partner_id: selectedPartner,
        p_amount: 0,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty_members"] });
      setEnrollOpen(false);
      setSelectedPartner(null);
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const pts = parseInt(adjustPoints);
      if (!pts || !detailMember) throw new Error("Invalid");
      const { error } = await supabase.from("loyalty_transactions").insert({
        tenant_id: tenantId!,
        member_id: detailMember.id,
        points: pts,
        type: "adjust",
        description: adjustDesc || "Manual adjustment",
      } as any);
      if (error) throw error;
      await supabase.from("loyalty_members").update({
        points_balance: detailMember.points_balance + pts,
        lifetime_points: pts > 0 ? detailMember.lifetime_points + pts : detailMember.lifetime_points,
      } as any).eq("id", detailMember.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty_members"] });
      queryClient.invalidateQueries({ queryKey: ["loyalty_member_tx"] });
      setAdjustPoints("");
      setAdjustDesc("");
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const filtered = members.filter((m: any) => {
    const name = (m.partners as any)?.name || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const partnerOptions = partners.map((p: any) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("loyaltyMembers" as any)}</h1>
        <Button onClick={() => setEnrollOpen(true)}><UserPlus className="h-4 w-4 mr-1" />{t("enrollMember" as any)}</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("partner")}</TableHead>
              <TableHead>{t("pointsBalance" as any)}</TableHead>
              <TableHead>{t("lifetimePoints" as any)}</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>{t("date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((m: any) => (
              <TableRow key={m.id} className="cursor-pointer" onClick={() => setDetailMember(m)}>
                <TableCell className="font-medium">{(m.partners as any)?.name}</TableCell>
                <TableCell>{m.points_balance?.toLocaleString()}</TableCell>
                <TableCell>{m.lifetime_points?.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={TIER_VARIANT[m.current_tier] || "outline"}>
                    {t((`tier${m.current_tier.charAt(0).toUpperCase() + m.current_tier.slice(1)}`) as any)}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(m.enrolled_at), "dd MMM yyyy")}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No members</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Enroll Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("enrollMember" as any)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Label>{t("partner")}</Label>
            <EntitySelector options={partnerOptions} value={selectedPartner} onValueChange={setSelectedPartner} placeholder={t("selectPartner")} />
            <Button onClick={() => enrollMutation.mutate()} disabled={!selectedPartner || enrollMutation.isPending}>
              <UserPlus className="h-4 w-4 mr-1" />{t("enrollMember" as any)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Detail Dialog */}
      <Dialog open={!!detailMember} onOpenChange={(v) => !v && setDetailMember(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{(detailMember?.partners as any)?.name}</DialogTitle></DialogHeader>
          {detailMember && (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <div><Star className="h-4 w-4 inline text-yellow-500" /> {detailMember.points_balance?.toLocaleString()} pts</div>
                <Badge variant={TIER_VARIANT[detailMember.current_tier] || "outline"}>
                  {t((`tier${detailMember.current_tier.charAt(0).toUpperCase() + detailMember.current_tier.slice(1)}`) as any)}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Input type="number" placeholder={t("adjustPoints" as any)} value={adjustPoints} onChange={e => setAdjustPoints(e.target.value)} className="w-24" />
                <Input placeholder={t("description")} value={adjustDesc} onChange={e => setAdjustDesc(e.target.value)} />
                <Button size="sm" onClick={() => adjustMutation.mutate()} disabled={!adjustPoints || adjustMutation.isPending}>
                  {parseInt(adjustPoints) >= 0 ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                </Button>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {memberTx.map((tx: any) => (
                  <div key={tx.id} className="flex justify-between text-sm border-b border-border/30 py-1">
                    <span>{tx.description} <span className="text-xs text-muted-foreground">{format(new Date(tx.created_at), "dd MMM HH:mm")}</span></span>
                    <Badge variant={tx.points > 0 ? "default" : "destructive"} className="text-xs">{tx.points > 0 ? "+" : ""}{tx.points}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
