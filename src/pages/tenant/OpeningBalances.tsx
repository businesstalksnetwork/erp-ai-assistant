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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Upload, RefreshCw, FileSpreadsheet, Plus, Trash2 } from "lucide-react";

interface ManualEntry {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

export default function OpeningBalances() {
  const { t } = useLanguage();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Check if opening balances already exist for the selected year
  const { data: existingBalances = [], isLoading } = useQuery({
    queryKey: ["opening-balances", tenantId, selectedYear],
    queryFn: async () => {
      if (!tenantId) return [];
      const startDate = `${selectedYear}-01-01`;
      const { data, error } = await supabase
        .from("journal_entries")
        .select("id, entry_date, description, status, journal_lines(id, debit, credit, account:chart_of_accounts(code, name))")
        .eq("tenant_id", tenantId)
        .eq("description", `Početno stanje ${selectedYear}`)
        .order("entry_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Get chart of accounts for manual entry
  const { data: accounts = [] } = useQuery({
    queryKey: ["coa-for-opening", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, account_type")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Auto-generate from prior year
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user?.id) throw new Error("Missing context");
      const { data, error } = await supabase.rpc("generate_opening_balances" as any, {
        p_tenant_id: tenantId,
        p_fiscal_year: selectedYear,
        p_user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Početna stanja generisana", description: `Početna stanja za ${selectedYear}. godinu su uspešno kreirana iz prethodne godine.` });
      qc.invalidateQueries({ queryKey: ["opening-balances", tenantId, selectedYear] });
    },
    onError: (err: any) => {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    },
  });

  // Save manual entries as a journal entry
  const saveManualMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user?.id || manualEntries.length === 0) throw new Error("Nema stavki");
      const totalDebit = manualEntries.reduce((s, e) => s + e.debit, 0);
      const totalCredit = manualEntries.reduce((s, e) => s + e.credit, 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error("Duguje i potražuje moraju biti jednaki");
      }

      // Get next entry number
      const { count } = await supabase
        .from("journal_entries")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);
      const entryNumber = `PS-${selectedYear}-${String((count || 0) + 1).padStart(4, "0")}`;

      // Create journal entry
      const { data: je, error: jeErr } = await supabase
        .from("journal_entries")
        .insert({
          tenant_id: tenantId,
          entry_number: entryNumber,
          entry_date: `${selectedYear}-01-01`,
          description: `Početno stanje ${selectedYear}`,
          status: "draft",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (jeErr) throw jeErr;

      // Find account IDs
      const lines = [];
      for (const entry of manualEntries) {
        const acc = accounts.find(a => a.code === entry.account_code);
        if (!acc) throw new Error(`Konto ${entry.account_code} nije pronađen`);
        lines.push({
          journal_entry_id: je.id,
          account_id: acc.id,
          debit: entry.debit,
          credit: entry.credit,
          description: `Početno stanje - ${acc.code} ${acc.name}`,
          tenant_id: tenantId,
        });
      }

      const { error: lErr } = await supabase.from("journal_lines").insert(lines);
      if (lErr) throw lErr;
      return je;
    },
    onSuccess: () => {
      toast({ title: "Sačuvano", description: "Ručna početna stanja su sačuvana kao nalog za knjiženje (draft)." });
      setManualEntries([]);
      qc.invalidateQueries({ queryKey: ["opening-balances", tenantId, selectedYear] });
    },
    onError: (err: any) => {
      toast({ title: "Greška", description: err.message, variant: "destructive" });
    },
  });

  const addManualEntry = () => {
    setManualEntries(prev => [...prev, { account_code: "", account_name: "", debit: 0, credit: 0 }]);
  };

  const updateEntry = (idx: number, field: keyof ManualEntry, value: string | number) => {
    setManualEntries(prev => {
      const next = [...prev];
      (next[idx] as any)[field] = value;
      if (field === "account_code") {
        const acc = accounts.find(a => a.code === value);
        next[idx].account_name = acc?.name || "";
      }
      return next;
    });
  };

  const removeEntry = (idx: number) => {
    setManualEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const totalDebit = manualEntries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
  const totalCredit = manualEntries.reduce((s, e) => s + (Number(e.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Početna stanja</h1>
        <p className="text-muted-foreground">Generišite ili ručno unesite početna stanja za fiskalnu godinu</p>
      </div>

      <div className="flex items-end gap-4">
        <div className="space-y-2">
          <Label>Fiskalna godina</Label>
          <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Auto-generate section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Automatsko generisanje
          </CardTitle>
          <CardDescription>
            Generišite početna stanja iz zaključnog salda prethodne godine ({selectedYear - 1}).
            Konta klasa 0-4 se prenose kao početno stanje.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default" disabled={generateMutation.isPending}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generiši iz {selectedYear - 1}. godine
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Generisanje početnih stanja</AlertDialogTitle>
                <AlertDialogDescription>
                  Ovo će kreirati nalog za knjiženje sa početnim stanjima na osnovu zaključnih salda iz {selectedYear - 1}. godine.
                  {existingBalances.length > 0 && " Već postoje početna stanja za ovu godinu — novi nalog će biti dodat."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Otkaži</AlertDialogCancel>
                <AlertDialogAction onClick={() => generateMutation.mutate()}>
                  Generiši
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Existing opening balance entries */}
      {existingBalances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Postojeća početna stanja za {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {existingBalances.map((je: any) => (
              <div key={je.id} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={je.status === "posted" ? "default" : "secondary"}>
                    {je.status === "posted" ? "Proknjiženo" : "Draft"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{je.entry_date}</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Konto</TableHead>
                      <TableHead>Naziv</TableHead>
                      <TableHead className="text-right">Duguje</TableHead>
                      <TableHead className="text-right">Potražuje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(je.journal_lines || []).map((line: any) => (
                      <TableRow key={line.id}>
                        <TableCell className="font-mono">{line.account?.code}</TableCell>
                        <TableCell>{line.account?.name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(line.debit) > 0 ? Number(line.debit).toLocaleString("sr-Latn-RS", { minimumFractionDigits: 2 }) : ""}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(line.credit) > 0 ? Number(line.credit).toLocaleString("sr-Latn-RS", { minimumFractionDigits: 2 }) : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Manual entry section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Ručni unos početnih stanja
          </CardTitle>
          <CardDescription>
            Za prvu godinu poslovanja ili korekcije — ručno unesite početna stanja po kontima.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Konto</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead className="text-right">Duguje</TableHead>
                <TableHead className="text-right">Potražuje</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manualEntries.map((entry, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Select value={entry.account_code} onValueChange={v => updateEntry(idx, "account_code", v)}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Izaberi konto" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => (
                          <SelectItem key={a.id} value={a.code}>{a.code} - {a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{entry.account_name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="text-right w-32"
                      value={entry.debit || ""}
                      onChange={e => updateEntry(idx, "debit", Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="text-right w-32"
                      value={entry.credit || ""}
                      onChange={e => updateEntry(idx, "credit", Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeEntry(idx)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {manualEntries.length > 0 && (
                <TableRow className="font-semibold">
                  <TableCell colSpan={2}>Ukupno</TableCell>
                  <TableCell className="text-right font-mono">
                    {totalDebit.toLocaleString("sr-Latn-RS", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {totalCredit.toLocaleString("sr-Latn-RS", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    {!isBalanced && manualEntries.length > 0 && (
                      <Badge variant="destructive">≠</Badge>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex gap-2">
            <Button variant="outline" onClick={addManualEntry}>
              <Plus className="h-4 w-4 mr-2" />
              Dodaj stavku
            </Button>
            {manualEntries.length > 0 && (
              <Button
                onClick={() => saveManualMutation.mutate()}
                disabled={!isBalanced || saveManualMutation.isPending || manualEntries.length === 0}
              >
                Sačuvaj početna stanja
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
