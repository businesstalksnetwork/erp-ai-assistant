import { useLanguage } from "@/i18n/LanguageContext";
import { useLeaveRequest } from "@/hooks/useLeaveRequest";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, X } from "lucide-react";

interface Props {
  employeeId: string;
}

const formatDate = (d: string | null) => {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getDate().toString().padStart(2, "0")}.${(dt.getMonth() + 1).toString().padStart(2, "0")}.${dt.getFullYear()}`;
};

const statusVariant = (s: string) => {
  switch (s) {
    case "approved": return "default";
    case "rejected": return "destructive";
    case "cancelled": return "outline";
    default: return "secondary";
  }
};

const statusLabel: Record<string, string> = {
  pending: "Na čekanju",
  approved: "Odobreno",
  rejected: "Odbijeno",
  cancelled: "Otkazano",
};

const leaveTypeLabel: Record<string, string> = {
  vacation: "Godišnji odmor",
  sick: "Bolovanje",
  personal: "Lično",
  maternity: "Porodiljsko",
  paternity: "Očinsko",
  unpaid: "Neplaćeno",
};

export function LeaveRequestHistory({ employeeId }: Props) {
  const { t } = useLanguage();
  const { ownRequests, cancelMutation } = useLeaveRequest(employeeId);
  const requests = ownRequests.data || [];

  if (requests.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5" />
          {t("leaveRequestHistory") || "Istorija zahteva za odsustvo"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("leaveType")}</TableHead>
              <TableHead>{t("startDate")}</TableHead>
              <TableHead>{t("endDate")}</TableHead>
              <TableHead>{t("daysCount")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{leaveTypeLabel[r.leave_type] || r.leave_type}</TableCell>
                <TableCell>{formatDate(r.start_date)}</TableCell>
                <TableCell>{formatDate(r.end_date)}</TableCell>
                <TableCell>{r.days_count}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(r.status) as any}>
                    {statusLabel[r.status] || r.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {r.status === "pending" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => cancelMutation.mutate(r.id)}
                      disabled={cancelMutation.isPending}
                    >
                      <X className="h-4 w-4 mr-1" /> Otkaži
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
