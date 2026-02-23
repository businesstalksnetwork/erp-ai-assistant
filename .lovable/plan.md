

## Add Product/Service Picker to All Line Item Dialogs

### Problem
Three modules currently use only a free-text "Opis" (Description) field when adding line items, instead of a product/service picker dropdown. This means products are not linked to line items, breaking inventory tracking, reporting, and data consistency.

**Affected modules:**
- Quote Detail (`QuoteDetail.tsx`) -- no product picker, no `product_id` saved
- Sales Order Detail (`SalesOrderDetail.tsx`) -- no product picker, no `product_id` saved
- Dispatch Note Detail (`DispatchNoteDetail.tsx`) -- DB column `product_id` exists but UI doesn't use it

**Already correct (reference pattern):**
- Invoice Form (`InvoiceForm.tsx`) -- full product Select with auto-fill
- Purchase Orders (`PurchaseOrders.tsx`) -- product Select per line
- Returns (`Returns.tsx`) -- product_id in line form
- Internal Transfers (`InternalTransfers.tsx`) -- product Select per line

### Solution

Apply the same product picker pattern from `InvoiceForm.tsx` to all three affected modules.

### Changes per File

#### 1. `src/pages/tenant/QuoteDetail.tsx`

- Add `product_id` to the `LineForm` interface
- Add a `useQuery` to fetch tenant products (with `tax_rates` join), same as InvoiceForm
- Replace the free-text "Opis" `Input` with:
  - A **"Proizvod/Usluga"** `Select` dropdown listing all active products, plus a "Rucni unos" (Manual entry) option
  - When a product is selected: auto-fill `description` (product name), `unit_price` (`default_sale_price`), `tax_rate_value` (from product's tax rate)
  - Keep the "Opis" text `Input` below for optional notes/override
- Include `product_id` in the insert/update payload for `quote_lines`
- When editing an existing line, pre-select the product in the dropdown
- Update table column header from "OPIS" to "PROIZVOD / USLUGA"

#### 2. `src/pages/tenant/SalesOrderDetail.tsx`

- Exact same changes as QuoteDetail:
  - Add `product_id` to `LineForm`
  - Fetch products query
  - Product Select dropdown with auto-fill
  - Save `product_id` to `sales_order_lines`
  - Pre-select product when editing
  - Update table header

#### 3. `src/pages/tenant/DispatchNoteDetail.tsx`

- Add a `useQuery` to fetch tenant products
- Add `product_id` to the line form state
- Add a **"Proizvod"** `Select` dropdown above the description field in the add-line dialog
- When a product is selected: auto-fill `description` with product name
- Include `product_id` in the insert payload for `dispatch_note_lines`
- Update the lines table to show product name when available

### Technical Details

**Product query pattern** (copied from InvoiceForm lines 122-136):
```typescript
const { data: products = [] } = useQuery({
  queryKey: ["products", tenantId],
  queryFn: async () => {
    const { data } = await supabase
      .from("products")
      .select("*, tax_rates(id, rate)")
      .eq("tenant_id", tenantId!)
      .eq("is_active", true)
      .order("name");
    return data || [];
  },
  enabled: !!tenantId,
});
```

**Auto-fill on product selection** (for Quote and Sales Order):
- `description` = product name
- `unit_price` = `default_sale_price`
- `tax_rate_value` = product's linked `tax_rates.rate` (or keep current value)

**Dialog layout** changes from:
- Opis (text input)
- Kolicina | Jedinicna cena | PDV %

To:
- Proizvod/Usluga (Select dropdown)
- Opis (text input, auto-filled, editable for notes)
- Kolicina | Jedinicna cena | PDV %

**No database migrations needed** -- all three tables already have `product_id` columns with foreign keys to `products`.

### Files Changed

| File | Change |
|------|--------|
| `src/pages/tenant/QuoteDetail.tsx` | Add product query, product Select in line dialog, auto-fill, save product_id |
| `src/pages/tenant/SalesOrderDetail.tsx` | Same product picker changes as QuoteDetail |
| `src/pages/tenant/DispatchNoteDetail.tsx` | Add product query, product Select in add-line dialog, save product_id |

### Import additions needed
All three files will need:
```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
```

