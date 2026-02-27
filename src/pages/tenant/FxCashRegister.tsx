import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { useCurrencies } from "@/hooks/useCurrencies";
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
import { Plus, ArrowDownLeft, ArrowUpRight, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { postWithRuleOrFallback } from "@/lib/postingHelper";
import { fmtNum } from "@/lib/utils";

export default function FxCashRegister() {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: currencies = [] } = useCurrencies();
  const [open, setOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [form, setForm] = useState({
    direction: "in" as "in" | "out",
    currency: "EUR",
    amount: "",
    exchange_rate: "",
    description: "",
    document_ref: "",
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["fx-cash-register", tenantId, filterMonth, filterCurrency],
    queryFn: async () => {
      if (!tenantId) return [];
      const start = `${filterMonth}-01`;
      const endDate = new Date(Number(filterMonth.split("-")[0]), Number(filterMonth.split("-")[1]), 0);
      const end = format(endDate, "yyyy-MM-dd");
      let q = supabase
        .from("fx_cash_register")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("entry_date", start)
        .lte("entry_date", end)
        .order("entry_date")
        .order("entry_number");
      if (filterCurrency !== "all") q = q.eq("currency", filterCurrency);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const totals = useMemo(() => {
    const byCurrency: Record<string, { inFx: number; outFx: number; inRsd: number; outRsd: number }> = {};
    for (const e of entries) {
      const c = e.currency;
      if (!byCurrency[c]) byCurrency[c] = { inFx: 0, outFx: 0, inRsd: 0, outRsd: 0 };
      if (e.direction === "in") {
        byCurrency[c].inFx += Number(e.amount);
        byCurrency[c].inRsd += Number(e.amount_rsd);
      } else {
        byCurrency[c].outFx += Number(e.amount);
        byCurrency[c].outRsd += Number(e.amount_rsd);
      }
    }
    return byCurrency;
  }, [entries]);

  const createMut = useMutation({
    mutationFn: async () => {
      const entryNumber = `FX-${Date.now().toString(36).toUpperCase()}`;
      const amount = Number(form.amount);
      const rate = Number(form.exchange_rate);
      const amountRsd = Math.round(amount * rate * 100) / 100;
      const entryDate = format(new Date(), "yyyy-MM-dd");
      const isIn = form.direction === "in";
      const modelCode = isIn ? "FX_CASH_IN" : "FX_CASH_OUT";

      // Serbian CoA: 2440 = Devizna blagajna
      const fallbackLines = isIn
        ? [
            { accountCode: "2440", debit: amountRsd, credit: 0, description: `${form.currency} ${form.description}`, sortOrder: 1 },
            { accountCode: "6990", debit: 0, credit: amountRsd, description: form.description, sortOrder: 2 },
          ]
        : [
            { accountCode: "5790", debit: amountRsd, credit: 0, description: form.description, sortOrder: 1 },
            { accountCode: "2440", debit: 0, credit: amountRsd, description: `${form.currency} ${form.description}`, sortOrder: 2 },
          ];

      const journalEntryId = await postWithRuleOrFallback({
        tenantId: tenantId!,
        userId: user?.id || null,
        modelCode,
        amount: amountRsd,
        entryDate,
        description: `Devizna blagajna: ${form.currency} ${form.description}`,
        reference: entryNumber,
        context: {},
        currency: form.currency,
        fallbackLines,
      });

      const { error } = await supabase.from("fx_cash_register").insert({
        tenant_id: tenantId!,
        entry_number: entryNumber,
        entry_date: entryDate,
        direction: form.direction,
        currency: form.currency,
        amount,
        exchange_rate: rate,
        amount_rsd: amountRsd,
        description: form.description,
        document_ref: form.document_ref || null,
        created_by: user?.id || null,
        journal_entry_id: journalEntryId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t("success") });
      qc.invalidateQueries({ queryKey: ["fx-cash-register"] });
      setOpen(false);
      setForm({ direction: "in", currency: "EUR", amount: "", exchange_rate: "", description: "", document_ref: "" });
    },
    onError: (e: any) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
  });

  const availableCurrencies = currencies.filter(c => c.code !== "RSD");

  return (
    <div className="space-y-6">
      <PageHeader
        title={locale === "sr" ? "Devizna blagajna" : "Foreign Currency Cash Register"}
        icon={Globe}
        description={locale === "sr" ? "Gotovinski promet u stranim valutama sa konverzijom po NBS kursu" : "Multi-currency cash transactions with NBS exchange rates"}
      />

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex gap-4">
          <div>
            <Label>{t("month")}</Label>
            <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-48" />
          </div>
          <div>
            <Label>{locale === "sr" ? "Valuta" : "Currency"}</Label>
            <Select value={filterCurrency} onValueChange={setFilterCurrency}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{locale === "sr" ? "Sve" : "All"}</SelectItem>
                {availableCurrencies.map(c => (
                  <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                ))}
                {availableCurrencies.length === 0 && (
                  <>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> {t("newEntry")}
        </Button>
      </div>

      {/* Summary cards per currency */}
      {Object.entries(totals).map(([cur, t]) => (
        <div key={cur} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{cur} {locale === "sr" ? "Primanja" : "Receipts"}</p>
              <p className="text-lg font-bold text-green-600">{fmtNum(t.inFx)} {cur}</p>
              <p className="text-xs text-muted-foreground">{fmtNum(t.inRsd)} RSD</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{cur} {locale === "sr" ? "Izdavanja" : "Disbursements"}</p>
              <p className="text-lg font-bold text-red-600">{fmtNum(t.outFx)} {cur}</p>
              <p className="text-xs text-muted-foreground">{fmtNum(t.outRsd)} RSD</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{cur} {locale === "sr" ? "Saldo" : "Balance"}</p>
              <p className="text-lg font-bold">{fmtNum(t.inFx - t.outFx)} {cur}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">RSD {locale === "sr" ? "Protivvrednost" : "Equivalent"}</p>
              <p className="text-lg font-bold">{fmtNum(t.inRsd - t.outRsd)} RSD</p>
            </CardContent>
          </Card>
        </div>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" /> {locale === "sr" ? "Devizni dnevnik" : "FX Cash Journal"}
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
                    <TableHead>{locale === "sr" ? "Valuta" : "Currency"}</TableHead>
                    <TableHead className="text-right">{locale === "sr" ? "Iznos" : "Amount"}</TableHead>
                    <TableHead className="text-right">{locale === "sr" ? "Kurs" : "Rate"}</TableHead>
                    <TableHead className="text-right">RSD</TableHead>
                    <TableHead>{t("description")}</TableHead>
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
                      <TableCell><Badge variant="outline">{e.currency}</Badge></TableCell>
                      <TableCell className={`text-right tabular-nums ${e.direction === "in" ? "text-green-600" : "text-red-600"}`}>
                        {fmtNum(e.amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{Number(e.exchange_rate).toFixed(4)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(e.amount_rsd)}</TableCell>
                      <TableCell>{e.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{locale === "sr" ? "Nova devizna stavka" : "New FX Entry"}</DialogTitle>
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
              <Label>{locale === "sr" ? "Valuta" : "Currency"}</Label>
              <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableCurrencies.length > 0 ? (
                    availableCurrencies.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="CHF">CHF</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{locale === "sr" ? "Iznos u valuti" : "Amount (FX)"}</Label>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>{locale === "sr" ? "Kurs (NBS)" : "Exchange Rate"}</Label>
                <Input type="number" min="0" step="0.0001" value={form.exchange_rate} onChange={e => setForm({ ...form, exchange_rate: e.target.value })} />
              </div>
            </div>
            {Number(form.amount) > 0 && Number(form.exchange_rate) > 0 && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <span className="text-muted-foreground">RSD: </span>
                <span className="font-semibold">{fmtNum(Number(form.amount) * Number(form.exchange_rate))}</span>
              </div>
            )}
            <div>
              <Label>{t("description")}</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={locale === "sr" ? "npr. Otkup deviza od klijenta" : "e.g. FX purchase from client"} />
            </div>
            <div>
              <Label>{t("documentRefOptional")}</Label>
              <Input value={form.document_ref} onChange={e => setForm({ ...form, document_ref: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!form.description || !form.amount || !form.exchange_rate || createMut.isPending}
            >
              {createMut.isPending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
