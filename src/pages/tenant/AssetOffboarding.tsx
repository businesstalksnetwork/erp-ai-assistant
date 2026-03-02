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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, UserX, Search, RotateCcw, FileSignature } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function AssetOffboarding() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: employeesWithAssets = [], isLoading } = useQuery({
    queryKey: ["offboarding-employees", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data: assignments } = await supabase.from("asset_assignments")
        .select("*, assets(name, asset_code, inventory_number), employees(id, first_name, last_name, employee_id, status)")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .eq("assignment_type", "employee")
        .order("assigned_date", { ascending: false });
      
      if (!assignments) return [];
      const empMap = new Map<string, { employee: any; assignments: any[] }>();
      for (const a of assignments) {
        if (!a.employee_id || !a.employees) continue;
        if (!empMap.has(a.employee_id)) {
          empMap.set(a.employee_id, { employee: a.employees, assignments: [] });
        }
        empMap.get(a.employee_id)!.assignments.push(a);
      }
      return Array.from(empMap.values());
    },
    enabled: !!tenantId,
  });

  const filtered = employeesWithAssets.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.employee.first_name?.toLowerCase().includes(s) ||
      e.employee.last_name?.toLowerCase().includes(s) ||
      e.employee.employee_id?.toLowerCase().includes(s)
    );
  });

  const offboardMutation = useMutation({
    mutationFn: async (empData: { employee: any; assignments: any[] }) => {
      if (!tenantId || !user) throw new Error("Missing context");
      for (const assignment of empData.assignments) {
        await supabase.from("asset_assignments")
          .update({ status: "returned", returned_date: new Date().toISOString().split("T")[0] })
          .eq("id", assignment.id);
        const { data: reversNum } = await supabase.rpc("generate_revers_number", { p_tenant_id: tenantId });
        await supabase.from("asset_reverses").insert({
          tenant_id: tenantId,
          asset_id: assignment.asset_id,
          employee_id: assignment.employee_id,
          assignment_id: assignment.id,
          revers_number: reversNum || `REV-${Date.now()}`,
          revers_date: new Date().toISOString().split("T")[0],
          revers_type: "return",
          description: `Automatski revers - offboarding zaposlenog ${empData.employee.first_name} ${empData.employee.last_name}`,
          status: "signed",
          issued_by: user.id,
          signed_at: new Date().toISOString(),
          signed_by_name: empData.employee.first_name + " " + empData.employee.last_name,
        });
        const { data: otherActive } = await supabase.from("asset_assignments")
          .select("id")
          .eq("asset_id", assignment.asset_id)
          .eq("status", "active")
          .neq("id", assignment.id);
        if (!otherActive || otherActive.length === 0) {
          await supabase.from("assets").update({ status: "active" }).eq("id", assignment.asset_id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offboarding-employees", tenantId] });
      qc.invalidateQueries({ queryKey: ["asset-assignments", tenantId] });
      qc.invalidateQueries({ queryKey: ["asset-reverses", tenantId] });
      toast({ title: t("offboardingComplete") });
      setConfirmOpen(false);
      setSelectedEmployee(null);
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("offboardingTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("offboardingDesc")}</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5" />
            {t("offboardingEmployees")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">{t("offboardingNoAssets")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("employee")}</TableHead>
                  <TableHead>{t("employeeId")}</TableHead>
                  <TableHead>{t("offboardingAssetsCount")}</TableHead>
                  <TableHead>{t("offboardingAssetsList")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.employee.id}>
                    <TableCell className="font-medium">{e.employee.first_name} {e.employee.last_name}</TableCell>
                    <TableCell className="font-mono text-sm">{e.employee.employee_id}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{e.assignments.length}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {e.assignments.slice(0, 3).map((a: any) => (
                          <Badge key={a.id} variant="outline" className="text-xs">
                            {a.assets?.asset_code}
                          </Badge>
                        ))}
                        {e.assignments.length > 3 && (
                          <Badge variant="outline" className="text-xs">+{e.assignments.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => { setSelectedEmployee(e); setConfirmOpen(true); }}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" /> {t("offboardingReturnAll")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t("offboardingConfirm")}
            </DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4 py-2">
              <p className="text-muted-foreground">{t("offboardingConfirmDesc")}</p>
              <div className="font-semibold">
                {selectedEmployee.employee.first_name} {selectedEmployee.employee.last_name} ({selectedEmployee.employee.employee_id})
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("offboardingAssetsToReturn")}:</p>
                {selectedEmployee.assignments.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                    <FileSignature className="h-4 w-4 text-primary" />
                    <span className="font-mono">{a.assets?.asset_code}</span>
                    <span>{a.assets?.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              onClick={() => selectedEmployee && offboardMutation.mutate(selectedEmployee)}
              disabled={offboardMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              {t("offboardingExecute")} ({selectedEmployee?.assignments.length} {t("offboardingItems")})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
