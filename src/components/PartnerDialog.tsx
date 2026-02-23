import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface Partner {
  id: string;
  name: string;
  code: string;
  discount_percent: number;
  free_trial_days: number;
  is_active: boolean;
  description: string | null;
}

interface PartnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner: Partner | null;
  onSave: (data: Omit<Partner, 'id'>) => Promise<void>;
  isLoading: boolean;
}

export function PartnerDialog({
  open,
  onOpenChange,
  partner,
  onSave,
  isLoading,
}: PartnerDialogProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [freeTrialDays, setFreeTrialDays] = useState(14);
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (partner) {
      setName(partner.name);
      setCode(partner.code);
      setDiscountPercent(partner.discount_percent);
      setFreeTrialDays(partner.free_trial_days);
      setIsActive(partner.is_active);
      setDescription(partner.description || "");
    } else {
      setName("");
      setCode("");
      setDiscountPercent(0);
      setFreeTrialDays(14);
      setIsActive(true);
      setDescription("");
    }
  }, [partner, open]);

  const generateCode = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!partner) {
      setCode(generateCode(value));
    }
  };

  const handleSubmit = async () => {
    await onSave({
      name,
      code,
      discount_percent: discountPercent,
      free_trial_days: freeTrialDays,
      is_active: isActive,
      description: description || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {partner ? "Uredi partnera" : "Dodaj novog partnera"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Ime partnera *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="npr. Freelance Serbia"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Kod za URL *</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="npr. freelance-serbia"
            />
            <p className="text-xs text-muted-foreground">
              Link: pausalbox.aiknjigovodja.rs/auth?partner={code || "kod"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="discount">Popust (%)</Label>
              <Input
                id="discount"
                type="number"
                min={0}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Trajni popust na pretplate
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trial">Trial period (dana)</Label>
              <Input
                id="trial"
                type="number"
                min={0}
                value={freeTrialDays}
                onChange={(e) => setFreeTrialDays(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Podrazumevano: 14 dana
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Opis (opciono)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dodatne napomene o partneru..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Aktivan partner</Label>
              <p className="text-xs text-muted-foreground">
                Neaktivni partneri ne mogu registrovati nove korisnike
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Otkaži
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !name || !code}>
            {isLoading ? "Čuvanje..." : partner ? "Sačuvaj" : "Dodaj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
