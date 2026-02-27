

## Remove Unnecessary `as any` Casts

### Problem
5,241 `as any` casts across 229 files. The Supabase types file (`types.ts`, 21,290 lines) already contains all the tables and RPCs referenced in the codebase. These casts were added before types were regenerated and are now dead weight — they suppress type-checking and hide real bugs.

### Scope & Categories

The casts fall into these patterns:

1. **`.from("table_name" as any)`** — 520 occurrences, 33 files. All table names exist in `types.ts`. Fix: remove `as any`.

2. **`.rpc("function_name" as any, ...)`** — 65 occurrences, 10 files. All RPCs exist in `types.ts`. Fix: remove `as any`.

3. **`t("key" as any)`** — i18n keys not in the translation type. Fix: remove `as any` and ensure keys exist in translations (or widen the `t()` type).

4. **`data as any[]`** — result casts to bypass Supabase response types. Fix: remove cast, let TypeScript infer from the query.

5. **`as any` on objects** (e.g., `.update({...} as any)`) — bypassing Insert/Update types. Fix: remove cast, fix any actual type mismatches.

6. **Misc casts** — Badge variants, function params, etc. Fix case by case.

### Implementation Strategy

This is too large for a single pass. Prioritize by impact:

**Phase 1 — High-value files (33 files with `.from()` casts + 10 with `.rpc()` casts)**
Remove all `as any` from Supabase `.from()` and `.rpc()` calls. These are mechanical — just delete the cast. ~585 changes across ~35 unique files.

**Phase 2 — Data result casts (`data as any[]`, `(x as any).field`)**
Remove response-type casts and let TS infer. Fix any resulting type errors by using proper row types from the Database type.

**Phase 3 — Translation casts (`t("key" as any)`)**
Either add missing keys to the translation type or widen the `t()` function signature. Remove casts.

**Phase 4 — Remaining misc casts**
Badge variants, callback params, etc. Fix individually.

### Files (Phase 1 — `.from()` and `.rpc()` casts)

| File | Cast count |
|---|---|
| `src/pages/tenant/InventoryWriteOff.tsx` | ~10 |
| `src/pages/tenant/Opportunities.tsx` | ~6 |
| `src/pages/tenant/AopPositions.tsx` | ~5 |
| `src/pages/tenant/OpportunityStagesSettings.tsx` | ~4 |
| `src/pages/tenant/JournalEntries.tsx` | ~4 |
| `src/pages/tenant/BilansStanja.tsx` | ~3 |
| `src/pages/tenant/BilansUspeha.tsx` | ~3 |
| `src/pages/tenant/PdvPeriods.tsx` | ~3 |
| `src/pages/tenant/PostingRules.tsx` | ~2 |
| `src/pages/tenant/PayrollCategories.tsx` | ~2 |
| `src/pages/tenant/PayrollPaymentTypes.tsx` | ~2 |
| `src/pages/tenant/IosConfirmations.tsx` | ~2 |
| `src/pages/tenant/NonEmploymentIncome.tsx` | ~2 |
| `src/pages/tenant/GoodsReceipts.tsx` | ~3 |
| `src/components/opportunity/OpportunityTagsBar.tsx` | ~4 |
| `src/hooks/useDiscountApproval.ts` | ~2 |
| + ~20 more files | ~500+ |

### Risk
Low. Removing `as any` only makes TypeScript stricter. Any real type mismatches will surface as compile errors and can be fixed inline. No runtime behavior change.

### Recommendation
Given the scale (229 files), I recommend starting with Phase 1 (the 35 files with `.from()`/`.rpc()` casts) since those are the most impactful and fully mechanical. Phases 2–4 can follow in subsequent passes.

