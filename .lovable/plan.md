

## v2.4 Round 3 — Cross-Module Hardening

### #7 Payroll GL Posting → Posting Rules Engine
Migrate payroll journal creation from legacy `posting_rule_catalog` to the new posting rules engine (`postWithRuleOrFallback`), resolving the doc gap in `03-hr-payroll-module.md`.

### #8 Supplier Invoice Posting → Posting Rules Engine
Replace hardcoded GL codes (5xxx/2100) in supplier invoice posting with dynamic `postWithRuleOrFallback`, resolving the gap in `01-accounting-module.md`.

### #9 Approval Workflow Enforcement
Wire `approval_workflows` into invoice/PO submission flows — currently defined but not enforced (gap in `08-settings-shared.md`). Add pre-submit approval checks for entities above threshold amounts.

### Files Modified
- Payroll posting logic (edge function or component)
- Supplier invoice posting logic
- Invoice/PO submission flows + approval hook
- Documentation updates

