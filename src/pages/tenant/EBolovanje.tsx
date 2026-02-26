import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Heart, Plus, Search, Send, Eye, Filter } from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  paid: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

const claimTypeLabels: Record<string, string> = {
  sick_leave: "Bolovanje",
  maternity: "Porodiljsko",
  work_injury: "Povreda na radu",
};

export default function EBolovanje() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { entities: legalEntities } = useLegalEntities();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailClaim, setDetailClaim] = useState<any>(null);

  const emptyForm = {
    employee_id: "",
    legal_entity_id: "",
    claim_type: "sick_leave",
    start_date: "",
    end_date: "",
    diagnosis_code: "",
    doctor_name: "",
    medical_facility: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  // Fetch claims
  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["ebolovanje_claims", tenantId, statusFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from("ebolovanje_claims")
        .select("*, employees(full_name), legal_entities(name)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch employees for dropdown
  const { data: employees = [] } = useQuery({
    queryKey: ["employees_list", tenantId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("employees")
        .select("id, full_name")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .eq("is_ghost", false)
        .order("full_name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch doznake for detail view
  const { data: doznake = [] } = useQuery({
    queryKey: ["ebolovanje_doznake", detailClaim?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ebolovanje_doznake")
        .select("*")
        .eq("claim_id", detailClaim!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!detailClaim,
  });

  // Fetch connection status
  const { data: connection } = useQuery({
    queryKey: ["ebolovanje_connection", tenantId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ebolovanje_connections")
        .select("*")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("ebolovanje_claims").insert({
        tenant_id: tenantId!,
        employee_id: form.employee_id,
        legal_entity_id: form.legal_entity_id || null,
        claim_type: form.claim_type,
        start_date: form.start_date,
        end_date: form.end_date || null,
        diagnosis_code: form.diagnosis_code || null,
        doctor_name: form.doctor_name || null,
        medical_facility: form.medical_facility || null,
        notes: form.notes || null,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ebolovanje_claims"] });
      toast({ title: t("success") });
      setCreateOpen(false);
      setForm(emptyForm);
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const { data, error } = await supabase.functions.invoke("ebolovanje-submit", {
        body: { claim_id: claimId, tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ebolovanje_claims"] });
      toast({ title: t("success"), description: t("claimSubmitted") });
    },
    onError: (err: any) => toast({ title: t("error"), description: err.message, variant: "destructive" }),
  });

  const filtered = claims.filter((c: any) => {
    if (!search) return true;
    const empName = c.employees?.full_name || "";
    return empName.toLowerCase().includes(search.toLowerCase()) ||
      c.rfzo_claim_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.diagnosis_code?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Heart className="h-6 w-6" />
          {t("eBolovanje")}
        </h1>
        <div className="flex items-center gap-2">
          {connection?.is_active ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{t("connectionActive")}</Badge>
          ) : (
            <Badge variant="secondary">{t("connectionInactive")}</Badge>
          )}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />{t("newClaim")}
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="draft">{t("draft")}</SelectItem>
            <SelectItem value="submitted">{t("submitted")}</SelectItem>
            <SelectItem value="confirmed">{t("confirmed")}</SelectItem>
            <SelectItem value="rejected">{t("rejected")}</SelectItem>
            <SelectItem value="paid">{t("paid")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <p>{t("loading")}</p> : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{t("noResults")}</CardContent></Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("employee")}</TableHead>
              <TableHead>{t("claimType")}</TableHead>
              <TableHead>{t("startDate")}</TableHead>
              <TableHead>{t("endDate")}</TableHead>
              <TableHead>{t("diagnosisCode")}</TableHead>
              <TableHead>{t("rfzoNumber")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((claim: any) => (
              <TableRow key={claim.id}>
                <TableCell className="font-medium">{claim.employees?.full_name || "—"}</TableCell>
                <TableCell>{claimTypeLabels[claim.claim_type] || claim.claim_type}</TableCell>
                <TableCell>{format(new Date(claim.start_date), "dd.MM.yyyy")}</TableCell>
                <TableCell>{claim.end_date ? format(new Date(claim.end_date), "dd.MM.yyyy") : "—"}</TableCell>
                <TableCell className="font-mono text-xs">{claim.diagnosis_code || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{claim.rfzo_claim_number || "—"}</TableCell>
                <TableCell>
                  <Badge className={statusColors[claim.status] || ""}>{t(claim.status as any)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {claim.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => submitMutation.mutate(claim.id)} disabled={submitMutation.isPending}>
                        <Send className="h-3 w-3 mr-1" />{t("submit")}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setDetailClaim(claim)}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("newClaim")}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <Label>{t("employee")}</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm(f => ({ ...f, employee_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t("selectEmployee")} /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {legalEntities.length > 1 && (
              <div>
                <Label>{t("legalEntity")}</Label>
                <Select value={form.legal_entity_id} onValueChange={(v) => setForm(f => ({ ...f, legal_entity_id: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("selectLegalEntity")} /></SelectTrigger>
                  <SelectContent>{legalEntities.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{t("claimType")}</Label>
              <Select value={form.claim_type} onValueChange={(v) => setForm(f => ({ ...f, claim_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sick_leave">{t("sickLeave")}</SelectItem>
                  <SelectItem value="maternity">{t("maternity")}</SelectItem>
                  <SelectItem value="work_injury">{t("workInjury")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("startDate")}</Label><Input type="date" value={form.start_date} onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>{t("endDate")}</Label><Input type="date" value={form.end_date} onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("diagnosisCode")}</Label><Input value={form.diagnosis_code} onChange={(e) => setForm(f => ({ ...f, diagnosis_code: e.target.value }))} placeholder="J06.9" /></div>
              <div><Label>{t("doctorName")}</Label><Input value={form.doctor_name} onChange={(e) => setForm(f => ({ ...f, doctor_name: e.target.value }))} /></div>
            </div>
            <div><Label>{t("medicalFacility")}</Label><Input value={form.medical_facility} onChange={(e) => setForm(f => ({ ...f, medical_facility: e.target.value }))} /></div>
            <div><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.employee_id || !form.start_date || createMutation.isPending}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailClaim} onOpenChange={() => setDetailClaim(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t("claimDetails")}</DialogTitle></DialogHeader>
          {detailClaim && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">{t("employee")}:</span> {detailClaim.employees?.full_name}</div>
                <div><span className="text-muted-foreground">{t("status")}:</span> <Badge className={statusColors[detailClaim.status]}>{t(detailClaim.status as any)}</Badge></div>
                <div><span className="text-muted-foreground">{t("claimType")}:</span> {claimTypeLabels[detailClaim.claim_type]}</div>
                <div><span className="text-muted-foreground">{t("diagnosisCode")}:</span> {detailClaim.diagnosis_code || "—"}</div>
                <div><span className="text-muted-foreground">{t("startDate")}:</span> {format(new Date(detailClaim.start_date), "dd.MM.yyyy")}</div>
                <div><span className="text-muted-foreground">{t("endDate")}:</span> {detailClaim.end_date ? format(new Date(detailClaim.end_date), "dd.MM.yyyy") : "—"}</div>
                <div><span className="text-muted-foreground">{t("doctorName")}:</span> {detailClaim.doctor_name || "—"}</div>
                <div><span className="text-muted-foreground">{t("medicalFacility")}:</span> {detailClaim.medical_facility || "—"}</div>
                {detailClaim.rfzo_claim_number && <div><span className="text-muted-foreground">{t("rfzoNumber")}:</span> {detailClaim.rfzo_claim_number}</div>}
                {detailClaim.amount && <div><span className="text-muted-foreground">{t("amount")}:</span> {Number(detailClaim.amount).toLocaleString("sr-RS", { minimumFractionDigits: 2 })} RSD</div>}
              </div>
              {detailClaim.notes && <p className="text-sm text-muted-foreground">{detailClaim.notes}</p>}

              {/* Doznake */}
              {doznake.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">{t("confirmations")} ({doznake.length})</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("claimNumber")}</TableHead>
                        <TableHead>{t("validFrom")}</TableHead>
                        <TableHead>{t("validTo")}</TableHead>
                        <TableHead>{t("status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {doznake.map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-mono text-xs">{d.doznaka_number}</TableCell>
                          <TableCell>{d.valid_from ? format(new Date(d.valid_from), "dd.MM.yyyy") : "—"}</TableCell>
                          <TableCell>{d.valid_to ? format(new Date(d.valid_to), "dd.MM.yyyy") : "—"}</TableCell>
                          <TableCell><Badge variant="outline">{d.rfzo_status || "—"}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
