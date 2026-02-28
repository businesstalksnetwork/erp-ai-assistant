

## Phase 1 + Phase 2 + Phase 10 Production AI — Combined Plan

### Audit Status: What's Already Fixed

**Phase 1 (8 of 10 done):**
- CR-CRIT-1 (posting rule UUID) ✅
- CR-CRIT-2 (hardcoded URLs) ✅
- CR-CRIT-3 (POS unlimited refunds) ✅
- CR-CRIT-4 (POS double VAT) ✅
- INTER-CRIT-2 (production inventory) ✅ — `complete_production_order` RPC exists
- DB-CRIT-1 (RLS USING(true)) ✅
- DB-CRIT-2 (journal_lines tenant_id) ✅
- PROD-CRIT-1 (Math.random costs) ✅

**Phase 2 (2 of 14 done):**
- CR-HIGH-1 (payroll modelCode) ✅ — uses `PAYROLL_PAYMENT`

---

### Remaining Work — 14 Items

#### Phase 1 Remaining (2 items)

**1. INTER-CRIT-1: Invoice FIFO failure silently ignored**
- `InvoiceForm.tsx` line 525-527: `catch (e) { console.warn(...) }` swallows FIFO errors
- Fix: revert invoice status to draft and throw error on FIFO failure

**2. DB-CRIT-3: No double-entry balance constraint**
- Migration: add `CONSTRAINT TRIGGER trg_check_balance` on `journal_lines` that validates `SUM(debit) = SUM(credit)` per entry
- `DEFERRABLE INITIALLY DEFERRED` so batch inserts work

#### Phase 2 Remaining (12 items)

**3. CR-HIGH-2 + INTER-HIGH-3: Credit note fallback doesn't reverse DR/CR**
- `InvoiceForm.tsx` line 469-495: always debits receivables regardless of invoice type
- Fix: check `values.invoiceType === "credit_note"` and swap debit/credit on all lines

**4. CR-HIGH-3: JSON.stringify on p_lines**
- `journalUtils.ts` line 148: `p_lines: JSON.stringify(resolvedLines)` — double-encodes
- Fix: pass raw array `p_lines: resolvedLines`

**5. CR-HIGH-4: POS salespeople missing location filter**
- `PosTerminal.tsx` line 82-85: no `.eq("location_id", ...)` on salespeople query
- Fix: add `.eq("location_id", activeSession?.location_id)`

**6. CR-HIGH-5: XML injection in POPDV**
- `popdvAggregation.ts` lines 343-344: raw interpolation of `meta.pib`, `meta.companyName`
- Fix: add `escapeXml()` helper and apply to all interpolated values

**7. CR-HIGH-6: Leave approval no permission guard**
- `LeaveRequests.tsx`: any user can approve/reject
- Fix: add `usePermissions()` check around approve/reject buttons

**8. INTER-HIGH-1: WMS doesn't sync main inventory**
- `WmsReceiving.tsx` / `WmsPicking.tsx`: bin stock updated but `products.current_stock` untouched
- Fix: create `update_product_stock_from_wms` RPC, call after receive/pick completion

**9. INTER-HIGH-2: Cancellation flows don't reverse**
- Invoice/POS cancellation only changes status, no reversing journal or stock return
- Fix: wire existing `storno_journal_entry` RPC into cancellation flows, add FIFO stock reversal

**10. WMS-HIGH-1: Short-pick silently completes**
- `WmsPicking.tsx`: no backorder creation when picked < required
- Fix: detect short-picks, create backorder `wms_tasks` with remaining quantities

**11. WMS-HIGH-2: Slotting moves quantity: 0**
- `WmsSlotting.tsx` line 112: hardcoded `quantity: 0` on move inserts
- Fix: pull actual quantity from `wms_bin_stock` for the product/bin

**12. WMS-HIGH-3: binStockCounts ignores zone filter**
- WMS pages: zone dropdown exists but query doesn't filter
- Fix: add `.eq("warehouse_bins.zone", selectedZone)` when zone selected

**13. PROD-HIGH-1: BOM line history deleted on edit**
- BOM editing does DELETE + INSERT with no audit trail
- Fix: soft-version with `superseded_at` column

**14. PROD-HIGH-2: MRP auto-PO sets unit_price: 0**
- `MrpEngine.tsx` line 138: `unit_price: 0`
- Fix: pull `default_purchase_price` from products table

#### Phase 10 — Production AI (from audit doc, 4 items)

**15. PROD-AI-1: Work Centers & Equipment tables**
- Migration: create `work_centers` and `equipment` tables with RLS
- Basic CRUD pages

**16. PROD-AI-2: OEE Dashboard**
- OEE = Availability × Performance × Quality per work center
- Traffic-light indicators, real-time dashboard

**17. PROD-AI-8: Fix capacity simulation hallucination**
- Current simulation uses AI for both baseline AND scenario data
- Fix: pull real capacity/demand data, use AI only for what-if projections

**18. PROD-AI-12: Quality Control Gating**
- `qc_checkpoints` table for inspection between production stages
- Block progression until QC passes

---

### Technical Details

| # | Files Modified | Type |
|---|---------------|------|
| 1 | `InvoiceForm.tsx` | Bug fix |
| 2 | New migration SQL | DB constraint |
| 3 | `InvoiceForm.tsx` | Bug fix |
| 4 | `journalUtils.ts` | Bug fix |
| 5 | `PosTerminal.tsx` | Bug fix |
| 6 | `popdvAggregation.ts` | Security fix |
| 7 | `LeaveRequests.tsx` | Security fix |
| 8 | New migration + `WmsReceiving.tsx`, `WmsPicking.tsx` | Integration fix |
| 9 | `InvoiceForm.tsx`, `PosTerminal.tsx` | Integration fix |
| 10 | `WmsPicking.tsx` | Bug fix |
| 11 | `WmsSlotting.tsx` | Bug fix |
| 12 | WMS pages | Bug fix |
| 13 | BOM component + migration | Schema change |
| 14 | `MrpEngine.tsx` | Bug fix |
| 15-18 | New migrations, new pages, edge function updates | New features |

### Execution Order
1. Phase 1 critical: FIFO error handling + balance constraint (items 1-2)
2. Phase 2 accounting: Credit note reversal, p_lines fix (items 3-4)
3. Phase 2 security: POS location, XML injection, leave permissions (items 5-7)
4. Phase 2 integration: WMS sync, cancellation reversal (items 8-9)
5. Phase 2 WMS: Short-pick, slotting qty, zone filter (items 10-12)
6. Phase 2 production: BOM versioning, MRP pricing (items 13-14)
7. Phase 10: Work centers + equipment + OEE + QC gating (items 15-18)

