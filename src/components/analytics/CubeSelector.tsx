import { useLanguage } from "@/i18n/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CUBES = [
  { value: "gl_entries", labelEn: "General Ledger", labelSr: "Glavna knjiga" },
  { value: "invoices", labelEn: "Invoices", labelSr: "Fakture" },
  { value: "purchases", labelEn: "Purchases", labelSr: "Nabavke" },
  { value: "inventory", labelEn: "Inventory", labelSr: "Zalihe" },
  { value: "payroll", labelEn: "Payroll", labelSr: "Zarade" },
  { value: "pos", labelEn: "POS / Retail", labelSr: "Maloprodaja" },
];

interface Props {
  value: string;
  onChange: (cube: string) => void;
}

export function CubeSelector({ value, onChange }: Props) {
  const { locale } = useLanguage();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CUBES.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {locale === "sr" ? c.labelSr : c.labelEn}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
