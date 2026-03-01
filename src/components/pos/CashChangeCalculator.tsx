import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Banknote } from "lucide-react";

interface CashChangeCalculatorProps {
  total: number;
}

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

export function CashChangeCalculator({ total }: CashChangeCalculatorProps) {
  const { t } = useLanguage();
  const [customerGives, setCustomerGives] = useState<string>("");
  const [showCalculator, setShowCalculator] = useState(false);

  const givenAmount = parseFloat(customerGives) || 0;
  const change = givenAmount - total;

  useEffect(() => {
    setCustomerGives("");
  }, [total]);

  if (!showCalculator) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="w-full gap-2"
        onClick={() => setShowCalculator(true)}
      >
        <Banknote className="h-4 w-4" />
        {t("cashChange" as any) || "Kusur"}
      </Button>
    );
  }

  return (
    <div className="space-y-2 p-3 rounded-lg border bg-muted/50">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t("customerGives" as any) || "Kupac daje"}:</span>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowCalculator(false)}>✕</Button>
      </div>
      <Input
        type="number"
        step="0.01"
        min={0}
        value={customerGives}
        onChange={(e) => setCustomerGives(e.target.value)}
        placeholder="0.00"
        className="text-right font-mono text-lg h-10"
        autoFocus
      />
      <div className="flex gap-1 flex-wrap">
        {QUICK_AMOUNTS.filter(a => a >= total).map((amount) => (
          <Button
            key={amount}
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => setCustomerGives(amount.toString())}
          >
            {amount.toLocaleString()}
          </Button>
        ))}
      </div>
      {givenAmount > 0 && (
        <div className={`flex justify-between font-bold text-lg ${change < 0 ? "text-destructive" : "text-success"}`}>
          <span>{t("changeDue" as any) || "Kusur"}:</span>
          <span className="font-mono">{change >= 0 ? change.toFixed(2) : `−${Math.abs(change).toFixed(2)}`}</span>
        </div>
      )}
    </div>
  );
}
