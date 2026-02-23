import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Plus, Download, UserX, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

const REQUEST_TYPES = ["access", "erasure", "portability", "rectification"] as const;
const SUBJECT_TYPES = ["employee", "contact", "lead"] as const;
const CONSENT_PURPOSES = ["marketing", "analytics", "processing"] as const;
const REQUEST_STATUSES = ["pending", "processing", "completed", "rejected"] as const;

export default function DataProtection() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [reqType, setReqType] = useState<string>("access");
  const [reqSubjectType, setReqSubjectType] = useState<string>("contact");
  const [reqSubjectId, setReqSubjectId] = useState("");
  const [reqNotes, setReqNotes] = useState("");

  // Fetch data subject requests
  const { data: requests = [] } = useQuery({
    queryKey: ["data-subject-requests", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("data_subject_requests")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Fetch consent records
  const { data: consents = [] } = useQuery({
    queryKey: ["consent-records", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("consent_records")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("consented_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Create request mutation
  const createRequest = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("data_subject_requests").insert({
        tenant_id: tenantId,
        request_type: reqType,
        subject_type: reqSubjectType,
        subject_id: reqSubjectId,
        notes: reqNotes || null,
        requested_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["data-subject-requests"] });
      toast({ title: t("requestCreated") });
      setNewRequestOpen(false);
      setReqSubjectId("");
      setReqNotes("");
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  // Complete request mutation
  const completeRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("data_subject_requests")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["data-subject-requests"] });
      toast({ title: t("requestCompleted") });
    },
  });

  // Export subject data
  const exportSubjectData = async (subjectType: string, subjectId: string) => {
    if (!tenantId) return;
    let data: any = null;
    if (subjectType === "contact") {
      const { data: d } = await supabase.from("contacts").select("*").eq("id", subjectId).eq("tenant_id", tenantId).single();
      data = d;
    } else if (subjectType === "employee") {
      const { data: d } = await supabase.from("employees").select("*").eq("id", subjectId).eq("tenant_id", tenantId).single();
      data = d;
    } else if (subjectType === "lead") {
      const { data: d } = await supabase.from("leads").select("*").eq("id", subjectId).eq("tenant_id", tenantId).single();
      data = d;
    }
    if (!data) {
      toast({ title: t("error"), description: "Subject not found", variant: "destructive" });
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${subjectType}_${subjectId}_export.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: t("dataExported") });
  };

  // Anonymize subject
  const anonymizeSubject = useMutation({
    mutationFn: async ({ subjectType, subjectId }: { subjectType: string; subjectId: string }) => {
      if (!tenantId) throw new Error("No tenant");
      const anon = (s: string) => s ? `ANON-${s.slice(0, 4).toUpperCase()}***` : "ANON";
      const now = new Date().toISOString();

      if (subjectType === "contact") {
        const { error } = await supabase.from("contacts").update({
          first_name: "Anonymized",
          last_name: "Subject",
          email: `anon-${subjectId.slice(0, 8)}@anonymized.local`,
          phone: null,
          anonymized_at: now,
        } as any).eq("id", subjectId).eq("tenant_id", tenantId);
        if (error) throw error;
      } else if (subjectType === "employee") {
        const { error } = await supabase.from("employees").update({
          first_name: "Anonymized",
          last_name: "Employee",
          email: `anon-${subjectId.slice(0, 8)}@anonymized.local`,
          phone: null,
          jmbg: null,
          anonymized_at: now,
        } as any).eq("id", subjectId).eq("tenant_id", tenantId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: t("dataAnonymized") });
      qc.invalidateQueries({ queryKey: ["data-subject-requests"] });
    },
    onError: (e: Error) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const statusBadge = (status: string) => {
    const variant = status === "completed" ? "default" : status === "pending" ? "secondary" : status === "rejected" ? "destructive" : "outline";
    return <Badge variant={variant}>{t(status as any)}</Badge>;
  };

  const requestTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      access: t("accessRequest"),
      erasure: t("erasureRequest"),
      portability: t("portabilityRequest"),
      rectification: t("rectificationRequest"),
    };
    return map[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{t("dataProtection")}</h1>
          <p className="text-muted-foreground text-sm">ZZPL - Zakon o zaštiti podataka o ličnosti (SG 87/2018)</p>
        </div>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">{t("dataSubjectRequests")}</TabsTrigger>
          <TabsTrigger value="consents">{t("consentRecords")}</TabsTrigger>
        </TabsList>

        {/* Data Subject Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={newRequestOpen} onOpenChange={setNewRequestOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />{t("newRequest")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("newRequest")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>{t("requestType")}</Label>
                    <Select value={reqType} onValueChange={setReqType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REQUEST_TYPES.map(rt => (
                          <SelectItem key={rt} value={rt}>{requestTypeLabel(rt)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("subjectType")}</Label>
                    <Select value={reqSubjectType} onValueChange={setReqSubjectType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUBJECT_TYPES.map(st => (
                          <SelectItem key={st} value={st}>{t(st as any)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("subjectId")}</Label>
                    <Input value={reqSubjectId} onChange={e => setReqSubjectId(e.target.value)} placeholder="UUID" />
                  </div>
                  <div>
                    <Label>{t("notes")}</Label>
                    <Textarea value={reqNotes} onChange={e => setReqNotes(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => createRequest.mutate()} disabled={!reqSubjectId || createRequest.isPending}>
                    {t("save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("requestType")}</TableHead>
                    <TableHead>{t("subjectType")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("requestedAt")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req: any) => (
                    <TableRow key={req.id}>
                      <TableCell>{requestTypeLabel(req.request_type)}</TableCell>
                      <TableCell><Badge variant="outline">{req.subject_type}</Badge></TableCell>
                      <TableCell>{statusBadge(req.status)}</TableCell>
                      <TableCell>{format(new Date(req.requested_at), "dd.MM.yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {req.status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => completeRequest.mutate(req.id)}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />{t("confirm")}
                            </Button>
                          )}
                          {(req.request_type === "access" || req.request_type === "portability") && (
                            <Button size="sm" variant="outline" onClick={() => exportSubjectData(req.subject_type, req.subject_id)}>
                              <Download className="h-3 w-3 mr-1" />{t("exportData")}
                            </Button>
                          )}
                          {req.request_type === "erasure" && req.status !== "completed" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <UserX className="h-3 w-3 mr-1" />{t("anonymize")}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t("anonymize")}</AlertDialogTitle>
                                  <AlertDialogDescription>{t("anonymizeConfirm")}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => {
                                    anonymizeSubject.mutate({ subjectType: req.subject_type, subjectId: req.subject_id });
                                    completeRequest.mutate(req.id);
                                  }}>{t("confirm")}</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {requests.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consent Records Tab */}
        <TabsContent value="consents" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("subjectType")}</TableHead>
                    <TableHead>{t("subjectId")}</TableHead>
                    <TableHead>{t("consentPurpose")}</TableHead>
                    <TableHead>{t("consentedAt")}</TableHead>
                    <TableHead>{t("withdrawnAt")}</TableHead>
                    <TableHead>{t("legalBasis")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consents.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell><Badge variant="outline">{c.subject_type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{c.subject_id?.slice(0, 8)}...</TableCell>
                      <TableCell>{t(c.purpose as any)}</TableCell>
                      <TableCell>{format(new Date(c.consented_at), "dd.MM.yyyy")}</TableCell>
                      <TableCell>{c.withdrawn_at ? format(new Date(c.withdrawn_at), "dd.MM.yyyy") : "—"}</TableCell>
                      <TableCell>{c.legal_basis || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {consents.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
