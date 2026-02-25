import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/i18n/LanguageContext";
import { Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { DYNAMIC_SOURCES, AMOUNT_SOURCES } from "@/lib/postingRuleEngine";

interface PaymentModel {
  id: string;
  code: string;
  name_en: string;
  name_sr: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
}

interface BankAccount {
  id: string;
  account_number: string;
  bank_name: string;
}

interface RuleLine {
  side: "DEBIT" | "CREDIT";
  account_source: "FIXED" | "DYNAMIC";
  account_id: string | null;
  dynamic_source: string | null;
  amount_source: string;
  amount_factor: number;
  description_template: string;
  is_tax_line: boolean;
}

interface RuleWizardProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  models: PaymentModel[];
  accounts: Account[];
  bankAccounts: BankAccount[];
  onSave: (data: {
    payment_model_id: string;
    name: string;
    description: string;
    bank_account_id: string | null;
    currency: string | null;
    partner_type: string | null;
    is_default: boolean;
    priority: number;
    auto_post: boolean;
    require_approval: boolean;
    valid_from: string;
    valid_to: string | null;
    lines: RuleLine[];
  }) => void;
  saving: boolean;
}

export function RuleWizard({ open, onOpenChange, models, accounts, bankAccounts, onSave, saving }: RuleWizardProps) {
  const { t, locale } = useLanguage();
  const [step, setStep] = useState(0);

  const [modelId, setModelId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [partnerType, setPartnerType] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [priority, setPriority] = useState(0);
  const [autoPost, setAutoPost] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [validTo, setValidTo] = useState<string | null>(null);

  const [lines, setLines] = useState<RuleLine[]>([
    { side: "DEBIT", account_source: "DYNAMIC", account_id: null, dynamic_source: "BANK_ACCOUNT", amount_source: "FULL", amount_factor: 1, description_template: "", is_tax_line: false },
    { side: "CREDIT", account_source: "DYNAMIC", account_id: null, dynamic_source: "PARTNER_RECEIVABLE", amount_source: "FULL", amount_factor: 1, description_template: "", is_tax_line: false },
  ]);

  const addLine = (side: "DEBIT" | "CREDIT") => {
    setLines([...lines, { side, account_source: "FIXED", account_id: null, dynamic_source: null, amount_source: "FULL", amount_factor: 1, description_template: "", is_tax_line: false }]);
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, patch: Partial<RuleLine>) => {
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const debitLines = lines.filter((l) => l.side === "DEBIT");
  const creditLines = lines.filter((l) => l.side === "CREDIT");
  const debitSum = debitLines.reduce((s, l) => s + (l.amount_factor || 1), 0);
  const creditSum = creditLines.reduce((s, l) => s + (l.amount_factor || 1), 0);
  const balanced = debitLines.length > 0 && creditLines.length > 0;
  const hasRequiredFields = modelId && name;

  const handleSave = () => {
    onSave({
      payment_model_id: modelId,
      name,
      description,
      bank_account_id: bankAccountId,
      currency,
      partner_type: partnerType,
      is_default: isDefault,
      priority,
      auto_post: autoPost,
      require_approval: requireApproval,
      valid_from: validFrom,
      valid_to: validTo,
      lines,
    });
  };

  const stepLabels = [t("stepSelectModel"), t("stepConfigureLines"), t("stepValidate")];

  const renderLineEditor = (line: RuleLine, idx: number, globalIdx: number) => (
    <div key={globalIdx} className="flex flex-wrap items-center gap-2 p-2 border rounded text-xs">
      <Select value={line.account_source} onValueChange={(v) => updateLine(globalIdx, { account_source: v as "FIXED" | "DYNAMIC", account_id: null, dynamic_source: null })}>
        <SelectTrigger className="w-[100px] h-7 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="FIXED">{t("fixedAccount")}</SelectItem>
          <SelectItem value="DYNAMIC">{t("dynamicAccount")}</SelectItem>
        </SelectContent>
      </Select>

      {line.account_source === "FIXED" ? (
        <Select value={line.account_id || "__none__"} onValueChange={(v) => updateLine(globalIdx, { account_id: v === "__none__" ? null : v })}>
          <SelectTrigger className="w-[180px] h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Select value={line.dynamic_source || "__none__"} onValueChange={(v) => updateLine(globalIdx, { dynamic_source: v === "__none__" ? null : v })}>
          <SelectTrigger className="w-[180px] h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {DYNAMIC_SOURCES.map((ds) => <SelectItem key={ds} value={ds}>{ds}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Select value={line.amount_source} onValueChange={(v) => updateLine(globalIdx, { amount_source: v })}>
        <SelectTrigger className="w-[100px] h-7 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {AMOUNT_SOURCES.map((as_) => <SelectItem key={as_} value={as_}>{as_}</SelectItem>)}
        </SelectContent>
      </Select>

      <Input type="number" step="0.01" className="w-[70px] h-7 text-xs" value={line.amount_factor} onChange={(e) => updateLine(globalIdx, { amount_factor: parseFloat(e.target.value) || 1 })} />

      <label className="flex items-center gap-1 text-xs">
        <Switch checked={line.is_tax_line} onCheckedChange={(c) => updateLine(globalIdx, { is_tax_line: c })} className="scale-75" />
        PDV
      </label>

      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(globalIdx)}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("ruleWizard")}</DialogTitle>
          <div className="flex gap-2 pt-2">
            {stepLabels.map((label, i) => (
              <Badge key={i} variant={i === step ? "default" : "outline"} className="cursor-pointer" onClick={() => setStep(i)}>
                {i + 1}. {label}
              </Badge>
            ))}
          </div>
        </DialogHeader>

        {step === 0 && (
          <div className="grid gap-4 py-2">
            <div>
              <Label>{t("paymentModel")}</Label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger><SelectValue placeholder={t("stepSelectModel")} /></SelectTrigger>
                <SelectContent>
                  {models.map((m) => <SelectItem key={m.id} value={m.id}>{locale === "sr" ? m.name_sr : m.name_en}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("ruleName")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>{t("description")}</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>{t("bankAccountFilter")}</Label>
                <Select value={bankAccountId || "__none__"} onValueChange={(v) => setBankAccountId(v === "__none__" ? null : v)}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("all")}</SelectItem>
                    {bankAccounts.map((b) => <SelectItem key={b.id} value={b.id}>{b.account_number} ({b.bank_name})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("currencyFilter")}</Label><Input value={currency || ""} onChange={(e) => setCurrency(e.target.value || null)} placeholder="RSD" /></div>
              <div>
                <Label>{t("partnerTypeFilter")}</Label>
                <Select value={partnerType || "__none__"} onValueChange={(v) => setPartnerType(v === "__none__" ? null : v)}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("all")}</SelectItem>
                    <SelectItem value="CUSTOMER">{t("customer")}</SelectItem>
                    <SelectItem value="VENDOR">{t("supplier")}</SelectItem>
                    <SelectItem value="EMPLOYEE">{t("employee")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("validFromRule")}</Label><Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></div>
              <div><Label>{t("validToRule")}</Label><Input type="date" value={validTo || ""} onChange={(e) => setValidTo(e.target.value || null)} /></div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm"><Switch checked={isDefault} onCheckedChange={setIsDefault} />{t("isDefaultRule")}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={autoPost} onCheckedChange={setAutoPost} />{t("autoPostRule")}</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={requireApproval} onCheckedChange={setRequireApproval} />{t("requireApprovalRule")}</label>
            </div>
            <div className="w-32">
              <Label>{t("rulePriority")}</Label>
              <Input type="number" value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 0)} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">{t("debitSide")}</h4>
                <Button variant="outline" size="sm" onClick={() => addLine("DEBIT")}><Plus className="h-3 w-3 mr-1" />{t("addDebitLine")}</Button>
              </div>
              <div className="space-y-2">
                {lines.map((line, i) => line.side === "DEBIT" ? renderLineEditor(line, i, i) : null)}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">{t("creditSide")}</h4>
                <Button variant="outline" size="sm" onClick={() => addLine("CREDIT")}><Plus className="h-3 w-3 mr-1" />{t("addCreditLine")}</Button>
              </div>
              <div className="space-y-2">
                {lines.map((line, i) => line.side === "CREDIT" ? renderLineEditor(line, i, i) : null)}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            <h4 className="font-semibold text-sm">{t("balanceCheck")}</h4>
            {balanced ? (
              <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>{t("balanceOk")} — D:{debitSum.toFixed(2)} = C:{creditSum.toFixed(2)}</AlertDescription></Alert>
            ) : (
              <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{t("balanceError")} — D:{debitSum.toFixed(2)} ≠ C:{creditSum.toFixed(2)}</AlertDescription></Alert>
            )}
            <div className="text-sm space-y-1">
              <p><strong>{t("debitSide")}:</strong> {debitLines.length} {t("postingRuleLines").toLowerCase()}</p>
              <p><strong>{t("creditSide")}:</strong> {creditLines.length} {t("postingRuleLines").toLowerCase()}</p>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>{t("back")}</Button>}
          </div>
          <div className="flex gap-2">
            {step < 2 && <Button onClick={() => setStep(step + 1)}>{t("next")}</Button>}
            {step === 2 && (
              <Button onClick={handleSave} disabled={saving || !hasRequiredFields || !balanced}>
                {t("save")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
