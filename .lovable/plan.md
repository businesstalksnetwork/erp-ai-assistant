

# Comprehensive UI Redesign: Sidebar, Layout, and All Module Pages

## What's Wrong Now

The previous changes only adjusted font sizes and form grid columns. The actual shared components (`PageHeader`, `MobileFilterBar`, `ResponsiveTable`, `BiPageLayout`, `MobileActionMenu`) are barely used. Most pages still have:
- Raw `<h1>` tags instead of the `PageHeader` component (with icon + description)
- Raw `<div className="flex gap-4">` for filters instead of `MobileFilterBar` (which collapses filters into a popover on mobile)
- Raw `<Table>` instead of `ResponsiveTable` (which switches to card layout on mobile)
- No page icons or descriptions
- Inconsistent action button placement

## Plan

### Phase 1: Sidebar Visual Upgrade
**File: `src/layouts/TenantLayout.tsx`**

- Add a proper user profile section at the bottom of the sidebar (avatar + name + role) with logout integrated
- Add subtle gradient/glow effect on the active nav item (not just background change)
- Add module badge counts (e.g., "3" next to Invoices for drafts) using a small `Badge` component
- Improve the collapsible group headers with better spacing and visual hierarchy
- Add a subtle separator between module groups
- Refine the top header bar: add a subtle bottom gradient shadow, better spacing

### Phase 2: Core List Pages -- Adopt Shared Components
Migrate these high-traffic pages to use `PageHeader` + `MobileFilterBar` + `ResponsiveTable` + `MobileActionMenu`:

**CRM Module (4 pages):**
- `Leads.tsx` -- PageHeader with Target icon, MobileFilterBar, ResponsiveTable with card view
- `Contacts.tsx` -- PageHeader with Users icon, MobileFilterBar, ResponsiveTable
- `Opportunities.tsx` -- PageHeader with TrendingUp icon, MobileFilterBar (Kanban stays but gets PageHeader)
- `Companies.tsx` -- same pattern

**Accounting Module (3 pages):**
- `Invoices.tsx` -- PageHeader with Receipt icon, MobileFilterBar, ResponsiveTable
- `JournalEntries.tsx` -- PageHeader with Calculator icon, MobileFilterBar, ResponsiveTable
- `Expenses.tsx` -- same pattern

**Sales Module (2 pages):**
- `Quotes.tsx` -- PageHeader, MobileFilterBar, ResponsiveTable
- `SalesOrders.tsx` -- same pattern

**Purchasing Module (3 pages):**
- `PurchaseOrders.tsx`, `GoodsReceipts.tsx`, `SupplierInvoices.tsx` -- same pattern

**Inventory Module (2 pages):**
- `Products.tsx`, `InventoryStock.tsx` -- same pattern

**HR Module (1 page):**
- `Employees.tsx` -- same pattern

### Phase 3: Dashboard Pages -- Adopt BiPageLayout
- `CrmDashboard.tsx` -- already uses PageHeader but should use BiPageLayout wrapper
- `WmsDashboard.tsx` -- same
- `AnalyticsDashboard.tsx` -- same
- `TenantDashboard.tsx` -- keep current layout (it's the main dashboard, unique)

### What Each Migration Looks Like

Before (current pattern on every page):
```text
<div className="space-y-6">
  <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold">Title</h1>
    <Button>Add New</Button>
  </div>
  <div className="flex gap-4 items-center">
    <Input search />
    <Select filter />
  </div>
  <Table>...</Table>
</div>
```

After (using shared components):
```text
<div className="space-y-6">
  <PageHeader
    title="Title"
    description="Manage your records"
    icon={TargetIcon}
    actions={<Button>Add New</Button>}  // or MobileActionMenu on mobile
  />
  <MobileFilterBar
    search={<Input />}
    filters={<Select />}
    actions={<ExportButton />}
  />
  <ResponsiveTable
    columns={[...]}
    data={filtered}
    onRowClick={row => navigate(...)}
    mobileCard={row => <CardLayout />}
  />
</div>
```

### Phase 4: Settings Page Enhancement
- `Settings.tsx` -- Use PageHeader with Settings icon and description
- Add subtle hover animations on settings cards
- Group settings into logical sections with section headers

## Technical Notes

- Every page gets a relevant Lucide icon in its PageHeader
- `MobileFilterBar` automatically collapses filters into a popover on mobile
- `ResponsiveTable` handles card vs table layout based on screen size
- `MobileActionMenu` consolidates action buttons into a dropdown on mobile
- No new dependencies needed
- Approximately 18-20 files will be modified
- The sidebar changes are in 1 file (`TenantLayout.tsx`)

## Execution Order
1. Sidebar upgrade (TenantLayout.tsx) -- most visible change
2. CRM pages (Leads, Contacts, Opportunities, Companies) -- user is on /crm
3. Accounting pages (Invoices, JournalEntries, Expenses)
4. Remaining modules (Sales, Purchasing, Inventory, HR)
5. Dashboard pages and Settings

