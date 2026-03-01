

# Phase E: Premium Features

## Items to Implement

### 1. POS-7: Restaurant Mode
Full table-service POS mode with:
- **Tables management:** `restaurant_tables` table (number, capacity, zone, status: free/occupied/reserved), visual grid layout in a new `RestaurantTables.tsx` component
- **Table orders:** `restaurant_orders` table (table_id, status: open/served/billed, course tracking), multi-course ordering with "send to kitchen" per course
- **Bill splitting:** Split by item, by seat, or equal division — reuses existing `SplitPaymentDialog` for payment portion
- **Kitchen display:** `KitchenDisplay.tsx` page showing pending orders by course with "mark ready" buttons, uses polling (Supabase realtime optional)
- **Reservations:** `restaurant_reservations` table (table_id, date, time, party_size, guest_name, phone)
- **Integration:** Toggle "Restaurant Mode" in POS settings; when active, PosTerminal shows table selector before cart
- **Migration:** 3 new tables (`restaurant_tables`, `restaurant_orders`, `restaurant_reservations`)
- **Routes:** `pos/tables`, `pos/kitchen`, `pos/reservations`
- **New files:** ~5 (RestaurantTables, KitchenDisplay, RestaurantReservations, TableOrderDialog, RestaurantModeToggle)

### 2. DMS-7: E-Signature Integration
Document signing workflow with:
- **Signing flow:** Reuse the existing Revers signature pattern (`signature_token`, token-based URL, IP capture) already proven in `AssetReverses.tsx` + `ReversSignature.tsx`
- **New component:** `DocumentSignatureRequest.tsx` — select document, add signers (email), generate token URLs, send notification
- **Signer page:** `DocumentSign.tsx` — public page (like `/sign/:token`) showing document preview + "I agree / Reject" buttons with name + IP capture
- **Migration:** Add `document_signatures` table (document_id, signer_email, signer_name, token, status: pending/signed/rejected, signed_at, ip_address)
- **Edge function:** `send-document-signature` — sends email with signing link (follows `send-revers-notification` pattern)
- **PDF stamp:** After all signers complete, add signature metadata to document record
- **Routes:** `/sign-document/:token` (public), documents detail page gets "Request Signature" button
- **New files:** ~3 (DocumentSignatureRequest, DocumentSign page, edge function)

---

## Technical Summary

| Item | New Pages/Components | Migration Tables | Edge Functions |
|------|---------------------|-----------------|----------------|
| POS-7 | ~5 | 3 | 0 |
| DMS-7 | ~3 | 1 | 1 |
| **Total** | **~8 files** | **4 tables** | **1 edge function** |

