import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  assetId: string;
  assetCode: string;
  assetName: string;
}

export function AssetDmsTab({ assetId, assetCode, assetName }: Props) {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["asset-dms-docs", assetId],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, protocol_number, name, subject, file_path, status, created_at")
        .eq("tenant_id", tenantId!)
        .eq("entity_type", "asset")
        .eq("entity_id", assetId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId && !!assetId,
  });

  const createDmsEntry = useMutation({
    mutationFn: async () => {
      const year = new Date().getFullYear();
      const { count } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .gte("created_at", `${year}-01-01`);
      const nextNum = (count || 0) + 1;
      const protocolNumber = `${String(nextNum).padStart(3, "0")}-${year.toString().slice(-2)}/${year}`;
      const docName = `${t("assetsCrossDmsSubject" as any)} ${assetCode}`;

      const { error } = await supabase.from("documents").insert({
        tenant_id: tenantId!,
        protocol_number: protocolNumber,
        name: docName,
        subject: `${docName} - ${assetName}`,
        file_path: `assets/${assetCode}/`,
        status: "active",
        entity_type: "asset",
        entity_id: assetId,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-dms-docs"] });
      toast.success(t("saved" as any));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" /> {t("assetsCrossDmsTitle" as any)}
        </h3>
        <Button size="sm" onClick={() => createDmsEntry.mutate()} disabled={createDmsEntry.isPending}>
          <Plus className="h-4 w-4 mr-1" /> {t("assetsCrossDmsCreate" as any)}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : documents.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">{t("assetsCrossDmsEmpty" as any)}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("protocolNumber" as any)}</TableHead>
              <TableHead>{t("name" as any)}</TableHead>
              <TableHead>{t("subject" as any)}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("date" as any)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc: any) => (
              <TableRow key={doc.id}>
                <TableCell className="font-mono text-sm">{doc.protocol_number}</TableCell>
                <TableCell className="font-medium">{doc.name}</TableCell>
                <TableCell>{doc.subject || "—"}</TableCell>
                <TableCell><Badge variant="secondary">{doc.status}</Badge></TableCell>
                <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
