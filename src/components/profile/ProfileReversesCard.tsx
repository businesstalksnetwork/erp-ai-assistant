import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileSignature, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface Props {
  employeeId: string;
}

export function ProfileReversesCard({ employeeId }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: reverses = [] } = useQuery({
    queryKey: ["profile-reverses", employeeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("asset_reverses")
        .select("id, revers_number, revers_date, status, signature_token, assets(name, asset_code)")
        .eq("tenant_id", tenantId!)
        .eq("employee_id", employeeId)
        .order("revers_date", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!tenantId && !!employeeId,
  });

  const statusVariant = (s: string) => {
    if (s === "signed") return "default";
    if (s === "pending_signature") return "secondary";
    if (s === "rejected") return "destructive";
    return "outline";
  };

  const pending = reverses.filter((r: any) => r.status === "pending_signature");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          {t("profileReverses" as any)}
          {pending.length > 0 && <Badge variant="destructive">{pending.length} {t("profilePending" as any)}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reverses.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">{t("profileNoReverses" as any)}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("profileReversNumber" as any)}</TableHead>
                <TableHead>{t("profileAsset" as any)}</TableHead>
                <TableHead>{t("date" as any)}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reverses.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.revers_number}</TableCell>
                  <TableCell>{r.assets?.name || "—"}</TableCell>
                  <TableCell>{format(new Date(r.revers_date), "dd.MM.yyyy")}</TableCell>
                  <TableCell><Badge variant={statusVariant(r.status)}>{r.status}</Badge></TableCell>
                  <TableCell>
                    {r.status === "pending_signature" && r.signature_token && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/sign/${r.signature_token}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" /> {t("profileSign" as any)}
                        </a>
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
  );
}
