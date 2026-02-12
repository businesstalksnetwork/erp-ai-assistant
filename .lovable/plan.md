
# Phase: Accounting Kernel Hardening - Wire Legal Entity Scoping into UI

## Overview

The database-level hardening is already fully implemented (immutability triggers, fiscal+PDV period interlock, year-end closing RPC, legal_entity_id columns + indexes). What remains is wiring `legal_entity_id` into all accounting UI pages so users can scope their transactions to specific legal entities (PIBs), and ensuring the frontend properly handles the DB-enforced constraints.

## Current State

**Already Done (DB level):**
- `block_posted_journal_mutation` trigger -- immutability enforced
- `block_posted_journal_lines_mutation` trigger -- line immutability enforced
- `check_fiscal_period_open` function -- fiscal + PDV interlock
- `perform_year_end_closing` RPC -- year-end closing procedure
- `legal_entity_id` columns on journal_entries, invoices, supplier_invoices, pdv_periods
- `source` column on journal_entries for auto-generated tracking

**Missing (UI level):**
- No legal entity selector on Journal Entries create form
- No legal entity selector on Invoice Form
- No legal entity selector on Supplier Invoices create form
- No legal entity selector on PDV Periods create form
- No legal entity filter on list pages (journal entries, invoices, supplier invoices, PDV)
- `journalUtils.ts` doesn't pass legal_entity_id
- Year-end closing doesn't scope by legal entity
- Fiscal period check doesn't consider legal entity

---

## Implementation

### 1. Shared Legal Entity Selector Hook

Create a reusable hook `useLegalEntities` that fetches legal entities for the current tenant, used across all accounting forms.

**New file: `src/hooks/useLegalEntities.ts`**
- Fetches from `legal_entities` table filtered by tenant_id
- Returns `{ entities, isLoading }`
- Caches with React Query key `["legal_entities", tenantId]`

### 2. Journal Entries Page

**Modify: `src/pages/tenant/JournalEntries.tsx`**
- Add legal entity selector in the create dialog (optional field)
- Pass `legal_entity_id` in the insert payload
- Add legal entity filter dropdown on the list page
- Show legal entity name column in the table (join via query)
- Update the view detail dialog to show legal entity

### 3. Invoice Form

**Modify: `src/pages/tenant/InvoiceForm.tsx`**
- Add legal entity selector in the invoice header section
- Pass `legal_entity_id` in the save mutation payload
- Pre-select the tenant's primary legal entity if only one exists

### 4. Invoices List

**Modify: `src/pages/tenant/Invoices.tsx`**
- Add legal entity filter dropdown alongside status filter
- Show legal entity column in the table

### 5. Supplier Invoices

**Modify: `src/pages/tenant/SupplierInvoices.tsx`**
- Add legal entity selector in the create/edit form
- Pass `legal_entity_id` in insert/update payloads
- Add legal entity filter on the list
- Show legal entity column in the table

### 6. PDV Periods

**Modify: `src/pages/tenant/PdvPeriods.tsx`**
- Add legal entity selector in the create dialog
- Pass `legal_entity_id` in insert payload
- Show legal entity column in the periods table
- Filter PDV periods by legal entity

### 7. Journal Utilities

**Modify: `src/lib/journalUtils.ts`**
- Add optional `legalEntityId` parameter to `createCodeBasedJournalEntry`
- Pass it through to the journal_entries insert

### 8. Year-End Closing

**Modify: `src/pages/tenant/YearEndClosing.tsx`**
- Add optional legal entity filter to scope the preview and closing to a specific legal entity
- Pass `legal_entity_id` to the closing journal entry (update the RPC or handle client-side)

### 9. Translations

**Modify: `src/i18n/translations.ts`**
- Add keys: `legalEntity`, `allLegalEntities`, `selectLegalEntity`, `legalEntityScope` (EN + SR)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useLegalEntities.ts` | Reusable hook for fetching tenant legal entities |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/tenant/JournalEntries.tsx` | Legal entity selector in form + filter on list + column in table |
| `src/pages/tenant/InvoiceForm.tsx` | Legal entity selector in header section |
| `src/pages/tenant/Invoices.tsx` | Legal entity filter + column |
| `src/pages/tenant/SupplierInvoices.tsx` | Legal entity selector in form + filter + column |
| `src/pages/tenant/PdvPeriods.tsx` | Legal entity selector in create + filter + column |
| `src/pages/tenant/YearEndClosing.tsx` | Optional legal entity scope filter |
| `src/lib/journalUtils.ts` | Accept and pass legalEntityId parameter |
| `src/i18n/translations.ts` | Add ~5 new translation keys |

---

## Technical Details

### Legal Entity Selector Pattern

All accounting forms will use the same pattern:

```text
<Select value={legalEntityId} onValueChange={setLegalEntityId}>
  <SelectTrigger><SelectValue placeholder={t("selectLegalEntity")} /></SelectTrigger>
  <SelectContent>
    {entities.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.pib})</SelectItem>)}
  </SelectContent>
</Select>
```

If the tenant has only one legal entity, auto-select it and show it as read-only.

### List Page Filter Pattern

```text
Filter bar: [Search] [Status] [Legal Entity]
Legal entity filter value "all" shows all, specific ID filters the query.
Query adds: .eq("legal_entity_id", selectedEntityId) when not "all"
```

### journalUtils Enhancement

```text
createCodeBasedJournalEntry({
  ...existing params,
  legalEntityId?: string  // NEW - optional
})
-> passes legal_entity_id in the journal_entries insert
```

### Year-End Closing Scoping

The existing `perform_year_end_closing` RPC doesn't filter by legal entity. The UI will add a legal entity selector that, when set, filters the preview calculations. The closing RPC itself operates at tenant level (all legal entities), which is correct for year-end -- the filter is for preview/reporting only.
