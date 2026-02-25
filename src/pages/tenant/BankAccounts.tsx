import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Search, Landmark, Upload, FileText, CreditCard, Wallet, PiggyBank, Building2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type BankAccount = Tables<"bank_accounts"> & { legal_entities?: { name: string } | null; banks?: { name: string; swift_code: string | null } | null };

const ACCOUNT_TYPES = ["CURRENT", "FOREIGN", "SAVINGS", "LOAN"] as const;
const ACCOUNT_TYPE_ICONS: Record<string, typeof CreditCard> = {
  CURRENT: CreditCard, FOREIGN: Building2, SAVINGS: PiggyBank, LOAN: Wallet,
};
const ACCOUNT_TYPE_LABELS: Record<string, Record<string, string>> = {
  CURRENT: { sr: "Tekući", en: "Current" },
  FOREIGN: { sr: "Devizni", en: "Foreign" },
  SAVINGS: { sr: "Štedni", en: "Savings" },
  LOAN: { sr: "Kreditni", en: "Loan" },
};

// IBAN Mod97 validation
function validateIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 15 || cleaned.length > 34) return false;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) return false;
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  let numStr = "";
  for (const ch of rearranged) {
    if (ch >= "A" && ch <= "Z") numStr += (ch.charCodeAt(0) - 55).toString();
    else numStr += ch;
  }
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numStr[i])) % 97;
  }
  return remainder === 1;
}

function extractBankCode(iban: string): string | null {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  if (cleaned.startsWith("RS") && cleaned.length >= 7) return cleaned.substring(4, 7);
  return null;
}

const emptyForm = {
  bank_name: "", account_number: "", currency: "RSD", is_primary: false, is_active: true,
  legal_entity_id: "" as string | null, iban: "", account_type: "CURRENT", swift_code: "",
  bank_code: "", opening_date: "", closing_date: "", purpose: "", bank_id: "" as string | null,
};

export default function BankAccounts() {
  const { t, locale } = useLanguage();
  const { tenantId, isLoading: tenantLoading } = useTenant();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [ibanError, setIbanError] = useState("");

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["bank_accounts", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*, legal_entities(name), banks(name, swift_code)").eq("tenant_id", tenantId!);
      if (error) throw error;
      return data as BankAccount[];
    },
    enabled: !!tenantId,
  });

  const { data: legalEntities = [] } = useQuery({
    queryKey: ["legal_entities", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("legal_entities").select("id, name").eq("tenant_id", tenantId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["banks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banks").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        bank_name: form.bank_name, account_number: form.account_number, currency: form.currency,
        is_primary: form.is_primary, is_active: form.is_active, legal_entity_id: form.legal_entity_id || null,
        iban: form.iban || null, account_type: form.account_type, swift_code: form.swift_code || null,
        bank_code: form.bank_code || null, opening_date: form.opening_date || null,
        closing_date: form.closing_date || null, purpose: form.purpose || null,
        bank_id: form.bank_id || null, updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from("bank_accounts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_accounts").insert({ ...payload, tenant_id: tenantId! } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank_accounts", tenantId] }); toast({ title: t("success") }); closeDialog(); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("bank_accounts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bank_accounts", tenantId] }); toast({ title: t("success") }); setDeleteId(null); },
    onError: () => toast({ title: t("error"), variant: "destructive" }),
  });

  const openEdit = (a: BankAccount) => {
    setEditing(a);
    setForm({
      bank_name: a.bank_name, account_number: a.account_number, currency: a.currency,
      is_primary: a.is_primary, is_active: a.is_active, legal_entity_id: a.legal_entity_id,
      iban: a.iban || "", account_type: a.account_type || "CURRENT", swift_code: a.swift_code || "",
      bank_code: a.bank_code || "", opening_date: a.opening_date || "", closing_date: a.closing_date || "",
      purpose: a.purpose || "", bank_id: a.bank_id || null,
    });
    setIbanError("");
    setDialogOpen(true);
  };
  const openAdd = () => { setEditing(null); setForm(emptyForm); setIbanError(""); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setIbanError(""); };

  const handleIbanChange = (iban: string) => {
    setForm(f => ({ ...f, iban }));
    const cleaned = iban.replace(/\s/g, "");
    if (cleaned.length === 0) { setIbanError(""); return; }
    if (cleaned.length >= 15) {
      if (!validateIBAN(cleaned)) {
        setIbanError(locale === "sr" ? "Neispravan IBAN (Mod 97)" : "Invalid IBAN (Mod 97)");
      } else {
        setIbanError("");
        const code = extractBankCode(cleaned);
        if (code) {
          const bank = banks.find(b => b.bank_code === code);
          if (bank) {
            setForm(f => ({ ...f, bank_code: code, bank_id: bank.id, bank_name: bank.name, swift_code: bank.swift_code || f.swift_code }));
          } else {
            setForm(f => ({ ...f, bank_code: code }));
          }
        }
      }
    } else {
      setIbanError("");
    }
  };

  const filtered = accounts.filter(a =>
    a.bank_name.toLowerCase().includes(search.toLowerCase()) ||
    a.account_number.includes(search) ||
    (a.iban || "").toLowerCase().includes(search.toLowerCase())
  );

  if (tenantLoading || isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}</div></div>;

  const activeCount = accounts.filter(a => a.is_active).length;
  const primaryAccount = accounts.find(a => a.is_primary);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{t("bankAccounts")}</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount} {locale === "sr" ? "aktivnih računa" : "active accounts"}
            {primaryAccount && ` · ${locale === "sr" ? "Primarni" : "Primary"}: ${primaryAccount.bank_name}`}
          </p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />{t("add")}</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Landmark className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{t("noResults")}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(a => {
            const TypeIcon = ACCOUNT_TYPE_ICONS[a.account_type] || CreditCard;
            const typeLabel = ACCOUNT_TYPE_LABELS[a.account_type]?.[locale] || a.account_type;
            return (
              <Card key={a.id} className={`relative transition-colors ${!a.is_active ? "opacity-60" : ""} ${a.is_primary ? "border-primary" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{a.bank_name}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      {a.is_primary && <Badge className="text-xs">{t("primary")}</Badge>}
                      {!a.is_active && <Badge variant="secondary" className="text-xs">{locale === "sr" ? "Neaktivan" : "Inactive"}</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1 text-sm">
                    <p className="font-mono text-muted-foreground">{a.account_number}</p>
                    {a.iban && <p className="font-mono text-xs">{a.iban}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{typeLabel}</Badge>
                    <Badge variant="outline">{a.currency}</Badge>
                    {a.legal_entities?.name && <Badge variant="outline">{a.legal_entities.name}</Badge>}
                  </div>
                  {a.swift_code && <p className="text-xs text-muted-foreground">SWIFT: {a.swift_code}</p>}

                  <div className="flex gap-1 pt-2 border-t">
                    <Button variant="ghost" size="sm" onClick={() => navigate("/accounting/bank-statements")} className="text-xs">
                      <Upload className="h-3 w-3 mr-1" />{locale === "sr" ? "Izvodi" : "Statements"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate("/accounting/document-import")} className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />{locale === "sr" ? "Uvoz" : "Import"}
                    </Button>
                    <div className="ml-auto flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteId(a.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? t("edit") : t("add")} {t("bankAccount")}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label>IBAN</Label>
              <Input value={form.iban} onChange={e => handleIbanChange(e.target.value)} placeholder="RS35 160 0000012345678 90" />
              {ibanError && <p className="text-xs text-destructive mt-1">{ibanError}</p>}
              {form.iban && !ibanError && form.iban.replace(/\s/g, "").length >= 15 && (
                <p className="text-xs mt-1 text-primary">✓ {locale === "sr" ? "Validan IBAN" : "Valid IBAN"}</p>
              )}
            </div>

            <div>
              <Label>{locale === "sr" ? "Banka (registar)" : "Bank (registry)"}</Label>
              <Select value={form.bank_id || "none"} onValueChange={v => {
                if (v === "none") { setForm(f => ({ ...f, bank_id: null })); return; }
                const bank = banks.find(b => b.id === v);
                if (bank) setForm(f => ({ ...f, bank_id: v, bank_name: bank.name, swift_code: bank.swift_code || f.swift_code, bank_code: bank.bank_code }));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {banks.map(b => <SelectItem key={b.id} value={b.id}>{b.name} ({b.bank_code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div><Label>{t("bankName")}</Label><Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
            <div><Label>{t("accountNumber")}</Label><Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} /></div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{locale === "sr" ? "Tip računa" : "Account Type"}</Label>
                <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(at => <SelectItem key={at} value={at}>{ACCOUNT_TYPE_LABELS[at]?.[locale] || at}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("currency")}</Label><Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} /></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>SWIFT/BIC</Label><Input value={form.swift_code} onChange={e => setForm(f => ({ ...f, swift_code: e.target.value }))} /></div>
              <div><Label>{locale === "sr" ? "Šifra banke (NBS)" : "Bank Code (NBS)"}</Label><Input value={form.bank_code} onChange={e => setForm(f => ({ ...f, bank_code: e.target.value }))} maxLength={3} /></div>
            </div>

            <div>
              <Label>{t("legalEntity")}</Label>
              <Select value={form.legal_entity_id || "none"} onValueChange={v => setForm(f => ({ ...f, legal_entity_id: v === "none" ? null : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {legalEntities.map(le => <SelectItem key={le.id} value={le.id}>{le.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>{locale === "sr" ? "Datum otvaranja" : "Opening Date"}</Label><Input type="date" value={form.opening_date} onChange={e => setForm(f => ({ ...f, opening_date: e.target.value }))} /></div>
              <div><Label>{locale === "sr" ? "Datum zatvaranja" : "Closing Date"}</Label><Input type="date" value={form.closing_date} onChange={e => setForm(f => ({ ...f, closing_date: e.target.value }))} /></div>
            </div>

            <div><Label>{locale === "sr" ? "Namena" : "Purpose"}</Label><Input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} /></div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={form.is_primary} onCheckedChange={v => setForm(f => ({ ...f, is_primary: v }))} /><Label>{t("primary")}</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>{t("active")}</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{t("cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.bank_name || !form.account_number || saveMutation.isPending || !!ibanError}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("confirm")}</AlertDialogTitle><AlertDialogDescription>{t("deleteConfirmation")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
