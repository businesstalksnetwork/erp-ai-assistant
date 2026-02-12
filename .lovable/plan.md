

# Fix: Move Retail/Sales Items Out of CRM into Proper Navigation Groups

## Problem

Salespeople, Sales Performance, and Retail Prices were incorrectly placed under the CRM navigation group. These are Sales/Retail (Prodaja/Maloprodaja) concerns, not CRM.

CRM should only contain: Dashboard, Companies, Contacts, Leads, Opportunities, Meetings, Partners.

## Solution

Create a new **"Prodaja" (Sales)** navigation group that houses all sales-related pages, and keep POS items where they are.

### New Navigation Structure

```text
CRM (Customer Relationships)
  - CRM Dashboard
  - Companies
  - Contacts
  - Leads
  - Opportunities
  - Meetings
  - Partners

Prodaja (Sales / Veleprodaja + Maloprodaja)
  - Quotes
  - Sales Orders
  - Salespeople
  - Sales Channels
  - Sales Performance
  - Retail Prices

POS (Kasa / eFiskalizacija)
  - POS Terminal
  - POS Sessions
  - Fiscal Devices
  - Daily Report (Z-Report)
```

Quotes and Sales Orders move from CRM to Sales because they are transactional sales documents, not customer relationship management.

## Changes

### 1. `src/layouts/TenantLayout.tsx`

- Remove `salespeople`, `salesPerformance`, `retailPrices` from `crmNav`
- Remove `quotes`, `salesOrders` from `crmNav`
- Create new `salesNav: NavItem[]` array containing: Quotes, Sales Orders, Sales Channels, Salespeople, Sales Performance, Retail Prices
- Add a new `CollapsibleNavGroup` for "sales" / "prodaja" in the sidebar, between CRM and Purchasing
- Use a new accent color (e.g. `bg-orange-400`) for the Sales group
- Guard with `canAccess("sales")` or reuse `canAccess("crm")` depending on RBAC setup

### 2. `src/App.tsx`

- Move routes for salespeople, sales-performance, retail-prices from `/crm/` prefix to `/sales/` prefix:
  - `/sales/salespeople`
  - `/sales/sales-performance`
  - `/sales/retail-prices`
  - `/sales/quotes`
  - `/sales/sales-orders`
  - `/sales/sales-channels`
- Keep requiredModule as appropriate (could be "sales" or keep "crm" for now)

### 3. `src/i18n/translations.ts`

- Add translation key: `sales` -> EN: "Sales", SR: "Prodaja"
- Add key `prodaja` if needed for display

### 4. Update any internal navigation links

- `CrmDashboard.tsx` quick actions that link to `/crm/quotes`, `/crm/sales-orders` need updating to `/sales/quotes`, `/sales/sales-orders`
- Any `useNavigate` calls pointing to old `/crm/salespeople` etc.

## Files to Modify

| File | Changes |
|------|---------|
| `src/layouts/TenantLayout.tsx` | Create `salesNav`, remove items from `crmNav`, add new sidebar group |
| `src/App.tsx` | Move 6 routes from `/crm/` to `/sales/` prefix |
| `src/i18n/translations.ts` | Add "sales"/"prodaja" translation key |
| `src/pages/tenant/CrmDashboard.tsx` | Update quick action links from `/crm/quotes` to `/sales/quotes` etc. |

