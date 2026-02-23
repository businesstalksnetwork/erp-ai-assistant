

## Create Quote Detail and Sales Order Detail Pages

### Problem
Currently, clicking on a quote number or sales order number in the list tables does nothing -- there are no detail pages. Users need to be able to click on a "broj ponude" (quote number) or "broj naloga" (order number) to open a full detail view where they can review all information, manage line items, and take actions.

### What Will Be Built

Two new detail pages following the same pattern as the existing `OpportunityDetail.tsx`:

#### 1. `src/pages/tenant/QuoteDetail.tsx`
A full detail page for a single quote, accessible at `/sales/quotes/:id`. Includes:

- **Header**: Quote number, version badge, status badge, back button, action buttons (Edit, Create New Version, Convert to Sales Order)
- **Overview Card**: Partner, opportunity, salesperson, dates (quote date, valid until), currency, totals (subtotal, tax, total), notes, discount approval status
- **Line Items Tab**: Table of `quote_lines` showing product, description, quantity, unit price, tax rate, line total -- with ability to add/edit/remove lines
- **Version History Tab**: Reuses existing `QuoteVersionHistory` component
- **Expiry warning**: Visual indicator if the quote is expiring soon

#### 2. `src/pages/tenant/SalesOrderDetail.tsx`
A full detail page for a single sales order, accessible at `/sales/sales-orders/:id`. Includes:

- **Header**: Order number, status badge, back button, action buttons (Edit, Create Invoice)
- **Overview Card**: Partner, linked quote (clickable link to quote detail), salesperson, order date, currency, totals, notes, source/channel info
- **Line Items Tab**: Table of `sales_order_lines` showing product, description, quantity, unit price, tax rate, line total -- with ability to add/edit/remove lines

#### 3. Make quote numbers and order numbers clickable in list pages

- **`Quotes.tsx`**: Make the quote_number column a clickable link that navigates to `/sales/quotes/:id`
- **`SalesOrders.tsx`**: Make the order_number column a clickable link that navigates to `/sales/sales-orders/:id`

#### 4. Register routes in `App.tsx`
- Add lazy imports for `QuoteDetail` and `SalesOrderDetail`
- Add routes: `sales/quotes/:id` and `sales/sales-orders/:id`

### Files Summary

| File | Action |
|------|--------|
| `src/pages/tenant/QuoteDetail.tsx` | Create -- full detail page with overview + line items + version history tabs |
| `src/pages/tenant/SalesOrderDetail.tsx` | Create -- full detail page with overview + line items tabs |
| `src/pages/tenant/Quotes.tsx` | Modify -- make quote_number a clickable link to detail page |
| `src/pages/tenant/SalesOrders.tsx` | Modify -- make order_number a clickable link to detail page |
| `src/App.tsx` | Modify -- add 2 lazy imports + 2 new routes |

### Technical Details

**Database tables used:**
- `quotes` -- main quote record (quote_number, partner_id, status, subtotal, tax_amount, total, currency, valid_until, current_version, max_discount_pct, salesperson_id, etc.)
- `quote_lines` -- line items (product_id, description, quantity, unit_price, tax_rate_value, line_total, tax_amount, total_with_tax, sort_order)
- `sales_orders` -- main order record (order_number, quote_id, partner_id, status, subtotal, tax_amount, total, currency, salesperson_id, etc.)
- `sales_order_lines` -- line items (same structure as quote_lines)

**Line item editing**: Each detail page will include inline add/edit/delete for line items with automatic recalculation of subtotal, tax, and total on the parent record.

**Navigation pattern**: Follows existing patterns like `OpportunityDetail` (useParams for id, back button with navigate(-1), Card-based layout with Tabs).

**All UI text** will be in professional Serbian Latin, consistent with the rest of the application.

