

# Comprehensive Build Fix and Cleanup Plan

## Problem Summary

The app has two conflicting auth systems and dozens of dead "Pausal Box" files that are cluttering the codebase. While many of these files have `@ts-nocheck` suppressing type errors, the overall architecture is broken: the app has one auth provider mounted (`src/hooks/useAuth.tsx`) but many components import from a different, unmounted auth provider (`src/lib/auth.tsx`). The Pausal Box pages are not routed and serve no purpose.

---

## Phase 1: Identify and categorize all files

### A. Active System (CRM/ERP) -- DO NOT TOUCH
These files are used by `App.tsx` routes and work correctly:
- `src/hooks/useAuth.tsx` -- The **real** auth provider (mounted in App.tsx)
- `src/layouts/TenantLayout.tsx` -- The **real** layout (used in routes)
- `src/layouts/SuperAdminLayout.tsx` -- Used in routes
- `src/pages/Login.tsx`, `Register.tsx`, `ResetPassword.tsx`, `NotFound.tsx` -- Active public pages
- All `src/pages/tenant/*.tsx` -- Active tenant pages
- All `src/pages/super-admin/*.tsx` -- Active super admin pages
- `src/hooks/useTenant.ts`, `usePermissions.ts`, `useNotifications.ts` -- Active hooks

### B. Dead Code -- Pausal Box Pages (never imported in App.tsx)
These pages exist in `src/pages/` root but are NOT in any route:
- `src/pages/Auth.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Invoices.tsx`
- `src/pages/Clients.tsx`
- `src/pages/Documents.tsx`
- `src/pages/Profile.tsx`
- `src/pages/Reminders.tsx`
- `src/pages/ServiceCatalog.tsx`
- `src/pages/Companies.tsx`
- `src/pages/CompanyProfile.tsx`
- `src/pages/EditInvoice.tsx`
- `src/pages/NewInvoice.tsx`
- `src/pages/SEFCenter.tsx`
- `src/pages/FiscalCashRegister.tsx`
- `src/pages/Payouts.tsx`
- `src/pages/InvoiceDetail.tsx`
- `src/pages/InvoiceAnalytics.tsx`
- `src/pages/BookkeeperSettings.tsx`
- `src/pages/KPOBook.tsx`
- `src/pages/AdminPanel.tsx`
- `src/pages/AdminAnalytics.tsx`
- `src/pages/EditTemplate.tsx`
- `src/pages/VerifyEmail.tsx`
- `src/pages/Index.tsx`

### C. Dead Code -- Pausal Box Components (only used by dead pages)
- `src/components/AppLayout.tsx` (never imported anywhere)
- `src/components/BlockedUserScreen.tsx`
- `src/components/BookkeeperProfileBanner.tsx`
- `src/components/ChangePasswordDialog.tsx`
- `src/components/ClientDetailPanel.tsx`
- `src/components/CompanySelector.tsx`
- `src/components/CreateTemplateDialog.tsx`
- `src/components/DownloadPdfButton.tsx`
- `src/components/ExportButton.tsx`
- `src/components/ExtendSubscriptionDialog.tsx`
- `src/components/FiscalDeleteByDateDialog.tsx`
- `src/components/FiscalEntriesList.tsx`
- `src/components/FiscalImportDialog.tsx`
- `src/components/InviteClientDialog.tsx`
- `src/components/KPOCsvExport.tsx`
- `src/components/KPOPdfExport.tsx`
- `src/components/LimitDetailDialog.tsx`
- `src/components/NotificationBell.tsx` (the root one - tenant uses `notifications/NotificationBell.tsx`)
- `src/components/PartnerDialog.tsx`
- `src/components/PausalniPdfDialog.tsx`
- `src/components/PaymentStatusDialog.tsx`
- `src/components/PayoutDialog.tsx`
- `src/components/PrintButton.tsx`
- `src/components/SEFImportDialog.tsx`
- `src/components/SEFInvoicePreview.tsx`
- `src/components/SendInvoiceDialog.tsx`
- `src/components/ServiceCatalogDialog.tsx`
- `src/components/SubscriptionBanner.tsx`
- `src/components/TemplateActionDialog.tsx`
- `src/components/TemplatesDropdown.tsx`
- `src/components/BlockUserDialog.tsx`

### D. Dead Code -- Pausal Box Hooks (only used by dead pages)
- `src/hooks/useAppNotifications.ts`
- `src/hooks/useBookkeeper.ts`
- `src/hooks/useBookkeeperPayouts.ts`
- `src/hooks/useBookkeeperReferrals.ts`
- `src/hooks/useClients.ts`
- `src/hooks/useClientStats.ts`
- `src/hooks/useCompanies.ts`
- `src/hooks/useCompanyBookkeeper.ts`
- `src/hooks/useDocuments.ts` (the Pausal version)
- `src/hooks/useFiscalEntries.ts`
- `src/hooks/useForeignPaymentInstructions.ts`
- `src/hooks/useFormDraft.ts`
- `src/hooks/useInvoiceEmail.ts`
- `src/hooks/useInvoiceTemplates.ts`
- `src/hooks/useInvoices.ts`
- `src/hooks/useKPO.ts`
- `src/hooks/useLimitChartData.ts`
- `src/hooks/useLimits.ts`
- `src/hooks/usePartners.ts`
- `src/hooks/usePdfGenerator.ts`
- `src/hooks/usePushNotifications.ts`
- `src/hooks/useReminders.ts`
- `src/hooks/useSEF.ts`
- `src/hooks/useSEFImport.ts`
- `src/hooks/useSEFLongSync.ts`
- `src/hooks/useSEFPurchaseInvoices.ts`
- `src/hooks/useSEFRegistry.ts`
- `src/hooks/useSEFStorage.ts`
- `src/hooks/useServiceCatalog.ts`

### E. Dead Code -- Pausal Box Lib files
- `src/lib/auth.tsx` (unmounted auth provider - the CRM uses `src/hooks/useAuth.tsx`)
- `src/lib/company-context.tsx` (never mounted in App.tsx)
- `src/lib/theme-context.tsx` (never mounted in App.tsx)
- `src/lib/storage.ts` (DO Spaces storage - only used by dead hooks)
- `src/lib/domain.ts` (only used by `src/lib/auth.tsx`)
- `src/lib/exportCsv.ts` (check if used by active pages)
- `src/lib/journalUtils.ts` (check if used by active pages)
- `src/lib/ubl-parser.ts` (check if used by active pages)

---

## Phase 2: Execution Plan

### Step 1: Delete all dead Pausal Box pages (24 files)
Delete all files in `src/pages/` root that are NOT imported in `App.tsx` (listed in section B above).

### Step 2: Delete dead components (30+ files)
Delete `src/components/AppLayout.tsx` and all Pausal Box-only components listed in section C. Before deleting each component, verify it is not imported by any active (tenant/super-admin) page.

### Step 3: Delete dead hooks (29 files)
Delete all Pausal Box hooks listed in section D. Before deleting, verify each is not imported by active pages. Some hooks like `useSEFRegistry` may be used by both dead and active code (e.g., `AdminPanel.tsx` imports it but AdminPanel is dead code).

### Step 4: Delete dead lib files
- Delete `src/lib/auth.tsx` (the Pausal Box auth - NOT the active `src/hooks/useAuth.tsx`)
- Delete `src/lib/company-context.tsx`
- Delete `src/lib/theme-context.tsx`
- Delete `src/lib/storage.ts`
- Delete `src/lib/domain.ts`
- Check and potentially keep `src/lib/exportCsv.ts`, `src/lib/journalUtils.ts`, `src/lib/ubl-parser.ts` if used by active tenant pages

### Step 5: Remove `@ts-nocheck` from surviving files
For files like `src/i18n/translations.ts` and `src/pages/tenant/BilansUspeha.tsx` and `src/pages/tenant/BilansStanja.tsx` and `src/pages/tenant/PdvPeriods.tsx` that had `@ts-nocheck` added, remove it and fix any underlying type errors properly.

### Step 6: Verify build passes
Ensure the remaining active CRM/ERP code compiles cleanly without `@ts-nocheck` hacks.

---

## Technical Details

| Category | Count | Action |
|----------|-------|--------|
| Dead pages (`src/pages/*.tsx`) | ~24 | Delete |
| Dead components | ~30 | Delete |
| Dead hooks | ~29 | Delete |
| Dead lib files | ~5 | Delete |
| Files needing `@ts-nocheck` removal | ~5 | Fix types |
| Active files affected | 0 | No changes needed |

### What stays untouched
- All `src/pages/tenant/` pages (active routes)
- All `src/pages/super-admin/` pages (active routes)
- `src/hooks/useAuth.tsx` (active auth provider)
- `src/hooks/useTenant.ts` (active)
- `src/hooks/usePermissions.ts` (active)
- `src/hooks/useNotifications.ts` (active)
- `src/hooks/useOpportunityStages.ts` (active)
- `src/hooks/useLegalEntities.ts` (active)
- `src/hooks/useAiStream.ts` (active)
- `src/layouts/TenantLayout.tsx` (active)
- `src/layouts/SuperAdminLayout.tsx` (active)
- `src/App.tsx` (active)
- All `src/components/ui/` (shared UI components)
- All `src/components/ai/` (active AI components)
- All `src/components/crm/` (active CRM components)
- All `src/components/dashboard/` (active dashboard components)
- All `src/components/shared/` (active shared components)
- All `src/components/notifications/` (active)
- All `src/components/layout/` (active)
- All `src/components/opportunity/` (active)
- All edge functions (active)

### Risk assessment
- **Low risk**: All deleted files are confirmed dead code (not imported by any active route in App.tsx)
- **Verification**: Before each deletion, imports will be traced to confirm no active code depends on them
- **Rollback**: Git history preserves all deleted files

