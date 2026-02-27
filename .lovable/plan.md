

## Backlog Audit — Updated Status

### Already Implemented (5 items — close immediately)

| # | Task | Evidence |
|---|------|----------|
| v2.2 #18 | Sidebar memoization | `CollapsibleNavGroup` wrapped in `React.memo` in TenantLayout.tsx |
| v2.2 #20 | Lazy-load analytics charts | All analytics pages use `React.lazy` in otherRoutes.tsx |
| v2.3 #7 | Cash flow investing/financing | 3-section layout in `CashFlowStatement.tsx` |
| v2.3 #8 | Consolidation elimination logic | IC eliminations in `ConsolidatedStatements.tsx` |
| v2.3 #18 | Discount approval workflow | `useDiscountApproval` hook wired into Quotes + PendingApprovals |

### Round 1 — Frontend Quality ✅ DONE

- **v2.2 #5-6**: Settings hub aligned with sidebar — added tenantProfile, integrationHealth, dataRetention, securityIncidents cards
- **v2.2 #10-11**: InvoiceForm (1003→~990 lines) + SupplierInvoiceForm (676→~660 lines) migrated to `useForm` + Zod + `useFieldArray`
  - Created `src/lib/invoiceSchema.ts` with Zod schemas for both forms
  - Replaced ~20 useState → single `useForm<InvoiceFormValues>()` per form
  - Line items managed via `useFieldArray` with proper `calcInvoiceLine` / `calcSupplierInvoiceLine` recalc on update

### Remaining: 5 Items → 3 Rounds

**Round 2 — ResponsiveTable Migration (~10 hr)**
- **v2.2 #15-16**: Migrate ~19 list pages from raw `<Table>` to `<ResponsiveTable>` with sorting, export, column toggle

**Round 3 — IFRS Modules (~14 hr)**
- **v2.3 #12**: IFRS 16 lease enhancements — modification/reassessment, short-term exemptions, disclosure report, maturity analysis
- **v2.3 #13**: IFRS 15 revenue recognition — new module with 5-step model, contract-based deferred revenue, percentage-of-completion

**Round 4 — Supply Chain Intelligence (~8 hr)**
- **v2.3 #19**: Supplier evaluation — weighted scoring (quality/delivery/price), trend charts, comparison dashboard
- **v2.3 #20**: Demand forecasting — moving average + seasonal decomposition from sales history, reorder point suggestions

### Recommended Order
```text
Round 2: ResponsiveTable batch migration               ~10 hr
Round 3: IFRS 16 + IFRS 15 modules                    ~14 hr
Round 4: Supplier evaluation + Demand forecasting       ~8 hr
                                                Total: ~32 hr
```

Ready to start Round 2 on approval.
