

## Phase 3: Module Integration & Engine Consistency — 8 Items

### Findings

| # | Finding | Impact |
|---|---------|--------|
| 3.1 | 3 pages bypass posting rules engine — `InventoryStockTake.tsx`, `InventoryWriteOff.tsx`, `Otpremnina.tsx` call raw `createCodeBasedJournalEntry` instead of `postWithRuleOrFallback` | Tenant-configured GL overrides ignored; inconsistent posting behavior |
| 3.2 | Fiscal period check only enforced in `JournalEntries.tsx` — all other 15+ posting touchpoints skip it | Users can post to closed/locked fiscal periods from any module |
| 3.3 | `GoodsReceipts.tsx` uses client-side loop for `adjust_inventory_stock` (same pattern fixed in POS in Phase 1) — partial failures leave phantom stock | Data inconsistency on network failure mid-loop |
| 3.4 | `Returns.tsx` calls `adjust_inventory_stock` in a client-side loop + up to 4 separate `postWithRuleOrFallback` calls — not atomic | COGS reversal, credit note, supplier return, and restock can partially fail |
| 3.5 | `CreditDebitNotes.tsx` calls `adjust_inventory_stock` per line in a loop — same non-atomic pattern | Partial stock adjustments on failure |
| 3.6 | No audit log entries created for GL postings — `audit_log` table exists but posting actions don't write to it | No trail for posted journal entries from sub-modules |
| 3.7 | `partner.default_receivable_account` and `default_payable_account` fields exist but are never used in posting rule dynamic resolution | Partner-specific GL mapping ignored; all partners use hardcoded 2040/4350 |
| 3.8 | Missing payment model codes for new pages — `InventoryStockTake`, `InventoryWriteOff`, `Otpremnina` have no `payment_models` entries | Cannot configure posting rules for these transaction types |

### Implementation Plan

#### 3.1: Migrate 3 pages to `postWithRuleOrFallback`
- `InventoryStockTake.tsx`: replace `createCodeBasedJournalEntry` with `postWithRuleOrFallback` using model code `STOCK_TAKE_SHORTAGE` / `STOCK_TAKE_SURPLUS`
- `InventoryWriteOff.tsx`: use model code `INVENTORY_WRITE_OFF`
- `Otpremnina.tsx`: use model code `SEVERANCE_PAYMENT`

#### 3.2: Enforce fiscal period check in `postWithRuleOrFallback`
- Add `checkFiscalPeriodOpen(tenantId, entryDate)` call inside `postWithRuleOrFallback` before creating the journal entry
- All 24+ callers automatically get fiscal period enforcement

#### 3.3: Create `complete_goods_receipt` atomic RPC
- Migration: new function that receives receipt ID, atomically confirms lines, adjusts inventory with `FOR UPDATE`, and creates GL entry
- Refactor `GoodsReceipts.tsx` to call single RPC instead of client-side loop

#### 3.4: Create `process_return` atomic RPC
- Migration: new function that atomically handles restock + up to 4 GL entries in a single transaction
- Refactor `Returns.tsx` to call single RPC

#### 3.5: Create `process_credit_debit_note` atomic RPC
- Migration: new function for atomic stock adjustment + GL posting per credit/debit note
- Refactor `CreditDebitNotes.tsx`

#### 3.6: Add audit logging to `postWithRuleOrFallback`
- After successful journal creation, insert into `audit_log` with `action: 'gl_post'`, `entity_type` from model code, and `entity_id` as the journal entry ID

#### 3.7: Wire partner default accounts to posting context
- In posting consumers that have a `partner_id`: look up `partners.default_receivable_account` and `default_payable_account`
- Pass them as `partnerReceivableCode` / `partnerPayableCode` in the `DynamicContext`
- Falls back to hardcoded "2040"/"4350" if partner fields are null

#### 3.8: Seed new payment model codes
- Migration: INSERT INTO `payment_models` for `STOCK_TAKE_SHORTAGE`, `STOCK_TAKE_SURPLUS`, `INVENTORY_WRITE_OFF`, `SEVERANCE_PAYMENT`

### Files Modified

| File | Change |
|------|--------|
| New migration SQL | 3.3 (`complete_goods_receipt` RPC), 3.4 (`process_return` RPC), 3.5 (`process_credit_debit_note` RPC), 3.8 (payment model seeds) |
| `src/lib/postingHelper.ts` | 3.2 (fiscal period check), 3.6 (audit log insert) |
| `src/pages/tenant/InventoryStockTake.tsx` | 3.1 — migrate to `postWithRuleOrFallback` |
| `src/pages/tenant/InventoryWriteOff.tsx` | 3.1 — migrate to `postWithRuleOrFallback` |
| `src/pages/tenant/Otpremnina.tsx` | 3.1 — migrate to `postWithRuleOrFallback` |
| `src/pages/tenant/GoodsReceipts.tsx` | 3.3 — call `complete_goods_receipt` RPC |
| `src/pages/tenant/Returns.tsx` | 3.4 — call `process_return` RPC |
| `src/pages/tenant/CreditDebitNotes.tsx` | 3.5 — call `process_credit_debit_note` RPC |
| `src/lib/postingRuleEngine.ts` | 3.7 — accept partner GL codes in DynamicContext |

### Execution Order
1. Migration: RPCs (3.3, 3.4, 3.5) + payment model seeds (3.8)
2. `postingHelper.ts` enhancements (3.2 fiscal check + 3.6 audit log)
3. Frontend refactors: 3.1 (3 pages), 3.3 (GoodsReceipts), 3.4 (Returns), 3.5 (CreditDebitNotes)
4. Partner account wiring (3.7)

