

# Istraga: Faktura 1/2026 nije na SEF portalu

## Problem

Faktura 1/2026 za kompaniju "Lider Wash" pokazuje u bazi podataka da je poslata na SEF sa ID-om `314264039`, ali na zvaničnom SEF portalu se ta faktura ne pojavljuje.

## Analiza

### Ključno otkriće: Nelogičan SEF ID

SEF dodeljuje Invoice ID-ove sekvencijalno. Proverom podataka u bazi:

| Faktura | SEF ID | Datum |
|---------|--------|-------|
| 001 (2025) | 314462075 | Juli 2025 |
| 073 (2025) | 384679135 | Decembar 2025 |
| **1/2026** | **314264039** | **Februar 2026** |

**SEF ID `314264039` je NIŽI od ID-a fakture iz Jula 2025!** 

Ovo je nemoguće - SEF ne može dodeliti niži ID kasnijoj fakturi. 

### Mogući uzrok

1. SEF API je vratio **grešku sa starim ID-om** u odgovoru
2. API je vratio cached/stale odgovor
3. Postoji bug u SEF API-ju koji vraća pogrešan ID

### Trenutno stanje u bazi
```text
sef_invoice_id: 314264039
sef_status: sent
sef_sent_at: 2026-02-02 08:54:02
sef_error: null
```

Baza kaže "uspešno poslato", ali SEF portal nema tu fakturu.

## Predloženo rešenje

### 1. Dodati validaciju SEF ID-a (opciono)

U `sef-send-invoice/index.ts`, pre upisivanja ID-a proveriti da li je logičan:

```typescript
// Proveri da li je novi ID veći od poslednjeg poznatog
const { data: lastInvoice } = await supabase
  .from('invoices')
  .select('sef_invoice_id')
  .eq('company_id', companyId)
  .not('sef_invoice_id', 'is', null)
  .order('sef_sent_at', { ascending: false })
  .limit(1)
  .single();

if (lastInvoice?.sef_invoice_id) {
  const lastId = parseInt(lastInvoice.sef_invoice_id);
  const newId = parseInt(sefResult.InvoiceId);
  if (newId < lastId) {
    console.warn(`Suspicious SEF ID: ${newId} < ${lastId}`);
    // Možda tretirati kao grešku
  }
}
```

### 2. Resetovati status ove fakture

Da bi se faktura mogla ponovo poslati na SEF:

```sql
UPDATE invoices 
SET sef_invoice_id = NULL,
    sef_status = 'not_sent',
    sef_sent_at = NULL,
    sef_error = 'SEF ID nevalidan - potrebno ponovo slanje'
WHERE id = 'f68916bc-c5c2-4d81-baee-2c8938ff33d5';
```

### 3. Dodati detaljnije logovanje

Sačuvati kompletan SEF API odgovor u bazu za dijagnostiku:

```typescript
// U sef-send-invoice/index.ts
await supabase
  .from('invoices')
  .update({
    sef_invoice_id: sefResult.InvoiceId,
    sef_status: 'sent',
    sef_sent_at: new Date().toISOString(),
    sef_error: null,
    sef_raw_response: JSON.stringify(sefResult), // Novo polje
  })
  .eq('id', invoiceId);
```

## Hitna akcija za korisnika

1. **Resetovati status fakture** u bazi (SQL gore)
2. Korisnik može ponovo pokušati slanje na SEF iz aplikacije
3. Ako problem persistira, proveriti API ključ i SEF podešavanja

## Opcija B: Proveriti direktno sa SEF API-jem

Možemo napraviti edge funkciju koja direktno pita SEF API za status ID-a `314264039` da vidimo šta SEF zapravo vraća za taj ID.

