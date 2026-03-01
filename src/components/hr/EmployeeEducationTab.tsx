import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GraduationCap, Award, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";

interface Props {
  employeeId: string;
}

export function EmployeeEducationTab({ employeeId }: Props) {
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  // Education
  const { data: education = [] } = useQuery({
    queryKey: ["employee-education", employeeId],
    queryFn: async () => {
      const { data } = await (supabase.from("employee_education" as any) as any)
        .select("*").eq("tenant_id", tenantId!).eq("employee_id", employeeId).order("graduation_year", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Certifications
  const { data: certifications = [] } = useQuery({
    queryKey: ["employee-certifications", employeeId],
    queryFn: async () => {
      const { data } = await (supabase.from("employee_certifications" as any) as any)
        .select("*").eq("tenant_id", tenantId!).eq("employee_id", employeeId).order("expiry_date");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Trainings
  const { data: trainings = [] } = useQuery({
    queryKey: ["employee-trainings", employeeId],
    queryFn: async () => {
      const { data } = await (supabase.from("employee_trainings" as any) as any)
        .select("*").eq("tenant_id", tenantId!).eq("employee_id", employeeId).order("training_date", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Add education dialog
  const [eduOpen, setEduOpen] = useState(false);
  const [eduForm, setEduForm] = useState({ degree: "", institution: "", field_of_study: "", graduation_year: "" });
  const addEdu = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("employee_education" as any) as any).insert({
        tenant_id: tenantId, employee_id: employeeId, ...eduForm, graduation_year: eduForm.graduation_year ? +eduForm.graduation_year : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-education", employeeId] }); setEduOpen(false); toast.success("Dodato"); },
    onError: (e: any) => toast.error(e.message),
  });

  // Add cert dialog
  const [certOpen, setCertOpen] = useState(false);
  const [certForm, setCertForm] = useState({ name: "", issuer: "", issue_date: "", expiry_date: "", credential_id: "" });
  const addCert = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("employee_certifications" as any) as any).insert({
        tenant_id: tenantId, employee_id: employeeId, ...certForm,
        issue_date: certForm.issue_date || null, expiry_date: certForm.expiry_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-certifications", employeeId] }); setCertOpen(false); toast.success("Dodato"); },
    onError: (e: any) => toast.error(e.message),
  });

  // Add training dialog
  const [trainOpen, setTrainOpen] = useState(false);
  const [trainForm, setTrainForm] = useState({ title: "", provider: "", training_date: "", hours: "", cost: "" });
  const addTrain = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("employee_trainings" as any) as any).insert({
        tenant_id: tenantId, employee_id: employeeId, ...trainForm,
        training_date: trainForm.training_date || null, hours: trainForm.hours ? +trainForm.hours : null, cost: trainForm.cost ? +trainForm.cost : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-trainings", employeeId] }); setTrainOpen(false); toast.success("Dodato"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      const { error } = await (supabase.from(table as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employee-education", employeeId] }); qc.invalidateQueries({ queryKey: ["employee-certifications", employeeId] }); qc.invalidateQueries({ queryKey: ["employee-trainings", employeeId] }); toast.success("Obrisano"); },
    onError: (e: any) => toast.error(e.message),
  });

  const certExpiryBadge = (expiry: string | null) => {
    if (!expiry) return null;
    const days = differenceInDays(new Date(expiry), new Date());
    if (days < 0) return <Badge variant="destructive">Istekao</Badge>;
    if (days < 30) return <Badge variant="destructive">Ističe za {days}d</Badge>;
    if (days < 90) return <Badge className="bg-accent text-accent-foreground">Ističe za {days}d</Badge>;
    return <Badge variant="outline">Važi</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Education */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4" />Obrazovanje</CardTitle>
          <Button size="sm" onClick={() => { setEduForm({ degree: "", institution: "", field_of_study: "", graduation_year: "" }); setEduOpen(true); }}><Plus className="h-4 w-4 mr-1" />Dodaj</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Diploma</TableHead><TableHead>Institucija</TableHead><TableHead>Oblast</TableHead><TableHead>Godina</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {education.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nema zapisa</TableCell></TableRow>
              : education.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.degree}</TableCell>
                  <TableCell>{e.institution}</TableCell>
                  <TableCell>{e.field_of_study || "—"}</TableCell>
                  <TableCell>{e.graduation_year || "—"}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => deleteMut.mutate({ table: "employee_education", id: e.id })}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Certifications */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" />Sertifikati</CardTitle>
          <Button size="sm" onClick={() => { setCertForm({ name: "", issuer: "", issue_date: "", expiry_date: "", credential_id: "" }); setCertOpen(true); }}><Plus className="h-4 w-4 mr-1" />Dodaj</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Naziv</TableHead><TableHead>Izdavač</TableHead><TableHead>Datum izdavanja</TableHead><TableHead>Važi do</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {certifications.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Nema sertifikata</TableCell></TableRow>
              : certifications.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.issuer || "—"}</TableCell>
                  <TableCell>{c.issue_date || "—"}</TableCell>
                  <TableCell>{c.expiry_date || "—"}</TableCell>
                  <TableCell>{certExpiryBadge(c.expiry_date)}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => deleteMut.mutate({ table: "employee_certifications", id: c.id })}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Trainings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" />Obuke</CardTitle>
          <Button size="sm" onClick={() => { setTrainForm({ title: "", provider: "", training_date: "", hours: "", cost: "" }); setTrainOpen(true); }}><Plus className="h-4 w-4 mr-1" />Dodaj</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Naziv</TableHead><TableHead>Provajder</TableHead><TableHead>Datum</TableHead><TableHead>Sati</TableHead><TableHead>Cena</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {trainings.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Nema obuka</TableCell></TableRow>
              : trainings.map((tr: any) => (
                <TableRow key={tr.id}>
                  <TableCell className="font-medium">{tr.title}</TableCell>
                  <TableCell>{tr.provider || "—"}</TableCell>
                  <TableCell>{tr.training_date || "—"}</TableCell>
                  <TableCell>{tr.hours || "—"}</TableCell>
                  <TableCell>{tr.cost ? `${Number(tr.cost).toLocaleString()} ${tr.currency}` : "—"}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => deleteMut.mutate({ table: "employee_trainings", id: tr.id })}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Education Dialog */}
      <Dialog open={eduOpen} onOpenChange={setEduOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dodaj obrazovanje</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1"><Label>Diploma *</Label><Input value={eduForm.degree} onChange={e => setEduForm({ ...eduForm, degree: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Institucija *</Label><Input value={eduForm.institution} onChange={e => setEduForm({ ...eduForm, institution: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Oblast</Label><Input value={eduForm.field_of_study} onChange={e => setEduForm({ ...eduForm, field_of_study: e.target.value })} /></div>
              <div className="grid gap-1"><Label>Godina</Label><Input type="number" value={eduForm.graduation_year} onChange={e => setEduForm({ ...eduForm, graduation_year: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEduOpen(false)}>Otkaži</Button>
            <Button onClick={() => addEdu.mutate()} disabled={!eduForm.degree || !eduForm.institution}>Sačuvaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certification Dialog */}
      <Dialog open={certOpen} onOpenChange={setCertOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dodaj sertifikat</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1"><Label>Naziv *</Label><Input value={certForm.name} onChange={e => setCertForm({ ...certForm, name: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Izdavač</Label><Input value={certForm.issuer} onChange={e => setCertForm({ ...certForm, issuer: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Datum izdavanja</Label><Input type="date" value={certForm.issue_date} onChange={e => setCertForm({ ...certForm, issue_date: e.target.value })} /></div>
              <div className="grid gap-1"><Label>Važi do</Label><Input type="date" value={certForm.expiry_date} onChange={e => setCertForm({ ...certForm, expiry_date: e.target.value })} /></div>
            </div>
            <div className="grid gap-1"><Label>ID sertifikata</Label><Input value={certForm.credential_id} onChange={e => setCertForm({ ...certForm, credential_id: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCertOpen(false)}>Otkaži</Button>
            <Button onClick={() => addCert.mutate()} disabled={!certForm.name}>Sačuvaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Training Dialog */}
      <Dialog open={trainOpen} onOpenChange={setTrainOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dodaj obuku</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1"><Label>Naziv *</Label><Input value={trainForm.title} onChange={e => setTrainForm({ ...trainForm, title: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Provajder</Label><Input value={trainForm.provider} onChange={e => setTrainForm({ ...trainForm, provider: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1"><Label>Datum</Label><Input type="date" value={trainForm.training_date} onChange={e => setTrainForm({ ...trainForm, training_date: e.target.value })} /></div>
              <div className="grid gap-1"><Label>Sati</Label><Input type="number" value={trainForm.hours} onChange={e => setTrainForm({ ...trainForm, hours: e.target.value })} /></div>
              <div className="grid gap-1"><Label>Cena (RSD)</Label><Input type="number" value={trainForm.cost} onChange={e => setTrainForm({ ...trainForm, cost: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrainOpen(false)}>Otkaži</Button>
            <Button onClick={() => addTrain.mutate()} disabled={!trainForm.title}>Sačuvaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
