import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export default function PosSessions() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closeDialog, setCloseDialog] = useState<string | null>(null);
  const [closingBalance, setClosingBalance] = useState(0);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["pos_sessions", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from("pos_sessions").select("*").eq("tenant_id", tenantId).order("opened_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const openSession = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      await supabase.from("pos_sessions").insert({ tenant_id: tenantId, opened_by: user?.id, opening_balance: openingBalance });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos_sessions"] });
      setOpenDialog(false);
      toast({ title: t("success") });
    },
  });

  const closeSession = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("pos_sessions").update({ status: "closed", closed_at: new Date().toISOString(), closing_balance: closingBalance }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["pos_sessions_active"] });
      setCloseDialog(null);
      toast({ title: t("success") });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("posSessions")}</h1>
        <Button onClick={() => { setOpeningBalance(0); setOpenDialog(true); }}><Plus className="h-4 w-4 mr-2" />{t("openSession")}</Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("openingBalance")}</TableHead>
            <TableHead>{t("closingBalance")}</TableHead>
            <TableHead>{t("openedAt")}</TableHead>
            <TableHead>{t("closedAt")}</TableHead>
            <TableHead>{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6}>{t("loading")}</TableCell></TableRow>
          ) : sessions.map((s: any) => (
            <TableRow key={s.id}>
              <TableCell><Badge variant={s.status === "open" ? "default" : "secondary"}>{s.status === "open" ? t("open") : t("closed")}</Badge></TableCell>
              <TableCell>{Number(s.opening_balance).toFixed(2)}</TableCell>
              <TableCell>{s.closing_balance != null ? Number(s.closing_balance).toFixed(2) : "-"}</TableCell>
              <TableCell>{new Date(s.opened_at).toLocaleString()}</TableCell>
              <TableCell>{s.closed_at ? new Date(s.closed_at).toLocaleString() : "-"}</TableCell>
              <TableCell>
                {s.status === "open" && (
                  <Button size="sm" variant="outline" onClick={() => { setClosingBalance(0); setCloseDialog(s.id); }}>{t("closeSession")}</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("openSession")}</DialogTitle></DialogHeader>
          <div><Label>{t("openingBalance")}</Label><Input type="number" value={openingBalance} onChange={e => setOpeningBalance(Number(e.target.value))} /></div>
          <DialogFooter><Button onClick={() => openSession.mutate()}>{t("open")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closeDialog} onOpenChange={() => setCloseDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("closeSession")}</DialogTitle></DialogHeader>
          <div><Label>{t("closingBalance")}</Label><Input type="number" value={closingBalance} onChange={e => setClosingBalance(Number(e.target.value))} /></div>
          <DialogFooter><Button onClick={() => closeDialog && closeSession.mutate(closeDialog)}>{t("close")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
