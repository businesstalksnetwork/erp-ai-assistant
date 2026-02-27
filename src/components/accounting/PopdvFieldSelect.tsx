import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PopdvFieldSelectProps {
  direction: "OUTPUT" | "INPUT" | "BOTH";
  value: string;
  onValueChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}

const SECTION_LABELS: Record<number, string> = {
  1: "1 — Oslobođenja sa pravom na odbitak",
  2: "2 — Oslobođenja bez prava na odbitak",
  3: "3 — Oporezivi promet i obračunati PDV",
  4: "4 — Posebni postupci oporezivanja",
  6: "6 — Uvoz dobara",
  7: "7 — Nabavka od poljoprivrednika",
  8: "8 — Nabavke dobara i usluga (8a–8g, 8v, 8d, 8e)",
  9: "9 — Bez prava odbitka PDV",
  11: "11 — Promet van Republike / ostalo",
};

export function PopdvFieldSelect({ direction, value, onValueChange, disabled, className }: PopdvFieldSelectProps) {
  const { data: types = [] } = useQuery({
    queryKey: ["popdv-tax-types"],
    queryFn: async () => {
      const { data } = await supabase
        .from("popdv_tax_types" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return (data || []) as any[];
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const filtered = types.filter((t: any) => t.direction === direction || t.direction === "BOTH");
  
  // Group by section
  const sections = new Map<number, any[]>();
  filtered.forEach((t: any) => {
    const sec = t.popdv_section;
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec)!.push(t);
  });

  return (
    <Select value={value || "__none__"} onValueChange={(v) => onValueChange(v === "__none__" ? "" : v)} disabled={disabled}>
      <SelectTrigger className={className || "h-8"}>
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        <SelectItem value="__none__">—</SelectItem>
        {Array.from(sections.entries()).map(([sec, items]) => (
          <SelectGroup key={sec}>
            <SelectLabel className="text-xs text-muted-foreground">{SECTION_LABELS[sec] || `Sekcija ${sec}`}</SelectLabel>
            {items.map((t: any) => (
              <SelectItem key={t.id} value={t.id} className={t.parent_id ? "pl-12" : ""}>
                <span className="font-mono text-xs mr-1">{t.id}</span>
                <span className={t.is_special_record ? "italic text-muted-foreground" : ""}>{t.description_short}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
