

# Reorder Sidebar Navigation Groups

## What Changes

Reorder the collapsible navigation groups in `src/layouts/TenantLayout.tsx` (lines 374-409) to match the requested order:

1. CRM (currently 1st -- stays)
2. Prodaja / Sales (currently 2nd -- stays)
3. POS (currently 9th -- moves up)
4. Web Prodaja / Web Sales (currently 10th -- moves up)
5. Magacin / Inventory (currently 4th -- moves down)
6. Nabavka / Purchasing (currently 3rd -- moves down)
7. Proizvodnja / Production (currently 5th -- moves down)
8. Povrati / Returns (currently 12th -- moves up)
9. Analize / Analytics (currently 7th -- moves down)
10. Racunovodstvo / Accounting (currently 6th -- moves down)
11. Ljudski Resursi / HR (currently 8th -- moves down)
12. DMS / Documents (currently 11th -- stays near end)

## Technical Detail

Single file change in `src/layouts/TenantLayout.tsx` -- rearrange the JSX blocks for the `CollapsibleNavGroup` components between lines 374-409. No logic changes, just reordering the render order.
