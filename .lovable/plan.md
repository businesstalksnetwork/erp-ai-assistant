
# Plan: Ispravka uvoza SEF registra - nedostaju PIB-ovi

## Identifikovani problem

PIB `109003220` postoji u CSV fajlu sa 270,013 jedinstvenih PIB-ova, ali nije uvezen u bazu (235,602 uvezenih).

## Analiza uzroka

Nakon detaljnog pregleda koda, identifikovao sam dva potencijalna problema:

### Problem 1: Redosled parsiranja delimitera (manje verovatno)

U `sef-registry-import/index.ts` linija 101-105:
```typescript
// Komentar kaže "Try semicolon first" ali kod radi suprotno
let cols = parseCSVLine(line, ',');  // Prvo pokušava ZAREZ
if (cols.length < 3) {
  cols = parseCSVLine(line, ';');    // Pa onda tačka-zarez
}
```

CSV koristi tačka-zarez (`;`) kao delimiter. Iako bi fallback trebalo da radi, bolje je direktno koristiti ispravan delimiter.

### Problem 2: Glavni uzrok - Windows line endings (`\r`)

CSV fajl verovatno koristi Windows line endings (`\r\n`). Kada frontend pozove:
```typescript
const lines = text.split('\n')  // Linija 322
```

Svaka linija zadržava `\r` na kraju. Na primer:
```
"109003220;07355289;10.06.2022.;\r"
```

Kada se ovo parsira sa `parseCSVLine()` funkcijom koristeći `;` kao delimiter:
- `cols[0]` = `"109003220"` ✓
- `cols[1]` = `"07355289"` ✓  
- `cols[2]` = `"10.06.2022."` ✓
- `cols[3]` = `"\r"` ili `""` - ovo može praviti probleme

**Ali pravi problem je sa parseDate() funkcijom:**

```typescript
function parseDate(dateStr: string): string | null {
  const parts = dateStr.trim().split('.');
  if (parts.length !== 3) return null;  // <-- PROBLEM!
  // ...
}
```

Datum `10.06.2022.` ima 4 dela nakon split-a:
- `["10", "06", "2022", ""]`

Funkcija vraća `null` jer `parts.length` nije 3, već 4!

**Ali ovo ne objašnjava zašto PIB nedostaje** - datum je nullable u bazi.

### Problem 3: Pravi uzrok - gubitak podataka pri chunked upsert-u

Analizirajući proces:
1. Frontend deli 270k linija u 27 chunk-ova po 10,000
2. Svaki chunk se šalje na edge function
3. Edge function parsira i radi upsert

**Ključni uvid:** Ako postoji PIB koji ima više JBKJS vrednosti u CSV-u (duplicate PIB), i ti duplikati su u RAZLIČITIM chunk-ovima:
- Chunk 1: PIB `109003220` sa JBKJS `A` - uveze se ✓
- Chunk 5: PIB `109003220` sa JBKJS `B` - upsert ZAMENI prethodni ✓
- Chunk 15: PIB `109003220` sa JBKJS `C` - upsert ZAMENI prethodni ✓

Ali to ne objašnjava gubitak...

### Problem 4: PRAVI UZROK - upsert greške u batch-u

Kada upsert batch od 1000 redova ima grešku, CELI batch se odbacuje:

```typescript
if (error) {
  console.error(`Batch ${i / batchSize + 1} error:`, error);
  duplicates += batch.length;  // Broji celi batch kao "duplicate"
}
```

Ako samo JEDAN red u batch-u ima problem (npr. neispravan datum format), celi batch od 1000 PIB-ova se gubi!

## Tehnička rešenja

### Izmena 1: `supabase/functions/sef-registry-import/index.ts`

**Linija 101-105** - Ispraviti redosled delimitera:
```typescript
// Trenutno:
let cols = parseCSVLine(line, ',');
if (cols.length < 3) {
  cols = parseCSVLine(line, ';');
}

// Novo - prvo pokušaj tačka-zarez jer CSV koristi taj format:
let cols = parseCSVLine(line, ';');
if (cols.length < 3) {
  cols = parseCSVLine(line, ',');
}
```

### Izmena 2: `supabase/functions/sef-registry-import/index.ts`

**Linija 15-27** - Popraviti parseDate() da rukuje sa trailing tačkom:
```typescript
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Ukloni trailing tačku i \r ako postoji
  const cleanDate = dateStr.trim().replace(/\.?\r?$/, '');
  
  const parts = cleanDate.split('.');
  if (parts.length < 3) return null;
  
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  
  return `${year}-${month}-${day}`;
}
```

### Izmena 3: `supabase/functions/sef-registry-import/index.ts`

**Linije 137-152** - Dodati pojedinačni upsert kao fallback kada batch upsert ne uspe:
```typescript
for (let i = 0; i < entries.length; i += batchSize) {
  const batch = entries.slice(i, i + batchSize);
  
  const { error } = await supabase
    .from('sef_registry')
    .upsert(batch, { 
      onConflict: 'pib',
      ignoreDuplicates: false 
    });

  if (error) {
    console.error(`Batch ${i / batchSize + 1} error:`, error);
    
    // NOVO: Pokušaj pojedinačni upsert za svaki red u neuspelom batch-u
    for (const entry of batch) {
      const { error: singleError } = await supabase
        .from('sef_registry')
        .upsert([entry], { onConflict: 'pib', ignoreDuplicates: false });
      
      if (singleError) {
        console.error(`Single entry error for PIB ${entry.pib}:`, singleError);
        duplicates++;
      } else {
        imported++;
      }
    }
  } else {
    imported += batch.length;
  }
}
```

### Izmena 4: `src/pages/AdminPanel.tsx`

**Linija 322** - Dodati čišćenje Windows line endings:
```typescript
// Trenutno:
const lines = text.split('\n').filter(line => line.trim());

// Novo - očisti \r karaktere:
const lines = text.split('\n')
  .map(line => line.replace(/\r$/, ''))
  .filter(line => line.trim());
```

## Redosled implementacije

1. Izmeniti `parseDate()` funkciju za pravilno rukovanje datumima
2. Ispraviti redosled delimitera (`;` pa `,`)
3. Dodati čišćenje `\r` karaktera na frontendu
4. Dodati fallback pojedinačni upsert za neuspele batch-ove
5. Deploy edge function
6. Pokrenuti novi import sa opcijom "Obriši postojeće"

## Očekivani rezultat

Nakon ovih izmena, svih 270,013 jedinstvenih PIB-ova bi trebalo da budu uspešno uvezeni u bazu.
