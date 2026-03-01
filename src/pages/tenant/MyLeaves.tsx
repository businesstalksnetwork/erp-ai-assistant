import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function MyLeaves() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const year = new Date().getFullYear();

  const { data: employee } = useQuery({
    queryKey: ["my-employee", user?.id, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, first_name, last_name")
        .eq("tenant_id", tenantId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId && !!user,
  });

  const { data: balance } = useQuery({
    queryKey: ["my-leave-balance", employee?.id, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("annual_leave_balances")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employee!.id)
        .eq("year", year)
        .maybeSingle();
      return data;
    },
    enabled: !!employee?.id && !!tenantId,
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["my-leave-requests", employee?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employee!.id)
        .order("start_date", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!employee?.id && !!tenantId,
  });

  const statusVariant = (s: string) => s === "approved" ? "default" : s === "pending" ? "outline" : "destructive";

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  const remaining = balance ? (balance.entitled_days + balance.carried_over_days - balance.used_days - balance.pending_days) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Moji odmori</h1>

      {balance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{balance.entitled_days}</p>
            <p className="text-xs text-muted-foreground">Pravo na dane</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{balance.used_days}</p>
            <p className="text-xs text-muted-foreground">Iskorišćeno</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{balance.pending_days}</p>
            <p className="text-xs text-muted-foreground">Na čekanju</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{remaining}</p>
            <p className="text-xs text-muted-foreground">Preostalo</p>
          </CardContent></Card>
        </div>
      )}

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tip</TableHead>
            <TableHead>Od</TableHead>
            <TableHead>Do</TableHead>
            <TableHead>Dana</TableHead>
            <TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nema zahteva</TableCell></TableRow>
            ) : requests.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.leave_type}</TableCell>
                <TableCell>{format(new Date(r.start_date), "dd.MM.yyyy")}</TableCell>
                <TableCell>{format(new Date(r.end_date), "dd.MM.yyyy")}</TableCell>
                <TableCell>{r.total_days}</TableCell>
                <TableCell><Badge variant={statusVariant(r.status)}>{r.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
