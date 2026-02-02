
# Plan: Optimizacija fakture za štampu na jednoj strani

## Problem

Faktura sa jednom stavkom ne staje na jednu A4 stranu prilikom štampanja. Na prvoj strani se prikazuje samo logo i naslov, dok je ostatak sadržaja na drugoj strani. Ovo je neprihvatljivo za jednostavne fakture.

## Analiza prostora

Trenutni problemi:
1. **Logo**: `h-14` (56px) + `mb-4` (16px) = 72px - previše za štampu
2. **Naslov**: `text-2xl` + margine
3. **CardHeader**: ima border-bottom i padding
4. **CardContent**: `pt-6` (24px) i `gap-4` između sekcija
5. **Print CSS**: smanjuje fontove ali ne i logo

## Rešenje

### 1. Smanjenje loga u print režimu (src/index.css)
- Maksimalna visina loga: 32px (umesto 56px)
- Uklanjanje margine ispod loga
- Kompaktniji header

### 2. Kompaktniji header (src/index.css)
- Manji padding u CardHeader za štampu
- Manja margina ispod border-a

### 3. Inline layout za logo i naslov (opciono)
- Logo i naslov u istoj liniji štede vertikalni prostor

## Konkretne izmene

### src/index.css - Print stilovi

Dodati pravila unutar `@media print` bloka:

```css
/* Kompaktan logo za štampu */
.print-invoice img[alt*="logo"] {
  max-height: 32px !important;
  height: auto !important;
}

.print-invoice [class*="CardHeader"] {
  padding: 6px 8px !important;
}

.print-invoice [class*="CardHeader"] .mb-4 {
  margin-bottom: 4px !important;
}

.print-invoice [class*="CardHeader"] .mb-3 {
  margin-bottom: 3px !important;
}

/* Manji naslov fakture */
.print-invoice h1.text-2xl {
  font-size: 13px !important;
  margin: 0 !important;
}

/* Kompaktniji razmak između sekcija */
.print-invoice .gap-4 {
  gap: 4px !important;
}

.print-invoice .gap-6 {
  gap: 6px !important;
}
```

### src/pages/InvoiceDetail.tsx - Inline logo i naslov

Alternativno, layout logo+naslov može biti horizontalan za štampu:

```tsx
<CardHeader className="text-center border-b print:flex print:flex-row print:items-center print:justify-between print:text-left print:py-2">
  {/* Logo */}
  {logo_url && (
    <div className="flex justify-center mb-4 print:mb-0 print:justify-start">
      <img 
        src={logo_url}
        alt="logo"
        className="h-14 max-w-[180px] object-contain print:h-8 print:max-w-[120px]"
      />
    </div>
  )}
  {/* Naslov */}
  <h1 className="text-2xl font-bold print:text-sm print:m-0">
    {getDocumentTitle()} <span className="font-mono">{invoice.invoice_number}</span>
  </h1>
</CardHeader>
```

## Rezultat

- Logo: 56px → 32px (ušteda 24px)
- Margina ispod loga: 16px → 4px (ušteda 12px)
- CardHeader padding: smanjen (ušteda ~16px)
- Gap između sekcija: 16px → 4px (ušteda ~36px na 3 sekcije)
- **Ukupna ušteda: ~90-100px vertikalnog prostora**

Ovo je dovoljno da jednostavna faktura sa jednom stavkom stane na jednu A4 stranu.

## Tehničke napomene

- Izmene utiču SAMO na štampu, ekranski prikaz ostaje nepromenjen
- Print selektori su specifični za `.print-invoice` kontejner
- Logo se automatski skalira proporcionalno
