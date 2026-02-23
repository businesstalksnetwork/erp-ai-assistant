import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, AlertCircle } from "lucide-react";

interface Salesperson {
  id: string;
  first_name: string;
  last_name: string;
  pos_pin: string | null;
}

interface PosPinDialogProps {
  salespeople: Salesperson[];
  onIdentified: (salesperson: Salesperson) => void;
}

export function PosPinDialog({ salespeople, onIdentified }: PosPinDialogProps) {
  const { t } = useLanguage();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handleComplete = (value: string) => {
    const matched = salespeople.find((sp) => sp.pos_pin && sp.pos_pin === value);
    if (matched) {
      setError(false);
      onIdentified(matched);
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <div className="flex items-center justify-center h-[60vh]">
      <Card className="max-w-sm w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{t("identifySeller")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t("enterPosPin")}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          <InputOTP
            maxLength={4}
            value={pin}
            onChange={(value) => {
              setPin(value);
              setError(false);
            }}
            onComplete={handleComplete}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
            </InputOTPGroup>
          </InputOTP>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {t("invalidPin")}
            </div>
          )}

          <Button
            className="w-full"
            disabled={pin.length < 4}
            onClick={() => handleComplete(pin)}
          >
            {t("enterPin")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
