import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ContactDetail() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("contacts")
        .select("*, contact_company_assignments(company_id, job_title, department, companies(id, legal_name, display_name))")
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: relatedLeads = [] } = useQuery({
    queryKey: ["contact-leads", id],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id, first_name, last_name, name, status").eq("contact_id", id!);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: relatedOpps = [] } = useQuery({
    queryKey: ["contact-opps", id],
    queryFn: async () => {
      const { data } = await supabase.from("opportunities").select("id, title, value, stage").eq("contact_id", id!);
      return data || [];
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!contact) return <div className="text-center py-20 text-muted-foreground">{t("noResults")}</div>;

  const fmt = (n: number) => new Intl.NumberFormat("sr-RS", { style: "currency", currency: "RSD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/crm/contacts")}><ArrowLeft className="h-4 w-4 mr-1" />{t("back")}</Button>
        <h1 className="text-3xl font-bold">{contact.first_name} {contact.last_name || ""}</h1>
        <Badge variant="secondary">{t(contact.type as any)}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("contactInfo")}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <div><span className="text-muted-foreground">{t("email")}:</span> {contact.email || "—"}</div>
            <div><span className="text-muted-foreground">{t("phone")}:</span> {contact.phone || "—"}</div>
            {contact.seniority_level && <div><span className="text-muted-foreground">{t("seniorityLevel")}:</span> {t(contact.seniority_level as any) || contact.seniority_level}</div>}
            {contact.function_area && <div><span className="text-muted-foreground">{t("functionArea")}:</span> {t(contact.function_area as any) || contact.function_area}</div>}
            {contact.address && <div><span className="text-muted-foreground">{t("address")}:</span> {contact.address}, {contact.city || ""}</div>}
            {contact.notes && <div><span className="text-muted-foreground">{t("notes")}:</span> {contact.notes}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("companies")}</CardTitle></CardHeader>
          <CardContent>
            {contact.contact_company_assignments?.length > 0 ? (
              <div className="space-y-2">
                {contact.contact_company_assignments.map((a: any) => (
                  <div key={a.company_id} className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-muted"
                    onClick={() => navigate(`/crm/companies/${a.company_id}`)}>
                    <div>
                      <span className="font-medium">{a.companies?.display_name || a.companies?.legal_name}</span>
                      {a.job_title && <span className="text-muted-foreground text-sm ml-2">— {a.job_title}</span>}
                    </div>
                    {a.department && <Badge variant="outline">{a.department}</Badge>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t("noResults")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Related Leads */}
      {relatedLeads.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("leads")} ({relatedLeads.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatedLeads.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.first_name || l.name} {l.last_name || ""}</TableCell>
                    <TableCell><Badge variant="secondary">{t(l.status as any)}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Related Opportunities */}
      {relatedOpps.length > 0 && (
        <Card>
          <CardHeader><CardTitle>{t("opportunities")} ({relatedOpps.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("title")}</TableHead>
                  <TableHead>{t("value")}</TableHead>
                  <TableHead>{t("stage")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatedOpps.map((o: any) => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => navigate(`/crm/opportunities/${o.id}`)}>
                    <TableCell>{o.title}</TableCell>
                    <TableCell>{fmt(o.value)}</TableCell>
                    <TableCell><Badge variant="secondary">{t(o.stage as any)}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
