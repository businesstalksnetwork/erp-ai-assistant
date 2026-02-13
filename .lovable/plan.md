

# Reorganize Inventory (Magacin) Sidebar Structure

## Problem

The Inventory sidebar currently lists 17 items in a flat, unstructured list. This makes it hard to find items quickly, especially since it mixes core inventory, internal logistics, pricing operations, and WMS items together.

## Proposed Structure

Reorganize the 17 items into 4 logical sub-sections with small section labels (dividers) inside the collapsible group:

**Core Inventory**
- Proizvodi (Products)
- Pregled zaliha (Stock Overview)
- Istorija kretanja (Movement History)
- Slojevi troskova (Cost Layers)

**Internal Logistics**
- Interne narudzbenice (Internal Orders)
- Interni prenosi (Internal Transfers)
- Interni prijem (Internal Receipts)
- Otpremnice (Dispatch Notes)

**Pricing Operations**
- Kalkulacija
- Nivelacija

**WMS (Warehouse Management)**
- Zone i pozicije (Zones)
- WMS Zadaci (Tasks)
- Prijem (Receiving)
- Komisioniranje (Picking)
- Popis (Cycle Counts)
- AI Slotting

## Technical Approach

### 1. Extend the NavItem type to support section dividers

Add an optional `section` property to the `NavItem` type and add a `divider` variant:

```typescript
type NavItem = {
  key: string;
  url: string;
  icon: LucideIcon;
  section?: string; // optional section label before this item
};
```

### 2. Update `CollapsibleNavGroup` rendering

When an item has a `section` property, render a small muted label above it as a visual sub-header (e.g., "WMS", "INTERNA LOGISTIKA").

### 3. Reorder and annotate the `inventoryNav` array

Reorder items into the 4 groups and add `section` markers on the first item of each sub-group.

## Files Modified

1. **`src/layouts/TenantLayout.tsx`**
   - Add `section?: string` to `NavItem` type
   - Update `CollapsibleNavGroup` to render section dividers
   - Reorder and annotate `inventoryNav` items into 4 sub-sections
