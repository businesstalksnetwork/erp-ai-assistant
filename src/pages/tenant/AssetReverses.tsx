import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FileSignature, Plus, Search, FileText, CheckCircle, XCircle, Send, Bell, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ReversForm {
  asset_id: string;
  employee_id: string;
  revers_type: string;
  revers_date: string;
  description: string;
  condition_on_handover: string;
  accessories: string;
  notes: string;
}

const emptyForm: ReversForm = {
  asset_id: "", employee_id: "", revers_type: "handover",
  revers_date: new Date().toISOString().split("T")[0],
  description: "", condition_on_handover: "", accessories: "", notes: "",
};

export default function AssetReverses() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ReversForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailRevers, setDetailRevers] = useState<any>(null);

  const { data: assets = [] } = useQuery({
    queryKey: ["assignable-assets-revers", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("assets")
        .select("id, name, asset_code, inventory_number")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "in_use"])
        .order("asset_code");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("employees")
        .select("id, first_name, last_name, employee_id")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("last_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: reverses = [], isLoading } = useQuery({
    queryKey: ["asset-reverses", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("asset_reverses")
        .select("*, assets(name, asset_code, inventory_number), employees(first_name, last_name, employee_id)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = reverses.filter((r: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.revers_number?.toLowerCase().includes(s) ||
      r.assets?.name?.toLowerCase().includes(s) ||
      r.assets?.asset_code?.toLowerCase().includes(s) ||
      r.employees?.last_name?.toLowerCase().includes(s)
    );
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error("Missing context");
      const { data: reversNum } = await supabase.rpc("generate_revers_number", { p_tenant_id: tenantId });
      const payload: any = {
        tenant_id: tenantId,
        asset_id: form.asset_id,
        employee_id: form.employee_id || null,
        revers_number: reversNum || `REV-${Date.now()}`,
        revers_date: form.revers_date,
        revers_type: form.revers_type,
        description: form.description || null,
        condition_on_handover: form.condition_on_handover || null,
        accessories: form.accessories || null,
        notes: form.notes || null,
        status: "draft",
        issued_by: user.id,
      };
      const { error } = await supabase.from("asset_reverses").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-reverses", tenantId] });
      toast({ title: t("reversCreated" as any) });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const sendForSignature = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("send-revers-notification", {
        body: {
          revers_id: id,
          tenant_id: tenantId,
          action: "request_signature",
          app_url: window.location.origin,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["asset-reverses", tenantId] });
      const msg = data?.emailSent
        ? t("reversSentForSignature" as any) + ` (${data.recipientEmail})`
        : t("reversSentForSignature" as any) + ` — ${t("reversEmailNotConfigured" as any)}`;
      toast({ title: msg });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const sendReminder = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("send-revers-notification", {
        body: {
          revers_id: id,
          tenant_id: tenantId,
          action: "reminder",
          app_url: window.location.origin,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["asset-reverses", tenantId] });
      toast({ title: t("reversReminderSent" as any) });
    },
  });

  const rejectRevers = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from("asset_reverses")
        .update({ status: "rejected", rejection_reason: reason })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-reverses", tenantId] });
      toast({ title: t("reversRejected" as any) });
      setRejectDialogOpen(false);
      setRejectionReason("");
    },
  });

  const signRevers = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("asset_reverses")
        .update({
          status: "signed",
          issuer_signed_at: new Date().toISOString(),
          issuer_signed_by_name: user?.user_metadata?.full_name || user?.email || "—",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-reverses", tenantId] });
      toast({ title: t("reversSigned" as any) });
    },
  });

  const handleGeneratePdf = async (revers: any) => {
    setPdfLoading(revers.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-pdf", {
        body: { type: "asset_revers", tenant_id: tenantId, revers_id: revers.id },
      });
      if (error) throw error;
      const blob = new Blob([data], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e: any) {
      toast({ title: t("error"), description: e.message, variant: "destructive" });
    } finally {
      setPdfLoading(null);
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "draft": return "bg-muted text-muted-foreground";
      case "pending_signature": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "signed": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "rejected": return "bg-destructive/10 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "draft": return t("draft" as any);
      case "pending_signature": return t("reversPendingSignature" as any);
      case "signed": return t("reversSigned" as any);
      case "rejected": return t("reversRejected" as any);
      case "cancelled": return t("cancelled" as any);
      default: return s;
    }
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("reversDocuments" as any)}</h1>
        <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> {t("reversNew" as any)}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardHeader><CardTitle>{t("reversDocuments" as any)}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t("noResults")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reversNumber" as any)}</TableHead>
                  <TableHead>{t("date" as any)}</TableHead>
                  <TableHead>{t("type" as any)}</TableHead>
                  <TableHead>{t("assetsSelectAsset" as any)}</TableHead>
                  <TableHead>{t("employee" as any)}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.revers_number}</TableCell>
                    <TableCell>{r.revers_date}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {r.revers_type === "handover" ? t("reversHandover" as any) : t("reversReturn" as any)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{r.assets?.name}</span>
                      <span className="text-xs text-muted-foreground ml-1">({r.assets?.asset_code})</span>
                    </TableCell>
                    <TableCell>
                      {r.employees ? `${r.employees.first_name} ${r.employees.last_name}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge className={statusColor(r.status)}>{statusLabel(r.status)}</Badge>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          {r.notification_sent_at && <div>{t("reversNotificationSent" as any)}: {new Date(r.notification_sent_at).toLocaleString()}</div>}
                          {r.reminder_sent_at && <div>{t("reversReminderSentAt" as any)}: {new Date(r.reminder_sent_at).toLocaleString()}</div>}
                          {r.employee_signed_at && <div>{t("reversSigned" as any)}: {new Date(r.employee_signed_at).toLocaleString()} ({r.employee_signed_by_name})</div>}
                          {r.issuer_signed_at && <div>{t("reversIssuerSigned" as any)}: {new Date(r.issuer_signed_at).toLocaleString()}</div>}
                          {!r.notification_sent_at && !r.employee_signed_at && <div>{statusLabel(r.status)}</div>}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {/* Detail / Preview */}
                        <Button variant="ghost" size="sm" onClick={() => { setDetailRevers(r); setDetailDialogOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {/* PDF */}
                        <Button variant="ghost" size="sm" onClick={() => handleGeneratePdf(r)} disabled={pdfLoading === r.id}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        {/* Send for signature */}
                        {r.status === "draft" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => sendForSignature.mutate(r.id)} disabled={sendForSignature.isPending}>
                                <Send className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("reversSendForSignature" as any)}</TooltipContent>
                          </Tooltip>
                        )}
                        {/* Reminder */}
                        {r.status === "pending_signature" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => sendReminder.mutate(r.id)} disabled={sendReminder.isPending}>
                                <Bell className="h-4 w-4 text-amber-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("reversSendReminder" as any)}</TooltipContent>
                          </Tooltip>
                        )}
                        {/* Admin sign */}
                        {r.status === "pending_signature" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => signRevers.mutate(r.id)}>
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("reversAdminSign" as any)}</TooltipContent>
                          </Tooltip>
                        )}
                        {/* Reject */}
                        {(r.status === "draft" || r.status === "pending_signature") && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" onClick={() => { setRejectTarget(r); setRejectionReason(""); setRejectDialogOpen(true); }}>
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("reversReject" as any)}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Revers Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("reversNew" as any)}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("type" as any)}</Label>
              <Select value={form.revers_type} onValueChange={(v) => setForm({ ...form, revers_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="handover">{t("reversHandover" as any)}</SelectItem>
                  <SelectItem value="return">{t("reversReturn" as any)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("assetsSelectAsset" as any)}</Label>
              <Select value={form.asset_id} onValueChange={(v) => setForm({ ...form, asset_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {assets.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.asset_code} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("employee" as any)}</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("date" as any)}</Label>
              <Input type="date" value={form.revers_date} onChange={(e) => setForm({ ...form, revers_date: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>{t("reversCondition" as any)}</Label>
              <Input value={form.condition_on_handover} onChange={(e) => setForm({ ...form, condition_on_handover: e.target.value })} placeholder={t("reversConditionPlaceholder" as any)} />
            </div>
            <div className="grid gap-2">
              <Label>{t("reversAccessories" as any)}</Label>
              <Input value={form.accessories} onChange={(e) => setForm({ ...form, accessories: e.target.value })} placeholder={t("reversAccessoriesPlaceholder" as any)} />
            </div>
            <div className="grid gap-2">
              <Label>{t("notes" as any)}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.asset_id}>
              <FileSignature className="h-4 w-4 mr-1" /> {t("reversCreateNew" as any)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("reversReject" as any)}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t("reversRejectConfirm" as any)} <strong>{rejectTarget?.revers_number}</strong>
            </p>
            <div className="space-y-2">
              <Label>{t("reversRejectionReason" as any)}</Label>
              <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3} placeholder={t("reversRejectionReasonPlaceholder" as any)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={() => rejectTarget && rejectRevers.mutate({ id: rejectTarget.id, reason: rejectionReason })} disabled={rejectRevers.isPending || !rejectionReason.trim()}>
              <XCircle className="h-4 w-4 mr-1" /> {t("reversReject" as any)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Preview Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("reversNumber" as any)}: {detailRevers?.revers_number}</DialogTitle></DialogHeader>
          {detailRevers && (
            <div className="space-y-3 text-sm py-2">
              <DetailRow label={t("type" as any)} value={detailRevers.revers_type === "handover" ? t("reversHandover" as any) : t("reversReturn" as any)} />
              <DetailRow label={t("assetsSelectAsset" as any)} value={`${detailRevers.assets?.asset_code} — ${detailRevers.assets?.name}`} />
              <DetailRow label={t("employee" as any)} value={detailRevers.employees ? `${detailRevers.employees.first_name} ${detailRevers.employees.last_name}` : "—"} />
              <DetailRow label={t("date" as any)} value={detailRevers.revers_date} />
              <DetailRow label={t("status")} value={statusLabel(detailRevers.status)} />
              {detailRevers.condition_on_handover && <DetailRow label={t("reversCondition" as any)} value={detailRevers.condition_on_handover} />}
              {detailRevers.accessories && <DetailRow label={t("reversAccessories" as any)} value={detailRevers.accessories} />}
              {detailRevers.notes && <DetailRow label={t("notes" as any)} value={detailRevers.notes} />}
              {detailRevers.rejection_reason && <DetailRow label={t("reversRejectionReason" as any)} value={detailRevers.rejection_reason} />}
              {detailRevers.notification_sent_at && <DetailRow label={t("reversNotificationSent" as any)} value={new Date(detailRevers.notification_sent_at).toLocaleString()} />}
              {detailRevers.employee_signed_at && <DetailRow label={t("reversEmployeeSigned" as any)} value={`${detailRevers.employee_signed_by_name} — ${new Date(detailRevers.employee_signed_at).toLocaleString()}`} />}
              {detailRevers.issuer_signed_at && <DetailRow label={t("reversIssuerSigned" as any)} value={`${detailRevers.issuer_signed_by_name} — ${new Date(detailRevers.issuer_signed_at).toLocaleString()}`} />}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}
