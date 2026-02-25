import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ReportSnapshots() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ["report-snapshots", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("report_snapshots")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("frozen_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("report_snapshots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["report-snapshots"] }); toast.success("Snapshot obrisan"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const typeLabel: Record<string, string> = {
    balance_sheet: "Bilans stanja",
    income_statement: "Bilans uspeha",
    trial_balance: "Bruto bilans",
    statisticki_aneks: "Statistički aneks",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Arhiva izveštaja" icon={Archive} description="Zamrznute verzije finansijskih izveštaja za regulatorne potrebe" />

      {isLoading ? <Skeleton className="h-64 w-full" /> : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naziv</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Zamrznuto</TableHead>
                  <TableHead>Napomena</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.report_title}</TableCell>
                    <TableCell><Badge variant="outline">{typeLabel[s.report_type] || s.report_type}</Badge></TableCell>
                    <TableCell>{s.period_from} — {s.period_to}</TableCell>
                    <TableCell>{new Date(s.frozen_at).toLocaleDateString("sr-Latn")}</TableCell>
                    <TableCell className="text-muted-foreground">{s.notes || "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(s.id)} disabled={deleteMut.isPending}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {snapshots.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nema sačuvanih izveštaja. Koristite dugme "Zamrzni" na stranicama Bilans stanja ili Bilans uspeha.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
