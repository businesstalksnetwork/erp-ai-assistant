

## Dashboard Loading Skeleton + Audit `.in()` Overflow Bug

### 1. Add Loading Skeleton to KPI Cards

**File:** `src/pages/tenant/Dashboard.tsx`

Currently the KPI query has no `isLoading` state tracked, so users see "0,00 RSD" during loading. The fix:

- Destructure `isLoading: kpiLoading` from the `useQuery` for `dashboard-kpi-summary`
- When `kpiLoading` is true, render 4 skeleton cards (using the existing `Skeleton` component) instead of the KPI values
- Each skeleton card will match the KPI card layout: skeleton for the label, icon placeholder, and a shimmer bar for the value

**Skeleton card layout:**
```
Card with border-t-2:
  CardHeader: Skeleton(h-3 w-20) + Skeleton(h-8 w-8 rounded-md)
  CardContent: Skeleton(h-7 w-32)
```

### 2. Audit of `.in()` with Large ID Arrays

After reviewing all 36 files containing `.in()` calls across the codebase, here is the assessment:

**Safe - small/bounded arrays (no fix needed):**
- `.in("status", [...])` -- 2-4 status strings (AgingReports, BankStatements, Dashboard, SalesPerformance, AiBottleneckPrediction, etc.)
- `.in("type", [...])` -- 2-3 type strings (PurchaseOrders, SupplierInvoices, SalesChannels)
- `.in("account.account_type", [...])` -- filter via JOIN, not ID array (BalanceSheet, IncomeStatement)
- `.in("id", userIds)` -- Users/AuditLog/OpportunityDetail fetch profiles for visible page rows (max ~50 IDs)
- `.in("partner_id", selectedPartnerIds)` -- Meetings, user-selected (tiny array)
- `.in("bin_id", binIds)` -- WmsCycleCounts, filtered by single zone (small)
- `.in("request_id", ids)` -- PendingApprovals, page-sized results
- `.in("bom_template_id", bomIds)` -- AiBottleneckPrediction, bounded by active production orders
- `.in("goods_receipt_id", grIds)` -- SupplierInvoices, bounded by single PO

**Potentially dangerous - needs fix:**

| File | Issue | Risk |
|------|-------|------|
| `YearEndClosing.tsx` (line 76) | `.in("account_id", accountIds)` on `journal_lines` -- fetches ALL journal lines for ALL revenue+expense accounts without tenant filter on the lines query | Medium-High: account IDs are bounded (~50-100 typical), but the query returns ALL journal lines across ALL tenants for those accounts, which could be massive. Also has no tenant filter on journal_lines itself. |

### 3. Fix `YearEndClosing.tsx`

Replace the multi-step query (fetch account IDs, then `.in()` on journal_lines) with a single query using an `!inner` JOIN pattern, same as BalanceSheet and IncomeStatement already do correctly:

```typescript
const { data: lines } = await supabase
  .from("journal_lines")
  .select(`
    account_id, debit, credit,
    account:chart_of_accounts!inner(id, code, name, account_type),
    journal_entry:journal_entries!inner(tenant_id, status, entry_date)
  `)
  .eq("journal_entry.tenant_id", tenantId)
  .eq("journal_entry.status", "posted")
  .in("account.account_type", ["revenue", "expense"])
  .gte("journal_entry.entry_date", selectedPeriod.start_date)
  .lte("journal_entry.entry_date", selectedPeriod.end_date);
```

This eliminates the separate account fetch, the `.in()` with account IDs, and the client-side JS filtering -- all in one query with proper server-side JOINs and filters.

### Files Changed

| File | Change |
|------|--------|
| `src/pages/tenant/Dashboard.tsx` | Add `isLoading` to KPI query, render skeleton cards when loading |
| `src/pages/tenant/YearEndClosing.tsx` | Replace `.in("account_id", accountIds)` with `!inner` JOIN pattern |

