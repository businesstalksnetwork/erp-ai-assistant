import { useState, useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useLeaveRequest } from "@/hooks/useLeaveRequest";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  balance?: { entitled: number; used: number; pending: number; carriedOver: number };
}

const LEAVE_TYPES = [
  { value: "vacation", label: "Godišnji odmor" },
  { value: "sick", label: "Bolovanje" },
  { value: "personal", label: "Lično odsustvo" },
  { value: "maternity", label: "Porodiljsko" },
  { value: "paternity", label: "Očinsko" },
  { value: "unpaid", label: "Neplaćeno" },
];

export function LeaveRequestDialog({ open, onOpenChange, employeeId, balance }: Props) {
  const { t } = useLanguage();
  const { validate, submitMutation } = useLeaveRequest(employeeId);
  const [leaveType, setLeaveType] = useState("vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [validation, setValidation] = useState<{ valid?: boolean; days?: number; error?: string } | null>(null);
  const [validating, setValidating] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setLeaveType("vacation");
      setStartDate("");
      setEndDate("");
      setReason("");
      setValidation(null);
    }
  }, [open]);

  // Auto-validate when dates change
  useEffect(() => {
    if (!startDate || !endDate) { setValidation(null); return; }
    const timer = setTimeout(async () => {
      setValidating(true);
      try {
        const result = await validate(startDate, endDate, leaveType);
        setValidation(result);
      } catch (e: any) {
        setValidation({ valid: false, error: e.message });
      }
      setValidating(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [startDate, endDate, leaveType]);

  const handleSubmit = async () => {
    await submitMutation.mutateAsync({ leaveType, startDate, endDate, reason });
    onOpenChange(false);
  };

  const available = balance
    ? balance.entitled + balance.carriedOver - balance.used - balance.pending
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("leaveRequestTitle" as any) || "Zatraži odsustvo"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>{t("leaveType")}</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map(lt => (
                  <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {leaveType === "vacation" && available !== null && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
              Raspoloživo dana: <span className="font-semibold text-foreground">{available}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("startDate")}</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>{t("endDate")}</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {validating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Provera...
            </div>
          )}

          {validation && !validating && (
            <Alert variant={validation.valid ? "default" : "destructive"}>
              {validation.valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertDescription>
                {validation.valid
                  ? `${validation.days} ${validation.days === 1 ? "dan" : "dana"}`
                  : validation.error}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
            <Label>{t("reason") || "Razlog"} ({t("optional") || "opciono"})</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={!validation?.valid || submitMutation.isPending}
          >
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (t("submit") || "Pošalji")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
