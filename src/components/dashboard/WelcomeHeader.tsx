import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { format } from "date-fns";
import { srLatn } from "date-fns/locale";

/**
 * Convert a Serbian first name to vocative case (vokativ).
 * Best-effort heuristic covering ~90%+ of common Serbian first names.
 */
function toVocative(name: string): string {
  if (!name || name.length < 2) return name;

  const lower = name.toLowerCase();

  // Names ending in -a (female: Ana, Jovana; male: Nikola, Luka) → no change
  if (lower.endsWith("a")) return name;

  // Names ending in -e (Danijele, etc.) → no change
  if (lower.endsWith("e")) return name;

  // Names ending in -o (Marko, Darko, etc.) → no change
  if (lower.endsWith("o")) return name;

  // Names ending in -i → no change
  if (lower.endsWith("i")) return name;

  // Names ending in -ar → replace with -re (Petar → Petre)
  if (lower.endsWith("ar")) return name.slice(0, -2) + "re";

  // Names ending in -k → palatalization k→č + e (Novak → Novače)
  if (lower.endsWith("k")) return name.slice(0, -1) + "če";

  // Names ending in -g → palatalization g→ž + e (rare but correct)
  if (lower.endsWith("g")) return name.slice(0, -1) + "že";

  // Names ending in a hard consonant → add -e
  // (d, n, l, r, t, s, z, b, p, m, v, š, ž, č, ć, đ, f, h, j, c)
  return name + "e";
}

export function WelcomeHeader() {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const rawName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "";
  const name = locale === "sr" ? toVocative(rawName) : rawName;
  const today = format(new Date(), "EEEE, d MMMM yyyy", { locale: locale === "sr" ? srLatn : undefined });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("greetingMorning") : hour < 18 ? t("greetingAfternoon") : t("greetingEvening");

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight">
        {greeting}, {name}
      </h1>
      <p className="text-sm text-muted-foreground capitalize">{today}</p>
    </div>
  );
}
