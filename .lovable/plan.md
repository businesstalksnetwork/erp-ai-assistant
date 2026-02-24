

# Fix: AI Insights Always in Serbian

## Problem
The AI insights edge function already generates bilingual text (Serbian/English) based on the `language` parameter. However, the **cache table (`ai_insights_cache`) doesn't store or filter by language**. This means:
1. First user loads insights in English -- they get cached
2. Serbian user loads the same page -- gets cached English results
3. Only after cache expires do they see Serbian

The screenshots confirm this: badge labels ("Kritican", "Upozorenje", "Informacija") are translated client-side, but insight titles and descriptions come from the server in English.

## Solution

### 1. Add `language` column to `ai_insights_cache` (Migration)
- Add a `language varchar(5) DEFAULT 'en'` column to `ai_insights_cache`
- Update the cache index to include language

### 2. Update `ai-insights` edge function
- **Cache read** (line ~198): Add `.eq("language", language || "en")` to the cache query
- **Cache write** (line ~710): Delete only matching language rows: `.eq("language", language || "en")` and include `language` in each inserted row
- This allows both English and Serbian caches to coexist independently

### 3. Redeploy the edge function

## Files Changed
| File | Change |
|------|--------|
| New migration SQL | Add `language` column to `ai_insights_cache` |
| `supabase/functions/ai-insights/index.ts` | Filter cache by language on read/write |

## Impact
- Existing cached English insights will remain but won't be served to Serbian users (they'll get a fresh generation)
- Both language versions cache independently with their own expiry
- No UI changes needed -- the widgets already pass `locale` correctly

