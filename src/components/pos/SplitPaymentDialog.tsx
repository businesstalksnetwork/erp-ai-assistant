import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Banknote, Smartphone, Wallet } from "lucide-react";

interface PaymentSplit {
  method: string;
  amount: number;
  label: string;
  icon: React.ReactNode;
}

interface SplitPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  onConfirm: (payments: { method: string; amount: number }[]) => void;
}

const METHODS = [
  { method: "cash", label: "Gotovina", icon: <Banknote className="h-4 w-4" /> },
  { method: "card", label: "Kartica", icon: <CreditCard className="h-4 w-4" /> },
  { method: "wire_transfer", label: "Prenos", icon: <Wallet className="h-4 w-4" /> },
  { method: "mobile", label: "Mobilno", icon: <Smartphone className="h-4 w-4" /> },
];

export function SplitPaymentDialog({ open, onOpenChange, total, onConfirm }: SplitPaymentDialogProps) {
  const { t } = useLanguage();
  const [splits, setSplits] = useState<PaymentSplit[]>([
    { ...METHODS[0], amount: total },
  ]);

  useEffect(() => {
    if (open) {
      setSplits([{ ...METHODS[0], amount: total }]);
    }
  }, [open, total]);

  const allocated = splits.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.round((total - allocated) * 100) / 100;

  const addMethod = (m: typeof METHODS[0]) => {
    if (splits.find((s) => s.method === m.method)) return;
    setSplits((prev) => [...prev, { ...m, amount: 0 }]);
  };

  const removeMethod = (method: string) => {
    setSplits((prev) => prev.filter((s) => s.method !== method));
  };

  const updateAmount = (method: string, amount: number) => {
    setSplits((prev) =>
      prev.map((s) => (s.method === method ? { ...s, amount: Math.max(0, amount) } : s))
    );
  };

  const autoFillRemaining = (method: string) => {
    const otherTotal = splits.filter((s) => s.method !== method).reduce((s, p) => s + p.amount, 0);
    updateAmount(method, Math.max(0, Math.round((total - otherTotal) * 100) / 100));
  };

  const cashSplit = splits.find((s) => s.method === "cash");
  const cashChange = cashSplit && cashSplit.amount > 0
    ? Math.max(0, allocated - total)
    : 0;

  const isValid = Math.abs(remaining) < 0.01 || (cashSplit && allocated >= total);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("splitPayment" as any) || "Podeljeno plaćanje"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{t("total")}:</span>
            <span className="font-bold text-lg">{total.toFixed(2)} RSD</span>
          </div>

          {/* Available methods to add */}
          <div className="flex gap-2 flex-wrap">
            {METHODS.filter((m) => !splits.find((s) => s.method === m.method)).map((m) => (
              <Button
                key={m.method}
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => addMethod(m)}
              >
                {m.icon} + {m.label}
              </Button>
            ))}
          </div>

          {/* Active splits */}
          <div className="space-y-3">
            {splits.map((split) => (
              <div key={split.method} className="flex items-center gap-2 p-3 rounded-lg border">
                <div className="flex items-center gap-2 min-w-0">
                  {split.icon}
                  <span className="text-sm font-medium">{split.label}</span>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={split.amount || ""}
                  onChange={(e) => updateAmount(split.method, parseFloat(e.target.value) || 0)}
                  className="w-28 text-right font-mono h-9"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 px-2"
                  onClick={() => autoFillRemaining(split.method)}
                >
                  {t("rest" as any) || "Ostatak"}
                </Button>
                {splits.length > 1 && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeMethod(split.method)}
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="space-y-1 text-sm border-t pt-3">
            <div className="flex justify-between">
              <span>{t("allocated" as any) || "Raspoređeno"}:</span>
              <span className="font-mono">{allocated.toFixed(2)}</span>
            </div>
            {remaining > 0.01 && (
              <div className="flex justify-between text-destructive">
                <span>{t("remaining" as any) || "Preostalo"}:</span>
                <span className="font-mono">{remaining.toFixed(2)}</span>
              </div>
            )}
            {cashChange > 0 && (
              <div className="flex justify-between text-success font-bold">
                <span>{t("changeDue" as any) || "Kusur"}:</span>
                <span className="font-mono">{cashChange.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!isValid}
            onClick={() => {
              onConfirm(splits.map((s) => ({ method: s.method, amount: s.amount })));
              onOpenChange(false);
            }}
          >
            {t("confirm" as any) || "Potvrdi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
