import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MyPayslips() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();

  const { data: employee } = useQuery({
    queryKey: ["my-employee", user?.id, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id")
        .eq("tenant_id", tenantId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId && !!user,
  });

  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ["my-payslips", employee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_items")
        .select("*, payroll_runs(month, year, status)")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employee!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!employee?.id && !!tenantId,
  });

  const downloadPayslip = async (payrollItemId: string) => {
    try {
      toast.info("Generišem PDF...");
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ type: "payslip", payroll_item_id: payrollItemId }),
        }
      );
      if (!res.ok) throw new Error("Greška pri generisanju");
      const html = await res.text();
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const fmtNum = (n: number) => new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2 }).format(n);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Moji platni listići</h1>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Bruto</TableHead>
            <TableHead>Neto</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {payslips.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nema platnih listića</TableCell></TableRow>
            ) : payslips.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{p.payroll_runs?.month}/{p.payroll_runs?.year}</TableCell>
                <TableCell>{fmtNum(p.gross_salary)}</TableCell>
                <TableCell className="font-medium">{fmtNum(p.net_salary)}</TableCell>
                <TableCell>{p.payroll_runs?.status}</TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => downloadPayslip(p.id)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
