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
  3: "3/3a — Opšta stopa 20%",
  4: "4/4a — Posebna stopa 10%",
  5: "5 — Ukupan promet",
  6: "6 — Prethodni porez (domaći)",
  7: "7 — Prethodni porez (inostranstvo)",
  8: "8 — Nabavke / Ispravke",
  9: "9 — Neodbivi PDV",
  10: "10 — Poreska obaveza",
  11: "11 — Posebna evidencija",
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
            {items.filter((t: any) => !t.is_special_record).map((t: any) => (
              <SelectItem key={t.id} value={t.id}>
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
