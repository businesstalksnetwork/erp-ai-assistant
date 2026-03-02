import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Search, UserPlus, Star, Minus, Plus, CreditCard, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntitySelector } from "@/components/shared/EntitySelector";
import { format } from "date-fns";
import { LoyaltyCardPrint } from "@/components/loyalty/LoyaltyCardPrint";

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
  const [detailMember, setDetailMember] = useState<any>(null);
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");
  const [printMember, setPrintMember] = useState<any>(null);

  // Enroll form state
  const [enrollForm, setEnrollForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    date_of_birth: "", marketing_consent: false, partner_id: null as string | null,
    referred_by: null as string | null,
  });

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
      if (!programs[0]) throw new Error("No active loyalty program found");
      const { error } = await supabase.from("loyalty_members").insert({
        tenant_id: tenantId!,
        program_id: programs[0].id,
        first_name: enrollForm.first_name || null,
        last_name: enrollForm.last_name || null,
        email: enrollForm.email || null,
        phone: enrollForm.phone || null,
        date_of_birth: enrollForm.date_of_birth || null,
        marketing_consent: enrollForm.marketing_consent,
        partner_id: enrollForm.partner_id || null,
        referred_by: enrollForm.referred_by || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty_members"] });
      setEnrollOpen(false);
      setEnrollForm({ first_name: "", last_name: "", email: "", phone: "", date_of_birth: "", marketing_consent: false, partner_id: null, referred_by: null });
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
    const partnerName = (m.partners as any)?.name || "";
    const memberName = `${m.first_name || ""} ${m.last_name || ""}`.trim();
    const cardNum = m.card_number || "";
    const q = search.toLowerCase();
    return partnerName.toLowerCase().includes(q) || memberName.toLowerCase().includes(q) || cardNum.includes(q);
  });

  const partnerOptions = partners.map((p: any) => ({ value: p.id, label: p.name }));
  const memberOptions = members.filter((m: any) => m.id !== detailMember?.id).map((m: any) => ({
    value: m.id,
    label: `${m.first_name || ""} ${m.last_name || (m.partners as any)?.name || m.id}`.trim(),
  }));

  const getMemberDisplayName = (m: any) => {
    if (m.first_name || m.last_name) return `${m.first_name || ""} ${m.last_name || ""}`.trim();
    return (m.partners as any)?.name || "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("loyaltyMembers")}</h1>
        <Button onClick={() => setEnrollOpen(true)}><UserPlus className="h-4 w-4 mr-1" />{t("enrollMember")}</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead><CreditCard className="h-3 w-3 inline mr-1" />Card #</TableHead>
              <TableHead>{t("pointsBalance")}</TableHead>
              <TableHead>{t("lifetimePoints")}</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>{t("date")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((m: any) => (
              <TableRow key={m.id} className="cursor-pointer" onClick={() => setDetailMember(m)}>
                <TableCell className="font-medium">{getMemberDisplayName(m)}</TableCell>
                <TableCell className="font-mono text-xs">{m.card_number || "—"}</TableCell>
                <TableCell>{m.points_balance?.toLocaleString()}</TableCell>
                <TableCell>{m.lifetime_points?.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={TIER_VARIANT[m.current_tier] || "outline"}>
                    {t(`tier${m.current_tier.charAt(0).toUpperCase() + m.current_tier.slice(1)}`)}
                  </Badge>
                </TableCell>
                <TableCell>{format(new Date(m.enrolled_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setPrintMember(m); }}>
                    <QrCode className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No members</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Enroll Dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("enrollMember")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("firstName")}</Label>
                <Input value={enrollForm.first_name} onChange={e => setEnrollForm(p => ({ ...p, first_name: e.target.value }))} />
              </div>
              <div><Label>{t("lastName")}</Label>
                <Input value={enrollForm.last_name} onChange={e => setEnrollForm(p => ({ ...p, last_name: e.target.value }))} />
              </div>
            </div>
            <div><Label>{t("email")}</Label>
              <Input type="email" value={enrollForm.email} onChange={e => setEnrollForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div><Label>{t("phone")}</Label>
              <Input value={enrollForm.phone} onChange={e => setEnrollForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div><Label>{t("dateOfBirth")}</Label>
              <Input type="date" value={enrollForm.date_of_birth} onChange={e => setEnrollForm(p => ({ ...p, date_of_birth: e.target.value }))} />
            </div>
            <div><Label>{t("partner")}</Label>
              <EntitySelector options={partnerOptions} value={enrollForm.partner_id} onValueChange={v => setEnrollForm(p => ({ ...p, partner_id: v }))} placeholder={t("selectPartner")} />
            </div>
            <div><Label>{t("referredBy")}</Label>
              <EntitySelector options={memberOptions} value={enrollForm.referred_by} onValueChange={v => setEnrollForm(p => ({ ...p, referred_by: v }))} placeholder="Select referrer (optional)" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={enrollForm.marketing_consent} onCheckedChange={c => setEnrollForm(p => ({ ...p, marketing_consent: !!c }))} />
              <Label className="text-sm">{t("marketingConsent")}</Label>
            </div>
            <Button onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending} className="w-full">
              <UserPlus className="h-4 w-4 mr-1" />{t("enrollMember")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Detail Dialog */}
      <Dialog open={!!detailMember} onOpenChange={(v) => !v && setDetailMember(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{getMemberDisplayName(detailMember || {})}</DialogTitle></DialogHeader>
          {detailMember && (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm flex-wrap">
                <div><Star className="h-4 w-4 inline text-yellow-500" /> {detailMember.points_balance?.toLocaleString()} pts</div>
                <Badge variant={TIER_VARIANT[detailMember.current_tier] || "outline"}>
                  {t(`tier${detailMember.current_tier.charAt(0).toUpperCase() + detailMember.current_tier.slice(1)}`)}
                </Badge>
                {detailMember.card_number && <span className="font-mono text-xs bg-muted px-2 py-1 rounded"><CreditCard className="h-3 w-3 inline mr-1" />{detailMember.card_number}</span>}
              </div>
              {(detailMember.phone || detailMember.email) && (
                <div className="text-xs text-muted-foreground space-x-3">
                  {detailMember.phone && <span>📱 {detailMember.phone}</span>}
                  {detailMember.email && <span>✉️ {detailMember.email}</span>}
                </div>
              )}

              <div className="flex gap-2">
                <Input type="number" placeholder={t("adjustPoints")} value={adjustPoints} onChange={e => setAdjustPoints(e.target.value)} className="w-24" />
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

      {/* Print Card Dialog */}
      {printMember && (
        <Dialog open={!!printMember} onOpenChange={(v) => !v && setPrintMember(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Loyalty Card</DialogTitle></DialogHeader>
            <LoyaltyCardPrint member={printMember} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
