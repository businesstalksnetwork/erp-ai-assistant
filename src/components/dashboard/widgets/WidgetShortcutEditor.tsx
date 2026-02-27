import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Plus, Trash2 } from "lucide-react";
import type { WidgetConfig } from "@/hooks/useDashboardLayout";

export interface ShortcutItem {
  label: string;
  path: string;
  icon?: string;
}

const PRESET_SHORTCUTS: ShortcutItem[] = [
  { label: "Nova faktura", path: "/accounting/invoices/new" },
  { label: "Nalog za knjiženje", path: "/accounting/journal" },
  { label: "Dodaj lead", path: "/crm/leads" },
  { label: "POS", path: "/pos" },
  { label: "Zalihe", path: "/inventory/stock" },
  { label: "Zaposleni", path: "/hr/employees" },
  { label: "Izvještaji", path: "/accounting/reports" },
  { label: "Partneri", path: "/accounting/partners" },
  { label: "Narudžbenice", path: "/inventory/purchase-orders" },
  { label: "Odsustva", path: "/hr/leave" },
];

interface Props {
  widgetConfig: WidgetConfig;
  onUpdateConfig: (id: string, configJson: Record<string, any>) => void;
}

export function WidgetShortcutEditor({ widgetConfig, onUpdateConfig }: Props) {
  const { t } = useLanguage();
  const shortcuts: ShortcutItem[] = widgetConfig.configJson?.shortcuts || [];
  const [addMode, setAddMode] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newPath, setNewPath] = useState("");
  const [presetValue, setPresetValue] = useState("");

  const save = (updated: ShortcutItem[]) => {
    onUpdateConfig(widgetConfig.id, { ...widgetConfig.configJson, shortcuts: updated });
  };

  const handleRemove = (idx: number) => {
    save(shortcuts.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    if (!newLabel.trim() || !newPath.trim()) return;
    save([...shortcuts, { label: newLabel.trim(), path: newPath.trim() }]);
    setNewLabel("");
    setNewPath("");
    setAddMode(false);
  };

  const handlePreset = (val: string) => {
    const preset = PRESET_SHORTCUTS.find((p) => p.path === val);
    if (preset && !shortcuts.some((s) => s.path === preset.path)) {
      save([...shortcuts, preset]);
    }
    setPresetValue("");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="absolute top-1 left-7 z-10 p-1 rounded bg-muted/80 hover:bg-muted"
          aria-label="Settings"
        >
          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">{t("quickActions")} — Prečice</h4>

          {/* Current shortcuts */}
          {shortcuts.length > 0 ? (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {shortcuts.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                  <span className="truncate">{s.label}</span>
                  <button onClick={() => handleRemove(i)} className="text-destructive hover:text-destructive/80 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nema prilagođenih prečica. Koriste se podrazumevane.</p>
          )}

          {/* Add from presets */}
          <div className="space-y-1.5">
            <Label className="text-xs">Dodaj iz predefinisanih</Label>
            <Select value={presetValue} onValueChange={handlePreset}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Izaberi..." />
              </SelectTrigger>
              <SelectContent>
                {PRESET_SHORTCUTS.filter((p) => !shortcuts.some((s) => s.path === p.path)).map((p) => (
                  <SelectItem key={p.path} value={p.path}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom add */}
          {addMode ? (
            <div className="space-y-2 border-t pt-2">
              <div className="grid gap-1">
                <Label className="text-xs">Naziv</Label>
                <Input className="h-8 text-xs" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Moja prečica" />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Putanja</Label>
                <Input className="h-8 text-xs" value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="/accounting/reports" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddMode(false)}>Otkaži</Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!newLabel.trim() || !newPath.trim()}>Dodaj</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => setAddMode(true)}>
              <Plus className="h-3 w-3 mr-1" /> Prilagođena prečica
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
