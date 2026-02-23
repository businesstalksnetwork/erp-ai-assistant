import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealValue: number;
  currency: string;
  onSubmit: (data: {
    won_amount: number;
    lost_amount: number;
    won_reason: string;
    lost_reason: string;
    create_followup: boolean;
  }) => void;
  isPending: boolean;
}

export function PartialWonDialog({ open, onOpenChange, dealValue, currency, onSubmit, isPending }: Props) {
  const { t } = useLanguage();
  const [wonAmount, setWonAmount] = useState(0);
  const [wonReason, setWonReason] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [createFollowup, setCreateFollowup] = useState(false);

  const lostAmount = Math.max(dealValue - wonAmount, 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat("sr-RS", { style: "currency", currency: currency || "RSD", maximumFractionDigits: 0 }).format(n);

  const handleSubmit = () => {
    onSubmit({
      won_amount: wonAmount,
      lost_amount: lostAmount,
      won_reason: wonReason,
      lost_reason: lostReason,
      create_followup: createFollowup,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("splitDeal")}</DialogTitle>
          <DialogDescription>{t("splitDealDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {t("value")}: <strong>{fmt(dealValue)}</strong>
          </div>
          <div className="grid gap-2">
            <Label>{t("wonAmount")}</Label>
            <Input
              type="number"
              min={0}
              max={dealValue}
              value={wonAmount}
              onChange={(e) => setWonAmount(Math.min(Number(e.target.value), dealValue))}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("lostAmount")}</Label>
            <Input type="number" value={lostAmount} disabled />
          </div>
          <div className="grid gap-2">
            <Label>{t("wonReason")}</Label>
            <Textarea value={wonReason} onChange={(e) => setWonReason(e.target.value)} rows={2} />
          </div>
          <div className="grid gap-2">
            <Label>{t("lostReason")}</Label>
            <Textarea value={lostReason} onChange={(e) => setLostReason(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="followup"
              checked={createFollowup}
              onCheckedChange={(c) => setCreateFollowup(!!c)}
            />
            <Label htmlFor="followup" className="text-sm font-normal cursor-pointer">
              {t("createFollowup")}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button onClick={handleSubmit} disabled={wonAmount <= 0 || isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
