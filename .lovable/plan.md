

# Fix All Build Errors - Cleanup Plan

The build is broken because 4 Pausal Box files reference non-existent database tables, and `AppLayout.tsx` uses a wrong hook signature. Here's exactly what needs to happen:

---

## 1. Delete 4 Pausal Box files

These reference tables (`email_notification_log`, `email_templates`, `kpo_entries`) that don't exist in the CRM database:

- `src/components/BulkEmailDialog.tsx`
- `src/components/EmailTemplateEditor.tsx`  
- `src/components/KPOCsvImport.tsx`
- `src/hooks/useAdminAnalytics.ts`

---

## 2. Fix `AppLayout.tsx` (line 85)

**Problem**: Destructures `upcomingCount`, `hasPermission`, `canRequest`, `requestPermission` from `useNotifications()` -- none of these exist. Also passes an argument when the hook takes none.

**Fix**:
- Change line 85 to: `const { unreadCount } = useNotifications();`
- Remove the `useEffect` block (lines 92-96) calling `requestPermission`
- Replace all 3 occurrences of `upcomingCount` with `unreadCount` (lines 282, 299, 403)

---

## 3. Fix `AdminPanel.tsx` -- remove deleted imports and usages

- Remove import of `EmailTemplateEditor` (line 47)
- Remove import of `BulkEmailDialog` (line 60)
- Remove the `bulkEmailConfirmOpen` state and `isSendingBulkEmail` state (lines 105-106)
- Remove the Email Templates tab content (lines 1522-1538) -- replace `<EmailTemplateEditor />` with a placeholder or remove the tab
- Remove the `<BulkEmailDialog>` component usage (lines 1724-1766)
- Remove the bulk email button that opens the dialog (lines 912-916)

---

## 4. Fix `KPOBook.tsx` -- remove KPOCsvImport usage

- Remove import of `KPOCsvImport` (line 41)
- Remove `<KPOCsvImport>` component usage (lines 367-373)
- Remove the `importDialogOpen` state and the Upload button that opens it

---

## 5. Fix `AdminAnalytics.tsx` -- remove useAdminAnalytics dependency

- Remove import of `useAdminAnalytics` (line 2)
- Replace the hook call (line 111) with empty/placeholder data so the page renders without errors (show an "Analytics coming soon" message or stub the data)

---

## 6. Add `hover` color variants to `tailwind.config.ts`

The CSS variables `--primary-hover` and `--secondary-hover` are defined in `index.css` but not registered in the Tailwind config, which may cause issues with utility classes. Add:

```
primary: {
  DEFAULT: "hsl(var(--primary))",
  foreground: "hsl(var(--primary-foreground))",
  hover: "hsl(var(--primary-hover))",
},
secondary: {
  DEFAULT: "hsl(var(--secondary))",
  foreground: "hsl(var(--secondary-foreground))",
  hover: "hsl(var(--secondary-hover))",
},
```

---

## 7. Fix edge function import

**File**: `supabase/functions/delete-user/index.ts` line 1

Change `'npm:@supabase/supabase-js@2.89.0'` to `'https://esm.sh/@supabase/supabase-js@2'` to match the pattern used by all other edge functions.

---

## Expected Result

All build errors resolved. Preview loads. No Pausal Box code remains.

