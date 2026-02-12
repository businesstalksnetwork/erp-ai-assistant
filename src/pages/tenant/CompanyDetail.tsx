import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function CompanyDetail() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("*, company_category_assignments(category_id, company_categories(name, name_sr, color))")
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: linkedContacts = [] } = useQuery({
    queryKey: ["company-contacts", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("contact_company_assignments")
        .select("*, contacts(id, first_name, last_name, email, phone, type)")
        .eq("company_id", id!);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: relatedActivities = [] } = useQuery({
    queryKey: ["company-activities", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("*")
        .eq("company_id", id!)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (f: any) => {
      const { error } = await supabase.from("companies").update(f).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company", id] }); setEditing(false); toast.success(t("success")); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!company) return <div className="text-center py-20 text-muted-foreground">{t("noResults")}</div>;

  const startEdit = () => {
    setForm({
      legal_name: company.legal_name, display_name: company.display_name || "",
      email: company.email || "", phone: company.phone || "", website: company.website || "",
      address: company.address || "", city: company.city || "", postal_code: company.postal_code || "",
      notes: company.notes || "",
    });
    setEditing(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/crm/companies")}><ArrowLeft className="h-4 w-4 mr-1" />{t("back")}</Button>
        <h1 className="text-3xl font-bold">{company.display_name || company.legal_name}</h1>
        <div className="flex gap-1">
          {company.company_category_assignments?.map((a: any) => (
            <Badge key={a.category_id} variant="outline" style={{ borderColor: a.company_categories?.color }}>
              {a.company_categories?.name_sr || a.company_categories?.name}
            </Badge>
          ))}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("companyInfo")}</TabsTrigger>
          <TabsTrigger value="contacts">{t("contacts")} ({linkedContacts.length})</TabsTrigger>
          <TabsTrigger value="activities">{t("activities")} ({relatedActivities.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("companyInfo")}</CardTitle>
              {!editing ? (
                <Button variant="outline" size="sm" onClick={startEdit}><Pencil className="h-4 w-4 mr-1" />{t("edit")}</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="h-4 w-4 mr-1" />{t("cancel")}</Button>
                  <Button size="sm" onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}>
                    <Save className="h-4 w-4 mr-1" />{t("save")}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {editing && form ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2"><Label>{t("legalName")}</Label><Input value={form.legal_name} onChange={e => setForm({ ...form, legal_name: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>{t("displayName")}</Label><Input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>{t("email")}</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>{t("phone")}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>{t("website")}</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>{t("address")}</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>{t("city")}</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
                  <div className="grid gap-2"><Label>{t("postalCode")}</Label><Input value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} /></div>
                  <div className="grid gap-2 md:col-span-2"><Label>{t("notes")}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 text-sm">
                  <div><span className="text-muted-foreground">{t("legalName")}:</span> <strong>{company.legal_name}</strong></div>
                  <div><span className="text-muted-foreground">{t("pib")}:</span> {company.pib || "—"}</div>
                  <div><span className="text-muted-foreground">{t("maticniBroj")}:</span> {company.maticni_broj || "—"}</div>
                  <div><span className="text-muted-foreground">{t("email")}:</span> {company.email || "—"}</div>
                  <div><span className="text-muted-foreground">{t("phone")}:</span> {company.phone || "—"}</div>
                  <div><span className="text-muted-foreground">{t("website")}:</span> {company.website || "—"}</div>
                  <div><span className="text-muted-foreground">{t("address")}:</span> {company.address || "—"}, {company.city || ""} {company.postal_code || ""}</div>
                  <div><span className="text-muted-foreground">{t("status")}:</span> <Badge variant={company.status === "active" ? "default" : "secondary"}>{company.status}</Badge></div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("email")}</TableHead>
                    <TableHead>{t("phone")}</TableHead>
                    <TableHead>{t("type")}</TableHead>
                    <TableHead>{t("jobTitle")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedContacts.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("noResults")}</TableCell></TableRow>
                  ) : linkedContacts.map((lc: any) => (
                    <TableRow key={lc.id} className="cursor-pointer" onClick={() => navigate(`/crm/contacts/${lc.contacts?.id}`)}>
                      <TableCell className="font-medium">{lc.contacts?.first_name} {lc.contacts?.last_name || ""}</TableCell>
                      <TableCell>{lc.contacts?.email || "—"}</TableCell>
                      <TableCell>{lc.contacts?.phone || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{lc.contacts?.type}</Badge></TableCell>
                      <TableCell>{lc.job_title || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities">
          <Card>
            <CardContent className="pt-6">
              {relatedActivities.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t("noResults")}</p>
              ) : (
                <div className="space-y-3">
                  {relatedActivities.map((a: any) => (
                    <div key={a.id} className="flex items-start gap-3 text-sm border-b pb-3 last:border-0">
                      <Badge variant="outline">{a.type}</Badge>
                      <div>
                        <p>{a.description}</p>
                        <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("sr-RS")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
