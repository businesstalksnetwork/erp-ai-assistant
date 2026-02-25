

# Phase 2: Migrate Remaining 8 Hardcoded Files to Posting Rules Engine

## Current State

Phase 1 (completed) connected `CashRegister.tsx` and `IntercompanyTransactions.tsx` to the posting rules engine via `postWithRuleOrFallback`, added 21 new payment model codes to `PAYMENT_MODEL_KEYS`, seeded them in the database, and fixed the hardcoded VAT rate.

**8 files still use hardcoded `createCodeBasedJournalEntry` with string literal account codes.**

## Files to Migrate

Each file will be refactored to use `postWithRuleOrFallback` from `src/lib/postingHelper.ts`, keeping the current hardcoded accounts as fallback lines. The model codes already exist in `PAYMENT_MODEL_KEYS`.

### 1. GoodsReceipts.tsx (1 posting point)
- **Trigger**: Status set to "completed"
- **Model**: `GOODS_RECEIPT`
- **Hardcoded**: DR 1200 (Inventory) / CR 2100 (AP/GRNI)
- **Change**: Replace lines 161-174 with `postWithRuleOrFallback` call

### 2. SupplierInvoices.tsx (2 posting points)
- **Approval** (lines 190-216): Model `SUPPLIER_INVOICE_POST`
  - DR 7000 (COGS) + DR 4700 (Input VAT) / CR 2100 (AP)
- **Payment** (lines 218-239): Model `SUPPLIER_INVOICE_PAYMENT`
  - DR 2100 (AP) / CR 1000 (Bank)
- **Complexity**: Approval has conditional VAT line -- `postWithRuleOrFallback` handles this via `TAX_AMOUNT` amount source with `taxRate` context

### 3. Returns.tsx (4 posting points in `postReturnAccounting`)
- **Customer return restock** (lines 196-204): Model `CUSTOMER_RETURN_RESTOCK`
  - DR 1200 / CR 7000
- **Customer credit note** (lines 209-217): Model `CUSTOMER_RETURN_CREDIT`
  - DR 4000 / CR 1200
- **Supplier return** (lines 229-236): Model `SUPPLIER_RETURN`
  - DR 2100 / CR 1200
- **Credit note issuance** (lines 308-318): Model `CREDIT_NOTE_ISSUED`
  - DR 6000 / CR 2040

### 4. Loans.tsx (2 posting points in `recordPaymentMutation`)
- **Payable** (lines 146-149): Model `LOAN_PAYMENT_PAYABLE`
  - DR 4200 (principal) + DR 5330 (interest) / CR 2431 (bank)
- **Receivable** (lines 151-154): Model `LOAN_PAYMENT_RECEIVABLE`
  - DR 2431 (bank) / CR 2040 (loan receivable) + CR 6020 (interest income)
- **Complexity**: Multi-line with different amounts per line (principal vs interest). Will use `FULL` amount source with the total payment as amount, keeping individual line amounts in fallback. The engine handles this via `amount_factor` on each rule line.

### 5. Kompenzacija.tsx (1 posting point)
- **Trigger**: Confirm compensation (line 97-106)
- **Model**: `COMPENSATION`
- **Hardcoded**: DR 4350 (AP) / CR 2040 (AR)

### 6. FixedAssets.tsx (2 posting points)
- **Depreciation** (lines 184-192): Model `ASSET_DEPRECIATION`
  - DR 5310 / CR 0121
- **Disposal** (lines 94-132): Model `ASSET_DISPOSAL`
  - DR 0121 (accum dep) + DR 2431 (sale proceeds) / CR 0120 (asset cost) + CR/DR 6072/5073 (gain/loss)
  - **Complexity**: Disposal has variable number of lines based on sale vs scrap and gain vs loss. Will keep as fallback-heavy with rule override possible.

### 7. FxRevaluation.tsx (1 posting point)
- **Trigger**: Post revaluation (lines 186-257)
- **Models**: `FX_GAIN` and `FX_LOSS`
- **Hardcoded**: DR 2040/4350 / CR 6072 (gains); DR 5072 / CR 2040/4350 (losses)
- **Complexity**: Dynamic number of lines based on AR/AP split. Will use two separate `postWithRuleOrFallback` calls (one for gains, one for losses) or keep complex logic with fallback.

### 8. Deferrals.tsx (1 posting point)
- **Trigger**: Recognize period (lines 99-149)
- **Models**: `DEFERRAL_REVENUE` and `DEFERRAL_EXPENSE`
- **Revenue**: DR 4600 / CR 6010
- **Expense**: DR 5400 / CR 1500

## Technical Approach

For each file:
1. Import `postWithRuleOrFallback` from `@/lib/postingHelper`
2. Replace `createCodeBasedJournalEntry` with `postWithRuleOrFallback`, moving current hardcoded lines into the `fallbackLines` parameter
3. Set the correct `modelCode` from `PAYMENT_MODEL_KEYS`
4. Pass `context: {}` (empty context is fine for FIXED account rules; dynamic sources not needed yet)

For complex multi-posting files (Returns, FixedAssets, FxRevaluation), each distinct journal entry call gets its own `postWithRuleOrFallback` with its own model code.

## Implementation Order

Due to message size constraints, this will be split:
- **Batch A**: GoodsReceipts, SupplierInvoices, Kompenzacija, Deferrals (simpler, 1-2 posting points each)
- **Batch B**: Returns, Loans, FixedAssets, FxRevaluation (complex, multi-line or conditional logic)

No database migration needed -- all 21 payment model codes were already seeded in Phase 1.

