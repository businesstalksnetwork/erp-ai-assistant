import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, CheckCircle, XCircle } from "lucide-react";

export default function Archiving() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [reason, setReason] = useState("");

  // Fetch archive book entries with retention info
  const { data: entries = [] } = useQuery({
    queryKey: ["archive_book_candidates", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("archive_book").select("*, document_categories(code, name_sr)")
        .eq("tenant_id", tenantId).neq("retention_period", "trajno").order("created_at");
      return (data || []).map((e: any) => {
        const createdYear = new Date(e.created_at).getFullYear();
        const expiryYear = createdYear + (e.retention_years || 0);
        const now = new Date().getFullYear();
        const daysUntilExpiry = (expiryYear - now) * 365;
        return { ...e, expiryYear, daysUntilExpiry, isExpired: now >= expiryYear };
      });
    },
    enabled: !!tenantId,
  });

  const candidates = entries.filter((e: any) => e.daysUntilExpiry <= 365);

  // Fetch archiving requests
  const { data: requests = [] } = useQuery({
    queryKey: ["archiving_requests", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("archiving_requests").select("*")
        .eq("tenant_id", tenantId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || selectedItems.length === 0) return;
      const year = new Date().getFullYear();
      const { data: maxReq } = await supabase.from("archiving_requests")
        .select("request_number").eq("tenant_id", tenantId)
        .like("request_number", `IZL-${year}%`).order("created_at", { ascending: false }).limit(1);
      const seqNum = maxReq?.length ? parseInt(maxReq[0].request_number.split("/").pop() || "0") + 1 : 1;
      const requestNumber = `IZL-${year}/${seqNum}`;

      const { data: req } = await supabase.from("archiving_requests").insert({
        tenant_id: tenantId,
        request_number: requestNumber,
        requested_by: user?.id,
        reason: reason || null,
      }).select().single();

      if (req) {
        const items = selectedItems.map(id => ({
          tenant_id: tenantId,
          request_id: req.id,
          archive_book_id: id,
        }));
        await supabase.from("archiving_request_items").insert(items);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archiving_requests"] });
      setSelectedItems([]);
      setCreateOpen(false);
      setReason("");
      toast({ title: t("success") });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const updateRequestStatus = async (req: any, status: string) => {
    await supabase.from("archiving_requests").update({
      status,
      approved_by: status === "approved" || status === "rejected" ? user?.id : undefined,
    }).eq("id", req.id);
    queryClient.invalidateQueries({ queryKey: ["archiving_requests"] });
    toast({ title: t("success") });
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const expiryBadge = (e: any) => {
    if (e.isExpired) return <Badge variant="destructive">{t("expired")}</Badge>;
    if (e.daysUntilExpiry < 30) return <Badge className="bg-orange-500">&lt;30d</Badge>;
    if (e.daysUntilExpiry < 90) return <Badge className="bg-yellow-500">&lt;90d</Badge>;
    return <Badge variant="secondary">&lt;1y</Badge>;
  };

  const statusBadge = (s: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline", approved: "default", rejected: "destructive", completed: "secondary"
    };
    return <Badge variant={map[s] || "outline"}>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("dmsArchiving")}</h1>
        <p className="text-muted-foreground text-sm">{t("dmsArchivingDesc")}</p>
      </div>

      <Tabs defaultValue="candidates">
        <TabsList>
          <TabsTrigger value="candidates">{t("dmsCandidates")} ({candidates.length})</TabsTrigger>
          <TabsTrigger value="requests">{t("dmsRequests")} ({requests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="candidates" className="space-y-4">
          {selectedItems.length > 0 && (
            <Card>
              <CardContent className="pt-4 flex items-center justify-between">
                <span>{selectedItems.length} {t("dmsItemsSelected")}</span>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />{t("dmsCreateRequest")}
                </Button>
              </CardContent>
            </Card>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>{t("entryNumber")}</TableHead>
                <TableHead>{t("description")}</TableHead>
                <TableHead>{t("dmsCategory")}</TableHead>
                <TableHead>{t("dmsRetentionPeriod")}</TableHead>
                <TableHead>{t("dmsExpiry")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell><Checkbox checked={selectedItems.includes(e.id)} onCheckedChange={() => toggleItem(e.id)} /></TableCell>
                  <TableCell className="font-mono">{e.entry_number}</TableCell>
                  <TableCell>{e.content_description}</TableCell>
                  <TableCell>{e.document_categories ? <Badge variant="outline">{e.document_categories.code}</Badge> : "-"}</TableCell>
                  <TableCell>{e.retention_years} {t("dmsYears")}</TableCell>
                  <TableCell>{e.expiryYear}</TableCell>
                  <TableCell>{expiryBadge(e)}</TableCell>
                </TableRow>
              ))}
              {candidates.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("dmsCandidatesEmpty")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="requests">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("dmsRequestNumber")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("reason")}</TableHead>
                <TableHead>{t("createdAt")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.request_number}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell>{r.reason || "-"}</TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => updateRequestStatus(r, "approved")}>
                            <CheckCircle className="h-3 w-3 mr-1" />{t("approve")}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => updateRequestStatus(r, "rejected")}>
                            <XCircle className="h-3 w-3 mr-1" />{t("reject")}
                          </Button>
                        </>
                      )}
                      {r.status === "approved" && (
                        <Button size="sm" variant="default" onClick={() => updateRequestStatus(r, "completed")}>
                          {t("dmsComplete")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {requests.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("dmsCreateRequest")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{selectedItems.length} {t("dmsItemsSelected")}</p>
            <div><Label>{t("reason")}</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={() => createRequestMutation.mutate()}>{t("dmsCreateRequest")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
