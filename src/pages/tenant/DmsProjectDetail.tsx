import { useParams, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";

export default function DmsProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { tenantId } = useTenant();

  const { data: project } = useQuery({
    queryKey: ["dms_project", id],
    queryFn: async () => {
      const { data } = await supabase.from("dms_projects").select("*").eq("id", id).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["dms_project_members", id],
    queryFn: async () => {
      const { data } = await supabase.from("dms_project_members").select("*").eq("project_id", id);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: linkedDocs = [] } = useQuery({
    queryKey: ["document_projects", id],
    queryFn: async () => {
      const { data } = await supabase.from("document_projects")
        .select("*, documents(id, protocol_number, subject, name, status)")
        .eq("project_id", id);
      return data || [];
    },
    enabled: !!id,
  });

  if (!project) return <div className="p-6">{t("loading")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/documents/projects")}>
          <ArrowLeft className="h-4 w-4 mr-1" />{t("back")}
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">{project.code ? `[${project.code}] ` : ""}{project.description || ""}</p>
        </div>
        <Badge variant={project.status === "active" ? "default" : "secondary"} className="ml-auto">{project.status}</Badge>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">{t("dmsMembers")} ({members.length})</TabsTrigger>
          <TabsTrigger value="documents">{t("documents")} ({linkedDocs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dmsRole")}</TableHead>
                    <TableHead>{t("createdAt")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell><Badge variant="outline">{m.role}</Badge></TableCell>
                      <TableCell>{new Date(m.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {members.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("dmsProtocolNumber")}</TableHead>
                    <TableHead>{t("dmsSubject")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedDocs.map((ld: any) => (
                    <TableRow key={ld.id} className="cursor-pointer" onClick={() => navigate(`/documents/${ld.documents?.id}`)}>
                      <TableCell className="font-mono">{ld.documents?.protocol_number || "-"}</TableCell>
                      <TableCell>{ld.documents?.subject || ld.documents?.name}</TableCell>
                      <TableCell><Badge variant="outline">{ld.documents?.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {linkedDocs.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{t("noResults")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
