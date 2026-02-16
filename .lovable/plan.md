

# Deep E2E Analiza: Pronađeni problemi i predlozi za unapređenje

## 1. SEF `local_status` ostaje 'pending' iako je SEF status 'Approved'

**Problem:** U bazi postoji 13 izlaznih faktura u `sef_invoices` tabeli gde je `sef_status = 'Approved'` ali `local_status = 'pending'`. Pozadinska sinhronizacija ažurira `sef_status` ali NE ažurira `local_status` u skladu. Takodje, upsert iz `sef-send-invoice` edge funkcije postavlja `local_status: 'imported'`, ali kasnija sinhronizacija ga prepiše na 'pending'.

**Ispravka:**
- U `sef-send-invoice` upsert: postaviti `local_status: 'imported'` (vec radi)
- U pozadinskoj sinhronizaciji (`sef-background-sync`, `sef-continue-sync`, `sef-long-sync`): kada se status fakture promeni na 'Approved' ili 'Rejected', automatski ažurirati i `local_status` u skladu
- Alternativno: u SEF Centru prikazivati `sef_status` kao primarni indikator umesto `local_status` za izlazne fakture

**Fajlovi:**
- `supabase/functions/sef-background-sync/index.ts` - dodati logiku za ažuriranje `local_status` pri promeni `sef_status`
- `supabase/functions/sef-fetch-sales-invoices/index.ts` - isto
- `src/pages/SEFCenter.tsx` - prikazivati `sef_status` kao primarni za izlazne

---

## 2. Advance faktura (avansna) - dizajn razlike na InvoiceDetail

**Problem:** Avansna faktura na InvoiceDetail prikazuje "ZA PLACANJE" umesto "UPLACENO" samo ako `invoice_type === 'advance'`. Ovo je ispravno implementirano (linija 775: `invoice.invoice_type === 'advance' ? t('paid') : t('amount_due')`). Medjutim, layout (potpisi, QR kod) je identican za sve tipove - **OVO JE ISPRAVNO**.

**Status:** OK - dizajn je konzistentan za sve tipove faktura (regular, proforma, advance).

---

## 3. Storno faktura - negativne stavke u prikazu

**Problem:** Storno fakture imaju negativne iznose (`total_amount < 0`). U InvoiceDetail prikazu, negativne vrednosti se korektno formatiraju. Medjutim, QR kod se ne prikazuje za storno jer `amountForPayment > 0` check (linija 439) to sprecava - **ovo je ispravno ponasanje**.

**Status:** OK

---

## 4. PDF generisanje - potencijalni problemi

**Problem A:** PDF generator (`usePdfGenerator.ts`) klonira `.print-invoice` element i renderuje ga offscreen. Potencijalni problem: ako korisnik ima dark mode uključen, funkcija privremeno uklanja `dark` klasu ali NE obraduje CSS varijable (custom properties) koje ostaju tamne u kloniranom DOM-u.

**Problem B:** Za storno fakture, stampani PDF moze prikazivati "FAKTURA BROJ" umesto "STORNO FAKTURA BROJ" jer `getDocumentTitle()` ne obraduje storno tip posebno - koristi isti naslov kao regularna faktura.

**Ispravka:**
- `src/pages/InvoiceDetail.tsx` - dodati proveru za storno u `getDocumentTitle()` (npr. ako je `total_amount < 0` ili ako postoji `storno_of` referenca)
- Razmotriti dodavanje "STORNO" oznake u naslov dokumenta

**Fajl:** `src/pages/InvoiceDetail.tsx`, linija 417-421

---

## 5. Email slanje - PDF se generiše sa trenutnog ekrana

**Problem:** `SendInvoiceDialog` poziva `generatePdfBlob()` koji koristi `generateInvoicePdf` sa `returnBlob: true`. Ova funkcija klonira DOM element `.print-invoice` sa TRENUTNE stranice. Ako korisnik ima otvorenu drugu stranu ili promeni temu tokom generisanja, PDF moze biti pogresan.

**Status:** Prihvatljiv rizik - korisnik je uvek na InvoiceDetail stranici kada salje email.

---

## 6. SEF UBL XML - nedostaje `InvoiceTypeCode` za avansne fakture

**Problem:** U `sef-send-invoice` edge funkciji, `generateUBLXml` uvek koristi `InvoiceTypeCode = 380` (obicna faktura). Za avansne fakture SEF ocekuje `InvoiceTypeCode = 386` (prepayment invoice).

**Ispravka:**
- `supabase/functions/sef-send-invoice/index.ts`, linija 108: proveriti `invoice_type` i koristiti odgovarajuci kod:
  - `380` za regular
  - `386` za advance
- Dodati `invoice_type` u `Invoice` interfejs i preneti ga u `generateUBLXml`

**Fajl:** `supabase/functions/sef-send-invoice/index.ts`

---

## 7. SEF slanje - `sef_status` na `invoices` tabeli vs `sef_invoices` tabela

**Problem:** `invoices.sef_status` se odrzava odvojeno od `sef_invoices.sef_status`. Pozadinska sinhronizacija azurira `sef_invoices.sef_status` (npr. Sent -> Approved), ali NE azurira `invoices.sef_status`. To znaci da `invoices.sef_status` moze ostati 'sent' dok je na SEF-u vec 'approved'.

**Ispravka:** U pozadinskoj sinhronizaciji, kada se azurira `sef_invoices.sef_status`, takodje azurirati `invoices.sef_status` za povezane fakture (preko `linked_invoice_id`).

**Fajlovi:**
- `supabase/functions/sef-background-sync/index.ts`
- `supabase/functions/sef-fetch-sales-invoices/index.ts`

---

## 8. Proforma faktura - slanje na SEF greskom

**Problem:** UI korektno sakriva SEF dugme za predracune (linija 434 u Invoices.tsx: `invoice.invoice_type === 'regular' || invoice.invoice_type === 'advance'`). Edge funkcija takodje odbija predracune (linija 256-258). **Ovo je ispravno.**

**Status:** OK

---

## 9. Duplikati u `sef_invoices` tabeli

**Problem:** Query je pokazao da postoje duplikati purchase faktura (iste `sef_invoice_id` se pojavljuju vise puta). Ovo moze uzrokovati duplirane redove u SEF Centru.

```text
Primer: sef_invoice_id 393648069 (RAIFFEISEN BANKA) pojavljuje se 2 puta
        sef_invoice_id 392344802 (RAIFFEISEN BANKA) pojavljuje se 2 puta
```

**Ispravka:**
- Dodati `UNIQUE` constraint na (`company_id`, `sef_invoice_id`, `invoice_type`) ako vec ne postoji
- Ocistiti postojece duplikate SQL migracijom
- Proveriti da li upsert koristi ispravan `onConflict` kljuc

---

## 10. EditInvoice - nema SEF re-send logiku

**Problem:** Ako korisnik izmeni fakturu koja je vec poslata na SEF, izmene se cuvaju lokalno ali se NE salju ponovo na SEF. SEF i dalje ima staru verziju dokumenta.

**Ispravka:** Dodati upozorenje u EditInvoice formu: "Ova faktura je vec poslata na SEF. Izmene nece biti automatski azurirane na SEF-u." sa opcionalnim dugmetom za re-send.

**Fajl:** `src/pages/EditInvoice.tsx`

---

## Prioriteti implementacije

1. **Kritican**: Issue #6 - pogresan `InvoiceTypeCode` za avansne fakture na SEF-u
2. **Kritican**: Issue #9 - duplikati u `sef_invoices`
3. **Vazan**: Issue #1 - `local_status` sinhronizacija
4. **Vazan**: Issue #7 - `invoices.sef_status` sinhronizacija sa SEF statusom
5. **Srednji**: Issue #4B - storno naslov u dokumentu
6. **Srednji**: Issue #10 - upozorenje za edit poslate fakture

## Tehnicki detalji izmena

### `supabase/functions/sef-send-invoice/index.ts`
- Linija 108: promeniti `InvoiceTypeCode` iz fiksnog `380` u dinamicki baziran na `invoice.invoice_type` (380 za regular, 386 za advance)
- Dodati `invoice_type` field u Invoice interfejs

### SQL migracija za duplikate
```text
-- Brisanje duplikata (zadrzi najnoviji)
DELETE FROM sef_invoices a USING sef_invoices b
WHERE a.id < b.id
AND a.company_id = b.company_id
AND a.sef_invoice_id = b.sef_invoice_id
AND a.invoice_type = b.invoice_type;

-- Dodaj unique constraint ako ne postoji
ALTER TABLE sef_invoices
ADD CONSTRAINT sef_invoices_unique_company_sef_type
UNIQUE (company_id, sef_invoice_id, invoice_type);
```

### `src/pages/InvoiceDetail.tsx`
- Linija 417-421: dodati proveru za storno dokument u `getDocumentTitle()`

### Pozadinska sinhronizacija
- Azurirati `invoices.sef_status` i `sef_invoices.local_status` u skladu sa SEF API odgovorom

### `src/pages/EditInvoice.tsx`
- Dodati Alert komponentu na vrh forme ako je `invoice.sef_invoice_id` prisutan

