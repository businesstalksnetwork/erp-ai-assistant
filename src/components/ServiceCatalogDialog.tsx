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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ServiceCatalogItem } from "@/hooks/useServiceCatalog";

interface ServiceCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    name: string;
    description: string | null;
    item_type: "services" | "products";
    default_unit_price: number | null;
    default_foreign_price: number | null;
    foreign_currency: string | null;
    unit: string;
    is_active: boolean;
  }) => void;
  initialData?: ServiceCatalogItem | null;
  isLoading?: boolean;
}

const UNIT_OPTIONS = [
  { value: "kom", label: "Komad (kom)" },
  { value: "sat", label: "Sat (sat)" },
  { value: "dan", label: "Dan (dan)" },
  { value: "mes", label: "Mesec (mes)" },
  { value: "god", label: "Godina (god)" },
  { value: "m2", label: "Kvadratni metar (m²)" },
  { value: "m", label: "Metar (m)" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "l", label: "Litar (l)" },
];

export function ServiceCatalogDialog({
  open,
  onOpenChange,
  onSave,
  initialData,
  isLoading,
}: ServiceCatalogDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState<"services" | "products">("services");
  const [defaultUnitPrice, setDefaultUnitPrice] = useState("");
  const [defaultForeignPrice, setDefaultForeignPrice] = useState("");
  const [foreignCurrency, setForeignCurrency] = useState("EUR");
  const [unit, setUnit] = useState("kom");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description || "");
      setItemType(initialData.item_type);
      setDefaultUnitPrice(initialData.default_unit_price?.toString() || "");
      setDefaultForeignPrice(initialData.default_foreign_price?.toString() || "");
      setForeignCurrency(initialData.foreign_currency || "EUR");
      setUnit(initialData.unit || "kom");
      setIsActive(initialData.is_active);
    } else {
      setName("");
      setDescription("");
      setItemType("services");
      setDefaultUnitPrice("");
      setDefaultForeignPrice("");
      setForeignCurrency("EUR");
      setUnit("kom");
      setIsActive(true);
    }
  }, [initialData, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description: description || null,
      item_type: itemType,
      default_unit_price: defaultUnitPrice ? parseFloat(defaultUnitPrice) : null,
      default_foreign_price: defaultForeignPrice ? parseFloat(defaultForeignPrice) : null,
      foreign_currency: defaultForeignPrice ? foreignCurrency : null,
      unit,
      is_active: isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Izmeni stavku" : "Nova stavka šifarnika"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Naziv *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Npr. IT konsalting"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Opis (opciono)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detaljniji opis usluge ili proizvoda"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Tip</Label>
            <RadioGroup
              value={itemType}
              onValueChange={(value) => setItemType(value as "services" | "products")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="services" id="services" />
                <Label htmlFor="services" className="font-normal cursor-pointer">
                  Usluga
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="products" id="products" />
                <Label htmlFor="products" className="font-normal cursor-pointer">
                  Proizvod
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Jedinica mere</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="defaultUnitPrice">Cena (RSD)</Label>
              <Input
                id="defaultUnitPrice"
                type="number"
                step="0.01"
                min="0"
                value={defaultUnitPrice}
                onChange={(e) => setDefaultUnitPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultForeignPrice">Cena ({foreignCurrency})</Label>
              <div className="flex gap-2">
                <Select value={foreignCurrency} onValueChange={setForeignCurrency}>
                  <SelectTrigger className="w-[90px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="defaultForeignPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={defaultForeignPrice}
                  onChange={(e) => setDefaultForeignPrice(e.target.value)}
                  placeholder="0.00"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive" className="cursor-pointer">
              Aktivna stavka
            </Label>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Otkaži
            </Button>
            <Button type="submit" disabled={!name || isLoading}>
              {isLoading ? "Čuvanje..." : "Sačuvaj"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
