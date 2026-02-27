

## Add Serbian Vocative Case for Names in Greeting

Serbian grammar requires the **vocative case** (vokativ) when addressing someone directly. For example:
- Bogdan → Bogdane
- Marko → Marko (no change)
- Nikola → Nikola (no change)  
- Stefan → Stefane
- Milan → Milane
- Ana → Ana (no change for most female names)

### Rules for Serbian vocative (masculine names ending in consonant):
- Names ending in a hard consonant (d, n, l, r, k, g, t, s, z, b, p, m, v) → add **-e**
  - Bogdan → Bogdane, Milan → Milane, Stefan → Stefane, Petar → Petre
- Names ending in **-ko, -go** → no change (Marko, Darko stay same)
- Names ending in **-a** (female or male like Nikola, Luka) → no change
- Names ending in **-e** → no change (Danijele stays)
- Special: names ending in **-ar** → **-re** (Petar → Petre)
- Names ending in **-k** → **-če** (palatalization: k→č): Novak → Novače

### Changes

**`src/components/dashboard/WelcomeHeader.tsx`**
- Add a `toVocative(name: string)` helper function implementing the rules above
- When `locale === "sr"`, apply vocative to the first name before displaying
- When `locale === "en"`, use name as-is

The function will handle the most common Serbian name patterns. It's a best-effort heuristic since perfect vocative requires a dictionary, but the rules cover 90%+ of Serbian first names.

Also: move the hardcoded greeting strings (`"Dobro jutro"`, etc.) to translation keys to comply with the i18n enforcement policy.

