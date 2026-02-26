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
import { UserCheck, RotateCcw, Plus, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AssignmentForm {
  asset_id: string;
  employee_id: string;
  location_id: string;
  assignment_type: string;
  assigned_date: string;
  notes: string;
}

const emptyForm: AssignmentForm = {
  asset_id: "", employee_id: "", location_id: "",
  assignment_type: "employee", assigned_date: new Date().toISOString().split("T")[0], notes: "",
};

export default function AssetAssignments() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AssignmentForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [returnDialogId, setReturnDialogId] = useState<string | null>(null);

  // Assets available for assignment
  const { data: assets = [] } = useQuery({
    queryKey: ["assignable-assets", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("assets")
        .select("id, name, asset_code, asset_type, inventory_number")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "in_use"])
        .order("asset_code");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Employees
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

  // Locations
  const { data: locations = [] } = useQuery({
    queryKey: ["asset-locations", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("asset_locations")
        .select("id, name, location_type")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Current assignments
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["asset-assignments", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("asset_assignments")
        .select("*, assets(name, asset_code, inventory_number), employees(first_name, last_name, employee_id), asset_locations(name)")
        .eq("tenant_id", tenantId)
        .order("assigned_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const filtered = assignments.filter((a: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      a.assets?.name?.toLowerCase().includes(s) ||
      a.assets?.asset_code?.toLowerCase().includes(s) ||
      a.employees?.last_name?.toLowerCase().includes(s) ||
      a.employees?.first_name?.toLowerCase().includes(s) ||
      a.asset_locations?.name?.toLowerCase().includes(s)
    );
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error("Missing context");

      const payload: any = {
        tenant_id: tenantId,
        asset_id: form.asset_id,
        assignment_type: form.assignment_type,
        assigned_date: form.assigned_date,
        assigned_by: user.id,
        status: "active",
        notes: form.notes || null,
        employee_id: form.assignment_type === "employee" ? form.employee_id || null : null,
        location_id: form.assignment_type === "location" ? form.location_id || null : null,
      };

      const { error } = await supabase.from("asset_assignments").insert(payload);
      if (error) throw error;

      // Update asset status to in_use
      await supabase.from("assets").update({ status: "in_use" }).eq("id", form.asset_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-assignments", tenantId] });
      qc.invalidateQueries({ queryKey: ["assignable-assets", tenantId] });
      toast({ title: t("assetsAssigned" as any) });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const returnMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      if (!tenantId) throw new Error("No tenant");
      const assignment = assignments.find((a: any) => a.id === assignmentId);
      
      const { error } = await supabase.from("asset_assignments")
        .update({ status: "returned", returned_date: new Date().toISOString().split("T")[0] })
        .eq("id", assignmentId);
      if (error) throw error;

      // Check if asset has other active assignments
      if (assignment?.asset_id) {
        const { data: otherActive } = await supabase.from("asset_assignments")
          .select("id")
          .eq("asset_id", assignment.asset_id)
          .eq("status", "active")
          .neq("id", assignmentId);
        
        if (!otherActive || otherActive.length === 0) {
          await supabase.from("assets").update({ status: "active" }).eq("id", assignment.asset_id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-assignments", tenantId] });
      qc.invalidateQueries({ queryKey: ["assignable-assets", tenantId] });
      toast({ title: t("assetsReturned" as any) });
      setReturnDialogId(null);
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const statusColor = (s: string) => {
    if (s === "active") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (s === "returned") return "bg-muted text-muted-foreground";
    return "bg-amber-100 text-amber-800";
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("assetsAssignments" as any)}</h1>
        <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> {t("assetsNewAssignment" as any)}
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardHeader><CardTitle>{t("assetsAssignmentHistory" as any)}</CardTitle></CardHeader>
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
                  <TableHead>{t("assetsAssignedTo" as any)}</TableHead>
                  <TableHead>{t("type" as any)}</TableHead>
                  <TableHead>{t("date" as any)}</TableHead>
                  <TableHead>{t("assetsReturnDate" as any)}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{a.assets?.asset_code}</TableCell>
                    <TableCell className="font-medium">{a.assets?.name}</TableCell>
                    <TableCell>
                      {a.assignment_type === "employee" && a.employees
                        ? `${a.employees.first_name} ${a.employees.last_name}`
                        : a.asset_locations?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {a.assignment_type === "employee" ? <><UserCheck className="h-3 w-3 mr-1" /> {t("employee" as any)}</> : t("assetsLocation" as any)}
                      </Badge>
                    </TableCell>
                    <TableCell>{a.assigned_date}</TableCell>
                    <TableCell>{a.returned_date || "—"}</TableCell>
                    <TableCell><Badge className={statusColor(a.status)}>{a.status}</Badge></TableCell>
                    <TableCell>
                      {a.status === "active" && (
                        <Button variant="ghost" size="sm" onClick={() => setReturnDialogId(a.id)}>
                          <RotateCcw className="h-4 w-4 mr-1" /> {t("assetsReturn" as any)}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Assignment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("assetsNewAssignment" as any)}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
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
              <Label>{t("assetsAssignmentType" as any)}</Label>
              <Select value={form.assignment_type} onValueChange={(v) => setForm({ ...form, assignment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">{t("employee" as any)}</SelectItem>
                  <SelectItem value="location">{t("assetsLocation" as any)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.assignment_type === "employee" && (
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
            )}
            {form.assignment_type === "location" && (
              <div className="grid gap-2">
                <Label>{t("assetsLocation" as any)}</Label>
                <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {locations.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label>{t("date" as any)}</Label>
              <Input type="date" value={form.assigned_date} onChange={(e) => setForm({ ...form, assigned_date: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>{t("notes" as any)}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending || !form.asset_id}>
              <UserCheck className="h-4 w-4 mr-1" /> {t("assetsAssign" as any)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Confirmation */}
      <Dialog open={!!returnDialogId} onOpenChange={() => setReturnDialogId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("assetsConfirmReturn" as any)}</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">{t("assetsConfirmReturnDesc" as any)}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDialogId(null)}>{t("cancel")}</Button>
            <Button onClick={() => returnDialogId && returnMutation.mutate(returnDialogId)} disabled={returnMutation.isPending}>
              <RotateCcw className="h-4 w-4 mr-1" /> {t("assetsReturn" as any)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
