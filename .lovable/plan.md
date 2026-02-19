
# Fix: Map All 53 Unmapped Files

## What I Found by Analyzing the Actual ZIP Data

I called the edge function directly with the Uniprom ZIP and read every file in the 13,000-line response. Here is the exact breakdown of the 53 "unmapped" files:

### Group 1: Files Mapped to WRONG Target (need correction)

| File | Current (wrong) | Should Be | Rows | Reason |
|---|---|---|---|---|
| `dbo.PartnerContact.csv` | partners | **contacts** | 11,586 | col_1=ID, col_2=LastName, col_3=FirstName — it IS the contacts table |
| `dbo.PartnerLocation.csv` | partners | **locations** | 10,516 | Has partner codes + address data — partner delivery/billing addresses |
| `dbo.Partner.csv` | partners (medium) | **partners (high)** | 10,492 | Is the newer English-named partners table — should be exact |
| `dbo.Item.csv` | none | **products (high)** | 3,738 | First row: "KONTAKTOR CM 12-22 220V AC" — definitively products |
| `dbo.Department.csv` | departments (medium) | **departments (high)** | 11 | "IT", "Nabava i skladiste", "Komercijala" — exact match |
| `dbo.CurrencyISO.csv` | currencies (medium) | **currencies (high)** | 178 | ISO currency table — should be high confidence |

### Group 2: Files That Must Be Auto-Skipped (currently showing as unmapped/medium)

These should be added to the `DBO_TABLE_LOOKUP` as `target: "skip"`:

| File | Rows | Reason to Skip |
|---|---|---|
| `dbo.City.csv` | 102,951 | Global city lookup — not importable |
| `dbo.AppObjectsRolesRights.csv` | 23,029 | Legacy role permissions — not importable |
| `dbo.AppObjectsUserRights.csv` | 16,051 | Legacy user permissions — not importable |
| `dbo.ItemGroups.csv` | 13,533 | Product-group junction table (FKs only) |
| `dbo.PartnerContactInteraction.csv` | 3,634 | Contains raw HTML (`<!DOCTYPE html`) — garbage data |
| `dbo.PartnerInteractionTemplates.csv` | 29 | Contains raw HTML — garbage data |
| `dbo.ProjectPartner.csv` | 376 | FK junction table (project_id, partner_id) |
| `dbo.PartnerContactParticipants.csv` | 58 | All null bytes — corrupt binary |
| `dbo.PartnerContactInteractionParticipants.csv` | 280 | All null bytes — corrupt binary |
| `dbo.Dobavljaci.csv` | 253 | All null bytes — corrupt binary |
| `dbo.ProductionOrderProperty.csv` | 385 | Production config data, no system table |
| `dbo.ProductionOrderPropertyMeta.csv` | 8 | Production config metadata |
| `dbo.PurchaseOrderStatus.csv` | 10 | Status lookup table (10 rows) |
| `dbo.EmployeePresenceLegislationType.csv` | 22 | Legislation type lookup |
| `dbo.EmployeePresenceType.csv` | 14 | Presence type lookup (RR, BL, NR codes) |
| `dbo.EmployeeForeignQualification.csv` | 428 | FK junction — employee ↔ qualification |
| `dbo.EmployeeQualification.csv` | 117 | Qualification lookup |

### Group 3: Corrupt/Binary Files — Add Null-Byte Detection

`dbo.Dobavljaci.csv`, `dbo.PartnerContactParticipants.csv`, and others contain rows filled entirely with `\u0000` (null bytes). These are SQL Server binary/blob column exports that were forced into CSV format. They should be detected and auto-skipped.

**Detection rule:** If more than 50% of cells in the first 3 rows contain `\u0000` → mark as `autoSkip: true` with `skipReason: "Binary/corrupt data detected (null bytes)"`.

## What This Achieves

After these changes, the UI summary will improve to approximately:
- **3 exact** (same)
- **~15 high** (up from 7 — adding Item, Partner, Department, CurrencyISO, PartnerContact as contacts)
- **~5 medium** (down from 12 — better classification)
- **~523 auto-skipped** (up from 506 — the 17 misclassified files move here)
- **~35 unmapped** (down from 53 — mostly empty zero-row tables)

The important thing: zero business-data files remain unmapped.

## Files to Modify

### 1. `supabase/functions/analyze-legacy-zip/index.ts`

**A. Add entries to `DBO_TABLE_LOOKUP`:**

```typescript
// English-named tables (newer schema in Uniprom)
"Item":                    { target: "products",   confidence: "high",  label: "Item = product catalog (English table name)", dedupField: "sku" },
"Partner":                 { target: "partners",   confidence: "high",  label: "Partner = business partner (English table name)", dedupField: "pib" },
"PartnerContact":          { target: "contacts",   confidence: "high",  label: "PartnerContact = contact persons linked to partners", dedupField: "email" },
"PartnerLocation":         { target: "locations",  confidence: "high",  label: "PartnerLocation = partner delivery/billing addresses", dedupField: "name" },
"Department":              { target: "departments",confidence: "high",  label: "Department = department (English table name)", dedupField: "name" },
"CurrencyISO":             { target: "currencies", confidence: "high",  label: "CurrencyISO = ISO 4217 currency list", dedupField: "code" },

// Skip: legacy permission tables
"AppObjectsRolesRights":   { target: "skip", confidence: "exact", label: "Legacy role permissions — auto-skip", skipReason: "Legacy ACL table (not imported)" },
"AppObjectsUserRights":    { target: "skip", confidence: "exact", label: "Legacy user permissions — auto-skip", skipReason: "Legacy ACL table (not imported)" },

// Skip: city/geo lookup
"City":                    { target: "skip", confidence: "exact", label: "Global city lookup — auto-skip", skipReason: "Geo lookup table (102k rows, not imported)" },

// Skip: FK junction tables
"ItemGroups":              { target: "skip", confidence: "exact", label: "Product-group junction table — auto-skip", skipReason: "FK junction table only" },
"ProjectPartner":          { target: "skip", confidence: "exact", label: "Project-partner FK junction — auto-skip", skipReason: "FK junction table only" },
"PartnerContactParticipants": { target: "skip", confidence: "exact", label: "Contact participants junction — auto-skip", skipReason: "FK junction table, corrupt data" },
"PartnerContactInteraction":  { target: "skip", confidence: "exact", label: "HTML email interaction log — auto-skip", skipReason: "Contains raw HTML content, not importable" },
"PartnerContactInteractionParticipants": { target: "skip", confidence: "exact", label: "Interaction participants — auto-skip", skipReason: "FK junction with corrupt data" },
"PartnerInteractionTemplates": { target: "skip", confidence: "exact", label: "HTML email templates — auto-skip", skipReason: "Contains raw HTML content" },

// Skip: production order config (no system table)
"ProductionOrderProperty":     { target: "skip", confidence: "exact", label: "Production order properties — auto-skip", skipReason: "Production config, no import target" },
"ProductionOrderPropertyMeta": { target: "skip", confidence: "exact", label: "Production order property metadata — auto-skip", skipReason: "Production config metadata" },

// Skip: small lookup tables
"PurchaseOrderStatus":          { target: "skip", confidence: "exact", label: "PO status lookup — auto-skip",           skipReason: "Lookup table (10 rows)" },
"EmployeePresenceLegislationType": { target: "skip", confidence: "exact", label: "Presence legislation types — auto-skip", skipReason: "Lookup table (22 rows)" },
"EmployeePresenceType":         { target: "skip", confidence: "exact", label: "Presence type lookup — auto-skip",       skipReason: "Lookup table (14 rows)" },
"EmployeeForeignQualification": { target: "skip", confidence: "exact", label: "Employee qualification junction — auto-skip", skipReason: "FK junction table" },
"EmployeeQualification":        { target: "skip", confidence: "exact", label: "Qualification lookup — auto-skip",       skipReason: "Lookup table (117 rows of qualification types)" },

// Skip: system tables
"Dobavljaci":              { target: "skip", confidence: "exact", label: "Corrupt binary data — auto-skip", skipReason: "Binary data export (all null bytes, unreadable)" },
```

**B. Add null-byte corruption detection in `classifyFile()`:**

After reading headers and sample rows, check if data is corrupt:
```typescript
// Detect binary/corrupt files: if >50% of first row cells are null bytes
const nullByteRatio = headers.filter(h => h.includes('\u0000') || h === '\u0000').length / Math.max(headers.length, 1);
if (nullByteRatio > 0.5) {
  return {
    target: null, confidence: "none", dedupField: "",
    humanLabel: "Binary/corrupt data detected (null bytes in CSV cells)",
    autoSkip: true,
    skipReason: "Binary data detected — SQL Server blob columns exported as CSV (unreadable)",
  };
}
```

**C. Expand the threshold for auto-skipping unknown dbo tables:**

Currently unknown dbo tables with ≤5 rows are auto-skipped. After reviewing the data, many lookup tables have 10-22 rows (like `PurchaseOrderStatus` with 10 rows, `EmployeePresenceType` with 14). The explicit entries in the lookup handle these — no threshold change needed.

### 2. Re-deploy `analyze-legacy-zip`

The frontend and import pipeline don't change — only the analysis metadata improves. Re-deploying the edge function is sufficient.

## Summary

| Change | Impact |
|---|---|
| Add 25 new `DBO_TABLE_LOOKUP` entries | 53 unmapped → ~35 or fewer (mostly zero-row tables) |
| `dbo.Item.csv` → products (high) | 3,738 more products available to import |
| `dbo.PartnerContact.csv` → contacts (high) | 11,586 contacts correctly targeted |
| `dbo.PartnerLocation.csv` → locations (high) | 10,516 addresses correctly targeted |
| `dbo.Partner.csv` → partners (high) | 10,492 partners with higher confidence |
| Null-byte detector | Corrupt files auto-skipped cleanly |
| 17 misclassified files → auto-skip | Cleaner review screen, no false positives |
