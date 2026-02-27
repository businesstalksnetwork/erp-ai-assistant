import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import PostingPreviewPanel, { buildCashPreviewLines } from "@/components/accounting/PostingPreviewPanel";

export default function CashRegister() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));
  const [form, setForm] = useState({
    direction: "in" as "in" | "out",
    amount: "",
    description: "",
    document_ref: "",
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["cash-register", tenantId, filterMonth],
    queryFn: async () => {
      if (!tenantId) return [];
      const start = `${filterMonth}-01`;
      const endDate = new Date(Number(filterMonth.split("-")[0]), Number(filterMonth.split("-")[1]), 0);
      const end = format(endDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("cash_register")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("entry_date", start)
        .lte("entry_date", end)
        .order("entry_date")
        .order("entry_number");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { totalIn, totalOut } = useMemo(() => {
    let totalIn = 0, totalOut = 0;
    for (const e of entries) {
      if (e.direction === "in") totalIn += Number(e.amount);
      else totalOut += Number(e.amount);
    }
    return { totalIn, totalOut };
  }, [entries]);

  const createMut = useMutation({
    mutationFn: async () => {
      const entryNumber = `BL-${Date.now().toString(36).toUpperCase()}`;
      const amount = Number(form.amount);
      const entryDate = format(new Date(), "yyyy-MM-dd");
      const isIn = form.direction === "in";
      const modelCode = isIn ? "CASH_IN" : "CASH_OUT";

      // Cash account 1000, counterpart depends on direction
      // CASH_IN: DR 1000 (cash) / CR counterpart
      // CASH_OUT: DR counterpart / CR 1000 (cash)
      const fallbackLines = isIn
        ? [
            { accountCode: "1000", debit: amount, credit: 0, description: form.description, sortOrder: 1 },
            { accountCode: "6990", debit: 0, credit: amount, description: form.description, sortOrder: 2 },
          ]
        : [
            { accountCode: "5790", debit: amount, credit: 0, description: form.description, sortOrder: 1 },
            { accountCode: "1000", debit: 0, credit: amount, description: form.description, sortOrder: 2 },
          ];

      // Create GL journal entry via posting rules engine (or fallback)
      const journalEntryId = await postWithRuleOrFallback({
        tenantId: tenantId!,
        userId: user?.id || null,
        modelCode,
        amount,
        entryDate,
        description: `${t("cashRegister")}: ${form.description}`,
        reference: entryNumber,
        context: {},
        fallbackLines,
      });

      // Insert the cash register record with journal reference
      const { error } = await supabase.from("cash_register").insert({
        tenant_id: tenantId!,
        entry_number: entryNumber,
        entry_date: entryDate,
        direction: form.direction,
        amount,
        description: form.description,
        document_ref: form.document_ref || null,
        created_by: user?.id || null,
        journal_entry_id: journalEntryId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("success") });
      qc.invalidateQueries({ queryKey: ["cash-register"] });
      setOpen(false);
      setForm({ direction: "in", amount: "", description: "", document_ref: "" });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("cashRegister")}
        description={t("cashRegisterDesc")}
      />

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <Label>{t("month")}</Label>
          <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-48" />
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> {t("newEntry")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("receipts")}</p>
            <p className="text-lg font-bold text-green-600">{totalIn.toLocaleString("sr-RS")} RSD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("disbursements")}</p>
            <p className="text-lg font-bold text-red-600">{totalOut.toLocaleString("sr-RS")} RSD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("balance")}</p>
            <p className="text-lg font-bold">{(totalIn - totalOut).toLocaleString("sr-RS")} RSD</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" /> {t("cashRegisterJournal")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-60" />
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noResults")}</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("entryNumber")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("direction")}</TableHead>
                  <TableHead>{t("description")}</TableHead>
                  <TableHead>{t("documentRef")}</TableHead>
                  <TableHead className="text-right">{t("receipt")}</TableHead>
                  <TableHead className="text-right">{t("disbursement")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.entry_number}</TableCell>
                    <TableCell>{e.entry_date}</TableCell>
                    <TableCell>
                      {e.direction === "in" ? (
                        <Badge variant="default" className="gap-1"><ArrowDownLeft className="h-3 w-3" /> {t("receipt")}</Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1"><ArrowUpRight className="h-3 w-3" /> {t("disbursement")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.document_ref || "—"}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {e.direction === "in" ? Number(e.amount).toLocaleString("sr-RS") : ""}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {e.direction === "out" ? Number(e.amount).toLocaleString("sr-RS") : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="font-semibold">{t("total")}</TableCell>
                  <TableCell className="text-right font-semibold text-green-600">{totalIn.toLocaleString("sr-RS")}</TableCell>
                  <TableCell className="text-right font-semibold text-red-600">{totalOut.toLocaleString("sr-RS")}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newCashEntry")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("direction")}</Label>
              <Select value={form.direction} onValueChange={(v: "in" | "out") => setForm({ ...form, direction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">{t("receipt")}</SelectItem>
                  <SelectItem value="out">{t("disbursement")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("amountRSD")}</Label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>{t("description")}</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="npr. Nabavka kancelarijskog materijala" />
            </div>
            <div>
              <Label>{t("documentRefOptional")}</Label>
              <Input value={form.document_ref} onChange={(e) => setForm({ ...form, document_ref: e.target.value })} placeholder="npr. RN-001/26" />
            </div>
            {Number(form.amount) > 0 && (
              <PostingPreviewPanel lines={buildCashPreviewLines(form.direction, Number(form.amount), form.description || "—")} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={() => createMut.mutate()} disabled={!form.description || !form.amount || createMut.isPending}>
              {createMut.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
