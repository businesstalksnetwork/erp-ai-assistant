
# Phase D: Differentiation Features ✅ COMPLETE

## Implemented Items

### 1. ✅ BANK-4: Wire Transfer Templates
- `payment_templates` table with RLS
- `PaymentTemplates.tsx` — CRUD list page
- "Save as Template" + "Fill from Template" integrated in `PaymentOrderForm.tsx`
- Route: `accounting/payment-templates`

### 2. ✅ BANK-6: Interest Auto-Accrual
- `interest_accruals` table with RLS
- `InterestAccrual.tsx` — period selector, calculated preview, batch save
- NBS reference rate + ZoOO Art. 278 penalty rate (ref + 8%)
- Route: `accounting/interest-accrual`

### 3. ✅ BANK-7b: Cesija & Asignacija
- `cesije` + `asignacije` tables with RLS
- `CesijaAsignacija.tsx` — tabbed UI with partner selectors
- GL posting references: DR/CR 2040 (cesija), DR/CR 4350 (asignacija)
- Route: `accounting/cesija-asignacija`

### 4. ✅ DMS-6: OCR Integration
- `OcrButton.tsx` shared component
- `document-ocr` edge function using Lovable AI (Gemini Flash) for text extraction
- Stores results in `dms_documents.ocr_text`
