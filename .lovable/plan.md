

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

### Round 2 — ResponsiveTable Migration ✅ DONE

- **v2.2 #15-16**: Migrated 16 list pages from raw `<Table>` to `<ResponsiveTable>` with sorting, export, column toggle
  - Batch 1 (10 pages): ReportSnapshots, InventoryMovements, InventoryCostLayers, FixedAssets, QualityControl, ApprovalWorkflows, SalesChannels, Nivelacija, PayrollCategories, OpportunityStagesSettings
  - Batch 2 (6 pages): SecurityIncidents, ProductionOrders, EBolovanje, CashRegister, WmsLabor, AssetReports

### Round 3 — IFRS Modules ✅ DONE

- **v2.3 #12**: IFRS 16 lease enhancements
  - Modification/reassessment dialog in LeaseContractDetail with full schedule recalculation
  - Short-term and low-value exemption checkboxes on LeaseContractForm
  - `LeaseDisclosure.tsx` — full IFRS 16 disclosure report with maturity analysis (5 time buckets), P&L impact, liability reconciliation, modifications log
  - `lease_modifications` DB table for audit trail
  - Sidebar nav: disclosure link added to assets section

- **v2.3 #13**: IFRS 15 revenue recognition — NEW MODULE
  - DB tables: `revenue_contracts`, `revenue_performance_obligations`, `revenue_recognition_entries`
  - `RevenueContracts.tsx` — list page with ResponsiveTable
  - `RevenueContractForm.tsx` — 5-step model (identify contract, identify POs, determine price, allocate via relative SSP, recognize method selection)
  - `RevenueContractDetail.tsx` — KPIs (transaction price, recognized, deferred, % complete), PO table with progress bars, recognition dialog with cost-to-cost support, recognition history journal
  - GL posting via `postWithRuleOrFallback` (IFRS15_REVENUE model code)
  - Routes added to accountingRoutes.tsx, sidebar nav under "IFRS Modules" section

### Round 4 — Supply Chain Intelligence ✅ DONE

- **v2.3 #19**: Supplier evaluation — weighted scoring (quality/delivery/price/service) with configurable weights, radar chart, comparison bar chart, trend lines, ranking table
- **v2.3 #20**: Demand forecasting — moving average + seasonal decomposition from invoice sales history, reorder point & safety stock calculations, forecast chart with 3-month projection

### All backlog items complete.
