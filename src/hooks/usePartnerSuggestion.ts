import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PartnerMatch {
  id: string;
  name: string;
  pib: string | null;
  maticni_broj: string | null;
  type: string;
  similarity: number;
}

export function usePartnerSuggestion(tenantId: string | null) {
  const [suggestions, setSuggestions] = useState<PartnerMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (name: string, pib?: string) => {
    if (!tenantId || (!name && !pib)) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const matches: PartnerMatch[] = [];

        // Exact PIB match (highest priority)
        if (pib && pib.length >= 8) {
          const { data: pibMatches } = await supabase
            .from("partners")
            .select("id, name, pib, maticni_broj, type")
            .eq("tenant_id", tenantId)
            .eq("pib", pib)
            .limit(3);

          for (const p of pibMatches || []) {
            matches.push({ ...p, similarity: 1.0 });
          }
        }

        // Name similarity (fuzzy via ilike patterns)
        if (name && name.length >= 3) {
          const normalizedName = name.trim().toLowerCase();
          const words = normalizedName.split(/\s+/).filter(w => w.length >= 3);

          if (words.length > 0) {
            // Search by first significant word
            const { data: nameMatches } = await supabase
              .from("partners")
              .select("id, name, pib, maticni_broj, type")
              .eq("tenant_id", tenantId)
              .ilike("name", `%${words[0]}%`)
              .limit(10);

            for (const p of nameMatches || []) {
              if (matches.some(m => m.id === p.id)) continue;
              // Simple similarity: count matching words
              const pName = p.name.toLowerCase();
              const matchCount = words.filter(w => pName.includes(w)).length;
              const similarity = matchCount / Math.max(words.length, pName.split(/\s+/).length);
              if (similarity >= 0.3) {
                matches.push({ ...p, similarity: Math.round(similarity * 100) / 100 });
              }
            }
          }
        }

        // Sort by similarity desc, take top 5
        matches.sort((a, b) => b.similarity - a.similarity);
        setSuggestions(matches.slice(0, 5));
      } catch (e) {
        console.error("Partner suggestion error:", e);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [tenantId]);

  const clear = useCallback(() => setSuggestions([]), []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return { suggestions, loading, search, clear };
}
