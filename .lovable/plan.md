
# Divide Salespeople: In-Store (Prodavac) vs. Komercijalista (Wholesale Agent)

## Problem

Currently all salespeople are treated the same. In reality there are two distinct roles:

1. **Prodavac (In-Store Salesperson)** -- works in a retail shop, sells to walk-in customers via POS, tracked per-store
2. **Komercijalista (Commercial Agent)** -- works on wholesale deals, connected to CRM opportunities/leads/quotes, not tied to a single store

Analytics should reflect this split: in-store leaderboards per shop, and komercijalista performance by deals/pipeline value.

## Part 1: Database Migration

**ALTER `salespeople`** -- add role type and default location:

```text
ADD COLUMN role_type text NOT NULL DEFAULT 'in_store'
  -- values: 'in_store' (prodavac) or 'wholesale' (komercijalista)
ADD COLUMN default_location_id uuid REFERENCES locations(id)
  -- the shop this in-store person primarily works at (nullable for wholesale agents)
```

## Part 2: Salespeople.tsx -- Role Type in CRUD

- Add `role_type` selector in add/edit dialog: "Prodavac (In-Store)" or "Komercijalista (Wholesale)"
- When role_type = 'in_store', show a **default location** dropdown (pick from shop/branch locations)
- When role_type = 'wholesale', hide location field
- Show role type as a badge in the table (different colors)
- Add filter tabs or dropdown: All / In-Store / Wholesale
- Update stats cards to show count per type

## Part 3: SalesPerformance.tsx -- Split Analytics

Restructure into **two tabs**: "In-Store (Maloprodaja)" and "Wholesale (Veleprodaja)"

### Tab 1: In-Store Performance
- Filter by store (location)
- KPI cards: Retail Revenue, POS Transactions, Avg Transaction, Active Sellers
- **Per-Store Leaderboard**: table showing best in-store salespeople per selected shop -- ranked by POS transaction revenue
- Bar chart: revenue by in-store salesperson (filtered by store)
- Pie chart: revenue by store (across all in-store people)
- Data source: `pos_transactions` where `salesperson.role_type = 'in_store'`

### Tab 2: Wholesale Performance
- KPI cards: Wholesale Revenue (invoices), Pipeline Value (opportunities), Avg Deal Size, Win Rate
- Leaderboard: komercijalista ranked by invoice revenue + pipeline value
- Bar chart: revenue by komercijalista
- Pie chart: won deals by komercijalista
- Data sources: `invoices`, `opportunities`, `quotes` where `salesperson.role_type = 'wholesale'`

## Part 4: CrmDashboard.tsx -- Komercijalista Widget

Add a "Top Komercijalisti" card showing the top 5 wholesale agents by opportunity pipeline value this month. This makes sense in CRM because komercijalisti are the ones working CRM deals.

- Query opportunities joined with salespeople where `role_type = 'wholesale'`
- Small bar chart or ranked list with pipeline value per person

## Part 5: Translations (~15 new keys)

| Key | EN | SR |
|-----|----|----|
| roleType | Role Type | Tip uloge |
| inStore | In-Store | Prodavac |
| wholesale | Wholesale | Komercijalista |
| inStorePerformance | In-Store Performance | Performanse prodavaca |
| wholesalePerformance | Wholesale Performance | Performanse komercijalista |
| defaultLocation | Default Location | Podrazumevana lokacija |
| topKomercijalisti | Top Commercial Agents | Najbolji komercijalisti |
| retailRevenue | Retail Revenue | Maloprodajni prihod |
| wholesaleRevenue | Wholesale Revenue | Veleprodajni prihod |
| posTransactions | POS Transactions | POS transakcije |
| activeSellers | Active Sellers | Aktivni prodavci |
| pipelineValueKom | Pipeline Value | Vrednost pipeline-a |
| wonDeals | Won Deals | Dobijeni poslovi |

## Files to Modify

| File | Changes |
|------|---------|
| New migration SQL | ALTER salespeople: add `role_type`, `default_location_id` |
| `src/integrations/supabase/types.ts` | Add new columns to Salespeople type |
| `src/pages/tenant/Salespeople.tsx` | Role type selector, location dropdown, filter tabs, type badges |
| `src/pages/tenant/SalesPerformance.tsx` | Two-tab layout (In-Store vs Wholesale), per-store leaderboard, separate data sources |
| `src/pages/tenant/CrmDashboard.tsx` | Top Komercijalisti widget card |
| `src/i18n/translations.ts` | ~15 new keys |

## Technical Notes

### Analytics Data Flow

```text
In-Store (Prodavac):
  pos_transactions.salesperson_id -> salespeople WHERE role_type = 'in_store'
  Grouped by: location_id (which shop), salesperson_id
  Metrics: transaction count, total revenue, avg transaction value

Wholesale (Komercijalista):
  invoices.salesperson_id -> salespeople WHERE role_type = 'wholesale'
  opportunities.salesperson_id -> salespeople WHERE role_type = 'wholesale'
  quotes.salesperson_id -> salespeople WHERE role_type = 'wholesale'
  Metrics: invoice revenue, pipeline value, deal count, win rate, avg deal size
```

### Per-Store In-Store Leaderboard Logic

```text
When store A1 is selected:
  1. Get all pos_transactions WHERE location_id = A1
  2. Group by salesperson_id
  3. For each in-store salesperson: sum revenue, count transactions
  4. Rank by revenue descending
  5. Show: #, Name, Revenue, Transactions, Avg Transaction, Commission
```
