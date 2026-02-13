

# Enhance Profitability Analysis Page

## Current State

The page has 3 tabs (Customer, Product, Cost Center) but only shows **revenue** -- no COGS, no margins, no percentages. The product tab is table-only (no chart). Missing CSV export.

## Enhancements

### Single file change: `src/pages/tenant/ProfitabilityAnalysis.tsx`

### By Customer Tab
- **Add COGS**: Join `invoice_lines.product_id` to `products.default_purchase_price` to calculate cost per line, then aggregate cost by `partner_name`
- **Add columns**: Revenue | COGS | Gross Profit | Margin %
- **Chart**: Stacked bar (Revenue vs COGS) for top 10 customers
- **Color-code margin**: Green for margin above 30%, yellow 15-30%, red below 15%

### By Product Tab
- **Add COGS**: Same product cost lookup -- `quantity * default_purchase_price` per line
- **Add columns**: Quantity | Revenue | COGS | Gross Profit | Margin %
- **Add chart**: Horizontal bar chart showing top 10 products by profit (was table-only)
- **Color-code margin**: Same thresholds

### By Cost Center Tab
- Already has Revenue/Expenses/Profit -- add **Margin %** column
- Color-code the margin column

### Summary KPI Cards (top of page, above tabs)
- Total Revenue
- Total COGS
- Gross Profit
- Average Margin %

### CSV Export
- Add `ExportButton` component to `PageHeader` actions for each tab's data

## Technical Detail

The key data flow for COGS:

```text
invoice_lines (quantity, unit_price, product_id)
  JOIN products (default_purchase_price)
  JOIN invoices (partner_name, status, tenant_id)

COGS per line = quantity * default_purchase_price
Revenue per line = line_total (or quantity * unit_price)
Gross Profit = Revenue - COGS
Margin % = (Gross Profit / Revenue) * 100
```

Customer query changes:
- Fetch `invoice_lines` with `product:product_id(default_purchase_price)` and `invoice:invoice_id(partner_name, status, tenant_id)`
- Filter by tenant and status
- Aggregate revenue and COGS by `partner_name`

Product query changes:
- Same fetch, aggregate by `description` (product name)

Cost center query stays the same but adds margin % calculation.

No database changes needed -- all data already exists.

