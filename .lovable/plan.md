

# Plan: Drive + DMS Integration, Sidebar Reorganization, and DMS Settings Fix

## Summary

Three interconnected improvements: (1) reorganize sidebar to show Drive prominently below DMS, (2) connect DMS documents/files to Drive storage with organized per-tenant subfolder structure, (3) add DMS Settings as a tab in main Settings page, and fix the standalone DMS Settings route.

## Root Cause: DMS Settings Issue

The `documents/settings` route is defined after `documents/:id` in `otherRoutes.tsx` (lines 111 vs 118). While React Router v6 should handle static vs dynamic ranking correctly, there may be a module-gating issue where the `documents` module isn't enabled for the tenant, causing a redirect. The DMS Settings page code itself is correct. To make it reliably accessible, we'll also add it as a tab in the main Settings page.

## Changes

### 1. Sidebar Reorganization (`TenantLayout.tsx`)

Restructure `documentsNav` array to clearly separate Drive and DMS:
- Rename the group label from "documents" to "Documents & Drive" (with i18n)
- Ensure Drive appears first with its own section label "fileManagement"
- DMS items follow under section "registry"
- Remove `dmsSettings` from the documents nav (moved to main Settings)

### 2. Drive Default Folder Structure Enhancement (`Drive.tsx`)

Update the auto-create drive logic to create organized per-tenant subfolders matching ERP modules:

```text
Company Drive
├── Računovodstvo (Accounting)
│   ├── Fakture (Invoices)
│   ├── Izvodi (Bank Statements)
│   └── Izveštaji (Reports)
├── HR
│   ├── Ugovori (Contracts)
│   ├── Plate (Payroll)
│   └── Dokumenta zaposlenih (Employee Docs)
├── Prodaja (Sales)
│   ├── Ponude (Quotes)
│   ├── Narudžbine (Orders)
│   └── Otpremnice (Dispatch Notes)
├── Nabavka (Purchasing)
│   ├── Nabavke (Purchase Orders)
│   └── Prijemnice (Goods Receipts)
├── Projekti (Projects)
├── Opšte (General)
└── Menadžment (Management)
```

This replaces the current flat 5-folder default structure.

### 3. Connect DMS to Drive (`Documents.tsx` + `Drive.tsx`)

- Add a "View in Drive" button on DMS document detail that navigates to the corresponding Drive folder
- When DMS registers a new document, optionally link it to a `drive_file` record (via `dms_document_id` column on `drive_files`)
- Add a "DMS Documents" system folder in Drive that mirrors the DMS registry structure

**Database migration**: Add `dms_document_id` nullable column to `drive_files` table:
```sql
ALTER TABLE drive_files ADD COLUMN dms_document_id uuid REFERENCES documents(id) ON DELETE SET NULL;
CREATE INDEX idx_drive_files_dms_doc ON drive_files(dms_document_id) WHERE dms_document_id IS NOT NULL;
```

### 4. DMS Settings in Main Settings Page (`Settings.tsx`)

Add a new "DMS" section to the Settings page with a link card:
```typescript
{
  title: t("dmsSettings"),
  links: [
    { label: t("dmsSettings"), icon: FolderOpen, to: "/settings/dms" },
  ],
}
```

Also add a new settings route `/settings/dms` that renders the `DmsSettings` component.

### 5. Settings Route Addition (`settingsRoutes.tsx`)

Add:
```typescript
const DmsSettings = React.lazy(() => import("@/pages/tenant/DmsSettings"));
// ...
<Route path="settings/dms" element={<ProtectedRoute requiredModule="settings"><DmsSettings /></ProtectedRoute>} />
```

### 6. Translation Keys (`translations.ts`)

Add/update:
- `documentsAndDrive` / `Dokumenti i Drive`
- `fileManagement` / `Upravljanje fajlovima` (if not present)
- `viewInDrive` / `Prikaži u Drive-u`

## Files Changed

| File | Change |
|------|--------|
| `src/layouts/TenantLayout.tsx` | Remove `dmsSettings` from `documentsNav`, ensure Drive is first with clear sections |
| `src/pages/tenant/Drive.tsx` | Enhanced default folder structure with nested subfolders per ERP module |
| `src/pages/tenant/Settings.tsx` | Add DMS section with link to `/settings/dms` |
| `src/routes/settingsRoutes.tsx` | Add `/settings/dms` route pointing to DmsSettings |
| `src/routes/otherRoutes.tsx` | Keep `documents/settings` route for backward compat |
| `src/i18n/translations.ts` | Add new translation keys |
| `supabase/migrations/...` | Add `dms_document_id` column to `drive_files` |

