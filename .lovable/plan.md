

# Plan: Kompletna ispravka SEF registry uvoza

## Identifikovani problemi

### Problem 1: PIB validacija je previše stroga
**Linija 117** trenutno zahteva tačno 9 cifara:
```typescript
if (!pib || pib.length !== 9) {
```

Ali korisnik je pojasnio da PIB može imati **9 ili 13 cifara**. Svi 13-cifreni PIB-ovi se odbacuju!

### Problem 2: Duplikati u batch-u
Greška `ON CONFLICT DO UPDATE command cannot affect row a second time` znači da u jednom batch-u od 1000 redova postoje isti PIB-ovi. Potrebna je deduplication pre upsert-a.

## Tehnička rešenja

### Izmena 1: Prihvatiti PIB od 9 ili 13 cifara

**Fajl:** `supabase/functions/sef-registry-import/index.ts`  
**Linije 115-120** - Promeniti validaciju:

```typescript
// Trenutno:
const pib = cols[0].replace(/\D/g, ''); // Keep only digits

if (!pib || pib.length !== 9) {
  parseErrors++;
  continue;
}

// Novo - prihvati 9 ili 13 cifara:
const pibRaw = cols[0].replace(/\D/g, ''); // Keep only digits

// PIB can be 9 or 13 digits
if (!pibRaw || (pibRaw.length !== 9 && pibRaw.length !== 13)) {
  parseErrors++;
  continue;
}

// Use first 9 digits as the primary PIB identifier
const pib = pibRaw.substring(0, 9);
```

**Napomena:** Čuvamo samo prvih 9 cifara jer:
- 9-cifreni PIB = osnovni identifikator firme
- 13-cifreni = 9 cifara PIB + 4 cifre za organizacionu jedinicu
- Za proveru SEF registracije, dovoljno je prvih 9

### Izmena 2: Deduplication pre batch upsert-a

**Fajl:** `supabase/functions/sef-registry-import/index.ts`  
**Posle linije 133** - Dodati deduplication:

```typescript
console.log(`Parsed ${entries.length} valid entries, ${parseErrors} errors`);

// Deduplicate entries by PIB (keep last occurrence)
const uniqueEntries = Array.from(
  new Map(entries.map(entry => [entry.pib, entry])).values()
);

console.log(`Deduplicated to ${uniqueEntries.length} unique PIBs`);
```

### Izmena 3: Koristiti uniqueEntries u batch loop-u

**Linije 140, 172** - Zameniti `entries` sa `uniqueEntries`:

```typescript
for (let i = 0; i < uniqueEntries.length; i += batchSize) {
  const batch = uniqueEntries.slice(i, i + batchSize);
  // ...
}
```

```typescript
console.log(`Progress: ${i + batch.length}/${uniqueEntries.length}`);
```

## Rezime svih izmena

| Linija | Izmena |
|--------|--------|
| 115-120 | PIB validacija: prihvati 9 ili 13 cifara, koristi prvih 9 |
| 133+ | Dodaj deduplication pomoću Map |
| 140 | Loop koristi `uniqueEntries` umesto `entries` |
| 172 | Progress log koristi `uniqueEntries.length` |

## Koraci implementacije

1. Ažurirati PIB validaciju (9 ili 13 cifara → čuvaj prvih 9)
2. Dodati deduplication logiku
3. Ažurirati batch loop da koristi deduplicirane unose
4. Deploy edge function
5. Pokrenuti import sa "Obriši postojeće"

## Očekivani rezultat

Svih 270,013 jedinstvenih PIB-ova će biti uspešno uvezeno bez grešaka.

