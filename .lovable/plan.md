

# Move Status Badge to the Right (Before Totals)

## Change

In `src/pages/tenant/Payroll.tsx`, move the status `Badge` from its current position (next to the month name on the left) to the right side, immediately before the "Ukupno bruto" / "Ukupno neto" totals.

## Technical Detail

Update lines 198-206 in the `AccordionTrigger` content:

**Current layout**: `[Month Year] [Badge] ... [ml-auto: Totals]`

**New layout**: `[Month Year] ... [ml-auto: Badge | Totals]`

Move the `Badge` inside the `ml-auto` div so it appears right before the gross/net totals, keeping the month/year label clean on the left side.

