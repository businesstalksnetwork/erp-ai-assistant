
# Phase 24: Advanced Accounting Engine

## Overview

Add four advanced accounting capabilities: FX revaluation with journal posting, Kompenzacija (mutual debt offsetting) workflow, enhanced fixed asset disposal with gain/loss handling and sale proceeds, and inventory costing methods (FIFO and weighted average cost layers).

---

## Part 1: Database Migration

A single migration creates all new tables and alters existing ones.

### 1.1 `fx_revaluations` -- FX revaluation run log

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| legal_entity_id | uuid FK legal_entities | nullable |
| revaluation_date | date | |
| base_currency | text | default 'RSD' |
| total_gain | numeric | default 0 |
| total_loss | numeric | default 0 |
| journal_entry_id | uuid FK journal_entries | nullable |
| created_by | uuid | nullable |
| created_at | timestamptz | default now() |

### 1.2 `fx_revaluation_lines` -- Per-open-item revaluation detail

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| revaluation_id | uuid FK fx_revaluations | |
| open_item_id | uuid FK open_items | |
| currency | text | |
| original_rate | numeric | |
| new_rate | numeric | |
| original_amount_rsd | numeric | |
| revalued_amount_rsd | numeric | |
| difference | numeric | gain if positive, loss if negative |

### 1.3 `kompenzacija` -- Offsetting agreements

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| legal_entity_id | uuid FK legal_entities | nullable |
| document_number | text | auto-generated |
| document_date | date | |
| partner_id | uuid FK partners | |
| total_amount | numeric | |
| status | text | 'draft', 'confirmed', 'cancelled' |
| journal_entry_id | uuid FK journal_entries | nullable |
| notes | text | nullable |
| created_by | uuid | nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 1.4 `kompenzacija_items` -- Items being offset

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| kompenzacija_id | uuid FK kompenzacija | |
| open_item_id | uuid FK open_items | |
| amount | numeric | amount being offset |
| direction | text | 'receivable' or 'payable' |

### 1.5 `inventory_cost_layers` -- FIFO/weighted avg cost tracking

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| product_id | uuid FK products | |
| warehouse_id | uuid FK warehouses | |
| layer_date | date | receipt date |
| quantity_remaining | numeric | starts at received qty |
| unit_cost | numeric | cost per unit in this layer |
| reference | text | nullable (PO/GR reference) |
| created_at | timestamptz | |

### 1.6 ALTER `fixed_assets`

Add columns:
- `sale_price` numeric default 0 -- proceeds from sale
- `disposal_type` text -- 'scrapped', 'sold', 'transferred'
- `legal_entity_id` uuid FK legal_entities nullable

### 1.7 ALTER `products`

Add column:
- `costing_method` text default 'weighted_average' -- 'fifo' or 'weighted_average'

### 1.8 ALTER `inventory_movements`

Add column:
- `unit_cost` numeric default 0 -- cost per unit at time of movement

RLS policies on all new tables scoped by tenant_id. Updated_at triggers on kompenzacija.

---

## Part 2: FX Revaluation Page

### New file: `src/pages/tenant/FxRevaluation.tsx`

**Workflow:**
1. User selects a revaluation date
2. System fetches all open items in foreign currencies (remaining_amount > 0, currency != 'RSD')
3. For each, looks up the exchange rate on the revaluation date from `exchange_rates`
4. Calculates: original RSD amount (original_amount * original_rate) vs revalued (remaining * new_rate)
5. Shows a preview table with per-item gains/losses
6. User clicks "Post Revaluation" which:
   - Creates `fx_revaluations` + `fx_revaluation_lines` records
   - Posts a journal entry: net gain credits 6700 (FX Gain), net loss debits 5700 (FX Loss), offset against the receivable/payable account (2020 for AR, 4320 for AP)
   - Uses `createCodeBasedJournalEntry`

**UI elements:**
- Date picker for revaluation date
- Legal entity filter (optional)
- Preview table: Partner | Document | Currency | Original Rate | New Rate | Original RSD | Revalued RSD | Difference
- Summary cards: Total Gain, Total Loss, Net Effect
- "Post Revaluation" button
- History tab showing past revaluations

---

## Part 3: Kompenzacija (Offsetting) Page

### New file: `src/pages/tenant/Kompenzacija.tsx`

**Workflow:**
1. User selects a partner who has both receivable and payable open items
2. System shows receivable items on the left, payable items on the right
3. User selects items to offset and enters amounts (up to remaining_amount)
4. Total receivable offset must equal total payable offset
5. On confirm:
   - Creates `kompenzacija` + `kompenzacija_items` records
   - Posts journal entry: Debit AP account (4320), Credit AR account (2020) for the offset amount
   - Updates `open_items` -- reduces `remaining_amount`, sets status to 'partial' or 'closed' + status 'offset'
   - Status goes from 'draft' to 'confirmed'

**UI elements:**
- Partner selector
- Two-column layout: Receivables | Payables
- Checkboxes + amount inputs per item
- Running total showing balance
- Confirm button (disabled if totals don't match)
- List view of past kompenzacija documents with status badges
- Cancel action (creates reversal journal entry)

---

## Part 4: Enhanced Fixed Asset Disposal

### Modify: `src/pages/tenant/FixedAssets.tsx`

Current disposal logic only handles loss on disposal (book value > 0). Enhance to support:

1. **Disposal type selector** in the edit dialog when status changes to "disposed": scrapped, sold, transferred
2. **Sale price field** -- if sold, user enters the sale price
3. **Gain/Loss calculation**:
   - Book value = cost - accumulated depreciation
   - If sold: gain = sale_price - book_value (can be positive = gain, negative = loss)
   - Journal lines:
     - Debit 1290 (Accum Dep) for accumulated amount
     - Debit Bank/Cash 2410 for sale_price (if sold)
     - Credit 1200 (Asset) for cost
     - If gain > 0: Credit 8210 (Gain on Disposal)
     - If loss > 0: Debit 8200 (Loss on Disposal)
   - If scrapped: same as current but uses disposal_type field
4. **Legal entity selector** on the asset form (new `legal_entity_id` column)
5. Save `disposal_type` and `sale_price` to the fixed_assets record

---

## Part 5: Inventory Costing Methods

### Modify: `src/pages/tenant/Products.tsx`

- Add `costing_method` field to the product form (Select: FIFO / Weighted Average)
- Display costing method in the products table

### New file: `src/pages/tenant/InventoryCostLayers.tsx`

- Read-only view of cost layers per product
- Shows: Product | Warehouse | Layer Date | Qty Remaining | Unit Cost | Reference
- Filters: product, warehouse
- Summary: total value per product

### Modify: `src/pages/tenant/InventoryStock.tsx`

- Show "Avg Cost" column from cost layers (computed as weighted average of remaining layers)
- Show "Total Value" column (qty * avg cost)

### Modify: `src/pages/tenant/GoodsReceipts.tsx`

- When a goods receipt is confirmed, create a cost layer in `inventory_cost_layers`
- Unit cost comes from the purchase order line or manual entry

---

## Part 6: Routes and Navigation

### Modify: `src/App.tsx`

Add routes:
- `accounting/fx-revaluation` -> FxRevaluation (accounting module)
- `accounting/kompenzacija` -> Kompenzacija (accounting module)
- `inventory/cost-layers` -> InventoryCostLayers (inventory module)

### Modify: `src/layouts/TenantLayout.tsx`

Add to `accountingNav`:
- `{ key: "fxRevaluation", url: "/accounting/fx-revaluation", icon: DollarSign }`
- `{ key: "kompenzacija", url: "/accounting/kompenzacija", icon: ArrowLeftRight }`

Add to `inventoryNav`:
- `{ key: "costLayers", url: "/inventory/cost-layers", icon: Layers }` (or Coins)

---

## Part 7: Translations

### Modify: `src/i18n/translations.ts`

Add ~40 keys for EN and SR:
- FX revaluation: `fxRevaluation`, `revaluationDate`, `originalRate`, `newRate`, `revaluedAmount`, `fxGain`, `fxLoss`, `netEffect`, `postRevaluation`, `revaluationHistory`, `noForeignCurrencyItems`
- Kompenzacija: `kompenzacija`, `offsetting`, `selectPartnerForOffset`, `receivables`, `payables`, `offsetAmount`, `totalToOffset`, `amountsMustMatch`, `confirmKompenzacija`, `kompenzacijaConfirmed`, `kompenzacijaCancelled`
- Fixed assets: `disposalType`, `scrapped`, `sold`, `transferred`, `salePrice`, `gainOnDisposal`, `lossOnDisposal`
- Inventory costing: `costingMethod`, `fifo`, `weightedAverage`, `costLayers`, `layerDate`, `qtyRemaining`, `unitCost`, `avgCost`, `totalValue`

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/tenant/FxRevaluation.tsx` | FX revaluation preview + posting page |
| `src/pages/tenant/Kompenzacija.tsx` | Mutual debt offsetting workflow |
| `src/pages/tenant/InventoryCostLayers.tsx` | Cost layer viewer |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/tenant/FixedAssets.tsx` | Disposal type, sale price, gain/loss logic, legal entity |
| `src/pages/tenant/Products.tsx` | Add costing_method field |
| `src/pages/tenant/InventoryStock.tsx` | Avg cost + total value columns |
| `src/pages/tenant/GoodsReceipts.tsx` | Create cost layers on receipt confirmation |
| `src/layouts/TenantLayout.tsx` | Add nav items for FX reval, kompenzacija, cost layers |
| `src/App.tsx` | Add 3 new routes |
| `src/i18n/translations.ts` | ~40 new translation keys |

---

## Technical Details

### FX Revaluation Journal Entry Pattern

```text
For receivables (customer owes us in EUR):
  If EUR appreciated (gain):
    Debit  2020 (AR)        difference
    Credit 6700 (FX Gain)   difference
  If EUR depreciated (loss):
    Debit  5700 (FX Loss)   difference
    Credit 2020 (AR)        difference

For payables (we owe supplier in EUR):
  If EUR appreciated (loss - we owe more):
    Debit  5700 (FX Loss)   difference
    Credit 4320 (AP)        difference
  If EUR depreciated (gain - we owe less):
    Debit  4320 (AP)        difference
    Credit 6700 (FX Gain)   difference
```

### Kompenzacija Journal Entry

```text
Debit  4320 (AP - reduces payable)     offset_amount
Credit 2020 (AR - reduces receivable)  offset_amount
```

### Enhanced Disposal Journal (Sale Example)

```text
Asset cost: 100,000  Accumulated dep: 60,000  Book value: 40,000  Sale price: 55,000  Gain: 15,000

Debit  1290 (Accum Dep)         60,000
Debit  2410 (Bank/Cash)         55,000
Credit 1200 (Fixed Asset)      100,000
Credit 8210 (Gain on Disposal)  15,000
```

### Inventory Cost Layer - FIFO Consumption

```text
When goods go out (sale/production):
1. Query cost_layers for product+warehouse ordered by layer_date ASC
2. Consume from oldest layer first
3. Reduce quantity_remaining
4. Calculate COGS = sum of (consumed_qty * layer.unit_cost)
5. Post journal: Debit 7000 (COGS), Credit 1300 (Inventory)
```

### Weighted Average Recalculation

```text
On each new receipt:
  new_avg = (existing_qty * old_avg + new_qty * new_cost) / (existing_qty + new_qty)
  All remaining layers consolidated into one effective cost
```
