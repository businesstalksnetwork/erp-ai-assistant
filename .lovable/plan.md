
# V3.1 Audit — All 36 CR Bug Fixes: COMPLETED

## Status: ✅ ALL BATCHES COMPLETE

### Batch 1: Critical Security ✅
- CR-06/CR-07: SEF webhook fail-closed auth + removed UUID enumeration
- CR-14: NBS cron auth fail-closed
- CR-13/CR-16: CROSO switched to service role key + .maybeSingle()
- CR-24: Delete mutations scoped by tenant_id
- CR-17: generate-payment-orders JWT auth added

### Batch 2: Data Integrity ✅
- CR-08/CR-09: Production waste operator precedence fixed
- CR-11/CR-12: TaxLossCarryforward local state + debounced saves
- CR-14: DeferredTax Math.abs() removed, signed DTA/DTL preserved
- CR-13: IntercompanyEliminations GL posting path added
- CR-23/CR-28: ThinCapitalization stale closure fixed + equity=0 handled
- CR-25/CR-26: VatProRata stale closure + queryKey fixed
- CR-05: compliance-checker tenant_id_param added to all 7 RPC calls
- CR-04: Payroll RPC duplicate employer columns fixed

### Batch 3: High Priority ✅
- CR-10: Serbian law article references corrected
- CR-21: MultiPeriodReports Class 2 moved to liabilities
- CR-22/CR-29: Supplier payment account 2100→2200
- CR-34: CapitalGoods pro-rata inputs bounded 0-1
- CR-36: foreignPerDiemRates regulation year updated to 2024
- CR-35: Duplicate MobileFilterBar removed from Invoices
- CR-31/CR-32: CROSO XML namespace + missing tags fixed
- CR-33: generate-apr-xml builder chaining bug fixed

### Batch 4: DB Migrations ✅
- CR-01: execute_readonly_query hardened (system schema block, UNION block, LIMIT 100)
- CR-02: Invoice double-post trigger blocks NULL-clearing
- CR-15c: 6 RLS policies optimized to use get_user_tenant_ids()
- CR-28b: thin_capitalization debt_equity_ratio returns NULL when equity=0
- CR-30: UUID validation added for vatAccount.id in compliance-checker

### Edge Functions Deployed ✅
All 7 modified edge functions redeployed:
sef-webhook, nbs-daily-cron, generate-croso-xml, generate-apr-xml,
generate-payment-orders, sef-send-invoice, compliance-checker
