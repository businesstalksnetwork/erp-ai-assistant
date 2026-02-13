import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface TaxLabelMapEditorProps {
  value: Record<string, string>;
  onChange: (map: Record<string, string>) => void;
}

export default function TaxLabelMapEditor({ value, onChange }: TaxLabelMapEditorProps) {
  const { t } = useLanguage();
  const entries = Object.entries(value);

  const updateKey = (oldKey: string, newKey: string) => {
    const newMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(value)) {
      newMap[k === oldKey ? newKey : k] = v;
    }
    onChange(newMap);
  };

  const updateValue = (key: string, newVal: string) => {
    onChange({ ...value, [key]: newVal });
  };

  const removeEntry = (key: string) => {
    const { [key]: _, ...rest } = value;
    onChange(rest);
  };

  const addEntry = () => {
    onChange({ ...value, "": "" });
  };

  return (
    <div className="space-y-2">
      <Label>{t("taxLabelMapping")}</Label>
      <div className="space-y-1">
        {entries.map(([rate, label], i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="w-20"
              placeholder="%"
              value={rate}
              onChange={(e) => updateKey(rate, e.target.value)}
            />
            <span className="text-muted-foreground">→</span>
            <Input
              className="w-16"
              placeholder="A"
              maxLength={2}
              value={label}
              onChange={(e) => updateValue(rate, e.target.value)}
            />
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeEntry(rate)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addEntry}>
        <Plus className="h-3 w-3 mr-1" />{t("add")}
      </Button>
    </div>
  );
}
