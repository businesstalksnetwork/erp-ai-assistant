
# Plan: Provera i ispravka SEF logike slanja

## Identifikovani problemi

### 1. Auto-slanje bez jasne povratne informacije
Kada se kreira faktura za domaćeg klijenta koji je SEF-registrovan, toggle "Pošalji na SEF" se automatski uključuje. Slanje se vrši asinhrono u pozadini — korisnik može da navigira pre nego što vidi rezultat. Ovo može dovesti do situacije gde korisnik misli da faktura NIJE poslata, a zapravo jeste.

### 2. `sef-send-invoice` NE upisuje u `sef_invoices` tabelu
Edge funkcija `sef-send-invoice` ažurira samo `invoices` tabelu (`sef_status`, `sef_invoice_id`), ali NE kreira zapis u `sef_invoices` tabeli. Ovo znači da:
- Faktura se pojavi u SEF Centru tek kada pozadinska sinhronizacija preuzme podatke sa SEF API-ja
- Do tada postoji nekonzistentnost između stanja u `invoices` (poslato) i `sef_invoices` (ne postoji)

### 3. Nedostaje provera SEF odgovora za `sef_raw_response`
Puni SEF API odgovor se ne čuva nigde u edge funkciji (memorija kaže da se čuva u `sef_raw_response`, ali kolona ne postoji u kodu).

## Predložene ispravke

### Ispravka 1: `sef-send-invoice` — upsert u `sef_invoices` nakon uspešnog slanja
Nakon što SEF API vrati uspešan odgovor sa `InvoiceId`, edge funkcija treba da kreira/ažurira zapis u `sef_invoices` tabeli. Ovo osigurava instant vidljivost u SEF Centru.

**Fajl:** `supabase/functions/sef-send-invoice/index.ts`
- Posle uspešnog `update` u `invoices` tabelu (linije 477-485), dodati `upsert` u `sef_invoices`:
```text
await supabase.from('sef_invoices').upsert({
  company_id: companyId,
  sef_invoice_id: newSefId,
  invoice_type: 'sales',
  invoice_number: invoice.invoice_number,
  issue_date: invoice.issue_date,
  counterparty_name: invoice.client_name,
  counterparty_pib: invoice.client_pib,
  total_amount: invoice.total_amount,
  currency: 'RSD',
  sef_status: 'Sent',
  local_status: 'imported',
  linked_invoice_id: invoiceId,
}, { onConflict: 'company_id,sef_invoice_id,invoice_type' });
```
- Isto uraditi i za storno slanje (posle linije 333)

### Ispravka 2: Jasnija UX za auto-slanje na SEF
**Fajl:** `src/pages/NewInvoice.tsx`
- Umesto da se `sendToSEF` poziva asinhrono bez čekanja rezultata, sačekati rezultat pre navigacije
- Prikazati jasnu poruku korisniku da je faktura poslata na SEF (ili grešku ako nije)
- Promeniti logiku sa `.then()` na `await` unutar try bloka, pre `navigate()`

### Ispravka 3: SEF toggle jasniji u UI
**Fajl:** `src/pages/NewInvoice.tsx`
- Dodati vizualniji indikator (npr. žutu boju za toggle label) kada je SEF slanje uključeno
- Dodati kratko objašnjenje ispod toggle-a: "Faktura će biti automatski poslata na SEF nakon kreiranja"

## Tehnicki detalji izmena

### `supabase/functions/sef-send-invoice/index.ts`
1. Nakon linije 485 (uspešan send), dodati upsert u `sef_invoices`
2. Nakon linije 333 (uspešan storno send), dodati upsert u `sef_invoices`
3. Čuvati `sef_raw_response` ako kolona postoji

### `src/pages/NewInvoice.tsx`
1. Promeniti asinhrono slanje (linije 680-685) da koristi `await` umesto `.then()`
2. Prikazati rezultat SEF slanja pre navigacije
3. Dodati vizualni indikator za SEF toggle status

### `src/pages/Invoices.tsx`
1. Ista izmena za konverziju predračuna (linije 182-188) — `await` umesto `.then()`
2. Ista izmena za storno (linije 212-216)
