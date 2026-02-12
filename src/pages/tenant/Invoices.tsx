import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Send } from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-muted text-muted-foreground line-through",
};

const sefColors: Record<string, string> = {
  not_submitted: "bg-muted text-muted-foreground",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function Invoices() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const sefMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      // Mock: set to submitted
      const { error } = await supabase
        .from("invoices")
        .update({ sef_status: "submitted" })
        .eq("id", invoiceId);
      if (error) throw error;
      // Simulate acceptance after 2s
      setTimeout(async () => {
        await supabase
          .from("invoices")
          .update({ sef_status: "accepted" })
          .eq("id", invoiceId);
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
      }, 2000);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: t("success"), description: t("sefSubmitted") });
    },
  });

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      !search ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.partner_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("invoices")}</h1>
        <Button onClick={() => navigate("/accounting/invoices/new")}>
          <Plus className="h-4 w-4 mr-2" />
          {t("newInvoice")}
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            <SelectItem value="draft">{t("draft")}</SelectItem>
            <SelectItem value="sent">{t("sent")}</SelectItem>
            <SelectItem value="paid">{t("paid")}</SelectItem>
            <SelectItem value="overdue">{t("overdue")}</SelectItem>
            <SelectItem value="cancelled">{t("cancelled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p>{t("loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">{t("noResults")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("invoiceNumber")}</TableHead>
              <TableHead>{t("invoiceDate")}</TableHead>
              <TableHead>{t("partner")}</TableHead>
              <TableHead className="text-right">{t("total")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>SEF</TableHead>
              <TableHead>{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inv) => (
              <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate(`/accounting/invoices/${inv.id}`)}>
                <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                <TableCell>{format(new Date(inv.invoice_date), "dd.MM.yyyy")}</TableCell>
                <TableCell>{inv.partner_name}</TableCell>
                <TableCell className="text-right font-mono">
                  {Number(inv.total).toLocaleString("sr-RS", { minimumFractionDigits: 2 })} {inv.currency}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[inv.status] || ""}>{t(inv.status as any)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={sefColors[inv.sef_status] || ""}>{inv.sef_status.replace("_", " ")}</Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {inv.status === "sent" && inv.sef_status === "not_submitted" && (
                    <Button size="sm" variant="outline" onClick={() => sefMutation.mutate(inv.id)}>
                      <Send className="h-3 w-3 mr-1" />
                      SEF
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
