import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, CheckCircle, XCircle, Search, FileText, Plus, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { postWithRuleOrFallback } from "@/lib/postingHelper";

export default function AssetInventoryCountDetail() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all, found, missing, uncounted
  const [commissionDialog, setCommissionDialog] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("member");

  const { data: count } = useQuery({
    queryKey: ["asset-inventory-count", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await supabase.from("asset_inventory_counts").select("*").eq("id", id).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["asset-inventory-items", id],
    queryFn: async () => {
      if (!id) return [];
      const { data } = await supabase.from("asset_inventory_count_items")
        .select("*, assets(name, asset_code, inventory_number, serial_number, asset_type, acquisition_cost, current_value)")
        .eq("count_id", id)
        .order("created_at");
      return data || [];
    },
    enabled: !!id,
  });

  const { data: commission = [] } = useQuery({
    queryKey: ["asset-inventory-commission", id],
    queryFn: async () => {
      if (!id || !tenantId) return [];
      const { data } = await supabase.from("asset_inventory_commission")
        .select("*")
        .eq("count_id", id)
        .order("created_at");
      return data || [];
    },
    enabled: !!id && !!tenantId,
  });

  const filtered = items.filter((item: any) => {
    const asset = item.assets;
    const matchesSearch = !search || 
      asset?.name?.toLowerCase().includes(search.toLowerCase()) ||
      asset?.asset_code?.toLowerCase().includes(search.toLowerCase()) ||
      asset?.inventory_number?.toLowerCase().includes(search.toLowerCase());
    
    const matchesFilter = filter === "all" ||
      (filter === "found" && item.found === true) ||
      (filter === "missing" && item.found === false) ||
      (filter === "uncounted" && item.found === null);
    
    return matchesSearch && matchesFilter;
  });

  // Mark item as found or missing
  const markMutation = useMutation({
    mutationFn: async ({ itemId, found, condition }: { itemId: string; found: boolean; condition?: string }) => {
      const item = items.find((i: any) => i.id === itemId);
      const varianceType = !found ? "shortage" : null;
      const varianceAmount = !found ? Number(item?.book_value || 0) : 0;

      const { error } = await supabase.from("asset_inventory_count_items").update({
        found,
        condition: condition || "good",
        variance_type: varianceType,
        variance_amount: varianceAmount,
        counted_by: user?.id,
        counted_at: new Date().toISOString(),
      }).eq("id", itemId);
      if (error) throw error;

      // Update count summary
      await updateCountSummary();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-inventory-items", id] });
      qc.invalidateQueries({ queryKey: ["asset-inventory-count", id] });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const updateCountSummary = async () => {
    if (!id) return;
    const { data: allItems } = await supabase.from("asset_inventory_count_items")
      .select("found, variance_amount, variance_type")
      .eq("count_id", id);
    
    const foundCount = allItems?.filter((i: any) => i.found === true).length || 0;
    const missingCount = allItems?.filter((i: any) => i.found === false).length || 0;
    const shortageAmount = allItems?.filter((i: any) => i.variance_type === "shortage")
      .reduce((s: number, i: any) => s + Number(i.variance_amount || 0), 0) || 0;

    await supabase.from("asset_inventory_counts").update({
      found_count: foundCount,
      missing_count: missingCount,
      shortage_amount: shortageAmount,
      status: (foundCount + missingCount === allItems?.length && allItems?.length > 0) ? "completed" : "in_progress",
      updated_at: new Date().toISOString(),
    }).eq("id", id);
  };

  // Start count (change status to in_progress)
  const startMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      await supabase.from("asset_inventory_counts").update({ status: "in_progress" }).eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-inventory-count", id] });
      toast({ title: t("assetsCountStarted" as any) });
    },
  });

  // Post variances to GL
  const postMutation = useMutation({
    mutationFn: async () => {
      if (!id || !tenantId || !user || !count) throw new Error("Missing context");
      
      const missingItems = items.filter((i: any) => i.found === false && Number(i.book_value) > 0);
      if (missingItems.length === 0) return;

      const totalShortage = missingItems.reduce((s: number, i: any) => s + Number(i.book_value || 0), 0);

      const journalId = await postWithRuleOrFallback({
        tenantId, userId: user.id,
        entryDate: count.count_date,
        modelCode: "ASSET_INVENTORY_SHORTAGE",
        amount: totalShortage,
        description: `${t("assetsInventoryShortage" as any)} - ${count.count_number}`,
        reference: `INV-SHORT-${count.count_number}`,
        legalEntityId: count.legal_entity_id || undefined,
        context: {},
        fallbackLines: [
          { accountCode: "5740", debit: totalShortage, credit: 0, description: `${t("assetsInventoryShortage" as any)} - manjak`, sortOrder: 0 },
          { accountCode: "0120", debit: 0, credit: totalShortage, description: `${t("assetsRemoveAsset" as any)} - manjak`, sortOrder: 1 },
        ],
      });

      // Update count as posted
      await supabase.from("asset_inventory_counts").update({
        status: "posted",
        journal_entry_id: journalId,
        posted_at: new Date().toISOString(),
      }).eq("id", id);

      // Mark missing assets as written_off
      for (const item of missingItems) {
        await supabase.from("assets").update({ status: "written_off" }).eq("id", item.asset_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-inventory-count", id] });
      qc.invalidateQueries({ queryKey: ["asset-inventory-items", id] });
      toast({ title: t("assetsCountPosted" as any) });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Add commission member
  const addMemberMutation = useMutation({
    mutationFn: async () => {
      if (!id || !tenantId) throw new Error("Missing context");
      const { error } = await supabase.from("asset_inventory_commission").insert({
        tenant_id: tenantId,
        count_id: id,
        full_name: memberName,
        role: memberRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-inventory-commission", id] });
      setMemberName("");
      setMemberRole("member");
      toast({ title: t("saved" as any) });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("sr-Latn-RS", { style: "decimal", minimumFractionDigits: 2 }).format(val || 0);

  const foundCount = items.filter((i: any) => i.found === true).length;
  const missingCount = items.filter((i: any) => i.found === false).length;
  const uncountedCount = items.filter((i: any) => i.found === null).length;
  const isEditable = count?.status === "draft" || count?.status === "in_progress";

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/assets/inventory-count")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{count?.count_number || t("assetsInventoryCount" as any)}</h1>
          <p className="text-sm text-muted-foreground">{count?.count_date} — {count?.description || ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCommissionDialog(true)}>
            <Users className="h-4 w-4 mr-1" /> {t("assetsCommission" as any)} ({commission.length})
          </Button>
          {count?.status === "draft" && (
            <Button size="sm" onClick={() => startMutation.mutate()}>
              {t("assetsStartCount" as any)}
            </Button>
          )}
          {count?.status === "completed" && (
            <Button size="sm" variant="destructive" onClick={() => postMutation.mutate()} disabled={postMutation.isPending}>
              <FileText className="h-4 w-4 mr-1" /> {t("assetsPostVariances" as any)}
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("assetsTotalAssets" as any)}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{items.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("assetsFound" as any)}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">{foundCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("assetsMissing" as any)}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{missingCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("assetsUncounted" as any)}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600">{uncountedCount}</div></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all" as any)}</SelectItem>
            <SelectItem value="found">{t("assetsFound" as any)}</SelectItem>
            <SelectItem value="missing">{t("assetsMissing" as any)}</SelectItem>
            <SelectItem value="uncounted">{t("assetsUncounted" as any)}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Count Sheet */}
      <Card>
        <CardHeader><CardTitle>{t("assetsCountSheet" as any)}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("code" as any)}</TableHead>
                  <TableHead>{t("name" as any)}</TableHead>
                  <TableHead>{t("assetsInventoryNumber" as any)}</TableHead>
                  <TableHead className="text-right">{t("bookValue" as any)}</TableHead>
                  <TableHead>{t("assetsCondition" as any)}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  {isEditable && <TableHead>{t("actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item: any) => {
                  const asset = item.assets;
                  return (
                    <TableRow key={item.id} className={item.found === false ? "bg-destructive/5" : ""}>
                      <TableCell className="font-mono text-sm">{asset?.asset_code}</TableCell>
                      <TableCell className="font-medium">{asset?.name}</TableCell>
                      <TableCell>{asset?.inventory_number || "—"}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(item.book_value)}</TableCell>
                      <TableCell>
                        {item.found !== null && (
                          <Badge variant="outline">{item.condition || "good"}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.found === true && (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <CheckCircle className="h-3 w-3 mr-1" /> {t("assetsFound" as any)}
                          </Badge>
                        )}
                        {item.found === false && (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" /> {t("assetsMissing" as any)}
                          </Badge>
                        )}
                        {item.found === null && (
                          <Badge variant="outline" className="text-amber-600">{t("assetsUncounted" as any)}</Badge>
                        )}
                      </TableCell>
                      {isEditable && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant={item.found === true ? "default" : "outline"}
                              size="sm"
                              onClick={() => markMutation.mutate({ itemId: item.id, found: true })}
                              disabled={markMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3" />
                            </Button>
                            <Button
                              variant={item.found === false ? "destructive" : "outline"}
                              size="sm"
                              onClick={() => markMutation.mutate({ itemId: item.id, found: false })}
                              disabled={markMutation.isPending}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Commission Dialog */}
      <Dialog open={commissionDialog} onOpenChange={setCommissionDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("assetsCommission" as any)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {commission.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name" as any)}</TableHead>
                    <TableHead>{t("assetsCommissionRole" as any)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commission.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.full_name}</TableCell>
                      <TableCell><Badge variant="outline">{m.role}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {isEditable && (
              <div className="grid gap-3 pt-2 border-t">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>{t("name" as any)}</Label>
                    <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder={t("fullName" as any)} />
                  </div>
                  <div>
                    <Label>{t("assetsCommissionRole" as any)}</Label>
                    <Select value={memberRole} onValueChange={setMemberRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="president">{t("assetsPresident" as any)}</SelectItem>
                        <SelectItem value="member">{t("assetsMember" as any)}</SelectItem>
                        <SelectItem value="secretary">{t("assetsSecretary" as any)}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button size="sm" onClick={() => addMemberMutation.mutate()} disabled={!memberName || addMemberMutation.isPending}>
                  <Plus className="h-4 w-4 mr-1" /> {t("add" as any)}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommissionDialog(false)}>{t("close" as any)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
