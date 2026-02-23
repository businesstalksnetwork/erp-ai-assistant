import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Calendar, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

interface Props {
  opp: any;
  isClosed: boolean;
  fmt: (n: number) => string;
  contactName: string;
  oppPartners: any[];
  oppMeetings: any[];
  followers: any[];
  tenantMembers: any[];
  onCreateQuote: () => void;
  onLogMeeting: () => void;
  onAddFollower: (userId: string) => void;
  onRemoveFollower: (followerId: string) => void;
  createQuotePending: boolean;
}

export function OpportunityOverviewTab({
  opp, isClosed, fmt, contactName, oppPartners, oppMeetings,
  followers, tenantMembers, onCreateQuote, onLogMeeting,
  onAddFollower, onRemoveFollower, createQuotePending,
}: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const nonFollowerMembers = tenantMembers.filter(
    m => !followers.some((f: any) => f.user_id === m.user_id)
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("companyInfo")}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><span className="text-muted-foreground">{t("value")}:</span> <strong>{fmt(opp.value)}</strong></div>
            <div><span className="text-muted-foreground">{t("probability")}:</span> {opp.probability}%</div>
            <div><span className="text-muted-foreground">{t("contactPerson")}:</span> {contactName}</div>
            <div><span className="text-muted-foreground">{t("expectedCloseDate")}:</span> {opp.expected_close_date || "—"}</div>
            {opp.closed_at && <div><span className="text-muted-foreground">{t("closedAt")}:</span> {new Date(opp.closed_at).toLocaleDateString("sr-RS")}</div>}
            {opp.description && <div><span className="text-muted-foreground">{t("description")}:</span> {opp.description}</div>}
            {opp.notes && <div><span className="text-muted-foreground">{t("notes")}:</span> {opp.notes}</div>}
            {oppPartners.length > 0 && (
              <div>
                <span className="text-muted-foreground">{t("opportunityPartners")}:</span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {oppPartners.map((op: any) => (
                    <Badge key={op.id} variant="outline">{(op as any).partners?.name}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t("actions")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {!isClosed && (
                <Button variant="outline" className="w-full justify-start" onClick={onCreateQuote} disabled={createQuotePending}>
                  <FileText className="h-4 w-4 mr-2" />{t("createQuote")}
                </Button>
              )}
              <Button variant="outline" className="w-full justify-start" onClick={onLogMeeting}>
                <Calendar className="h-4 w-4 mr-2" />{t("logMeeting")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t("followers")} ({followers.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {followers.map((f: any) => (
                  <Badge key={f.id} variant="secondary" className="gap-1">
                    {f.profiles?.full_name || f.user_id?.slice(0, 8)}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => onRemoveFollower(f.id)} />
                  </Badge>
                ))}
              </div>
              {nonFollowerMembers.length > 0 && (
                <Select onValueChange={onAddFollower}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("addFollower")} />
                  </SelectTrigger>
                  <SelectContent>
                    {nonFollowerMembers.map((m: any) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.profiles?.full_name || m.user_id?.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("meetings")} ({oppMeetings.length})</CardTitle></CardHeader>
        <CardContent>
          {oppMeetings.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">{t("noResults")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("title")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("outcome")}</TableHead>
                    <TableHead>{t("nextSteps")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {oppMeetings.map((m: any) => (
                    <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/crm/meetings?edit=${m.id}`)}>
                      <TableCell className="font-medium">{m.title}</TableCell>
                      <TableCell className="whitespace-nowrap">{new Date(m.scheduled_at).toLocaleString("sr-RS", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                      <TableCell><Badge variant="secondary">{t(m.status as any) || m.status}</Badge></TableCell>
                      <TableCell className="max-w-[200px] truncate">{m.outcome || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{m.next_steps || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
