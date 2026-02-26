

# Import kontnog plana iz XLSX fajla

## Analiza ulaznih podataka

Fajl `kontni_plan.xlsx` sadrzi **~2,356 konta** iz BizniSoft sistema — kompletni srpski propisani kontni plan (klase 0-9). Svaki red ima:

| Kolona | Primer | Mapiranje |
|--------|--------|-----------|
| Račun (col 2) | `0000`, `411`, `60` | `code` |
| Naziv računa (col 3) | UPISANE A NEUPLAĆENE OBIČNE AKCIJE | `name` / `name_sr` |
| Karakter | Dugovni / Potražni | metadata (debit/credit nature) |
| Knjiženje | dozvoljeno / zabranjeno | determines if account is a posting account or group header |
| Devizni | True/False | metadata — can store in description |
| Šifra PDV knjiženja | PDV mapping code | linkage to PDV rules |

## Mapiranje srpskih klasa na account_type

Sistem koristi 5 tipova: `asset`, `liability`, `equity`, `revenue`, `expense`. Srpski kontni okvir:

```text
Klasa 0 → asset        (Nematerijalna i osnovna sredstva)
Klasa 1 → asset        (Zalihe, potraživanja)
Klasa 2 → liability    (Kratkoročne obaveze i PVR)
Klasa 3 → asset        (Kratkoročni plasmani, gotovina — 24x bankarski, 10x-13x materijal)
Klasa 4 → liability    (Dugoročne obaveze, kapital — 40x-42x kapital=equity, 43x-49x=liability)
Klasa 5 → expense      (Troškovi)
Klasa 6 → revenue      (Prihodi)
Klasa 7 → revenue      (Ostali prihodi i dobici)
Klasa 8 → equity       (Vanbilansne — ali za potrebe sistema equity)
Klasa 9 → expense      (Obračun troškova — klasa 9)
```

Finija granulacija za klasu 4:
- `40x`, `41x`, `42x` → `equity` (Kapital, rezerve, nerasporedjeni dobitak)
- `43x`-`49x` → `liability` (Dugoročne obaveze, dugoročna PVR)

## Hijerarhija (parent_id)

Kod duži od 1 cifre ima roditelja. Roditelj se odredjuje skraćivanjem koda za jednu cifru:
- `0000` → parent `000`
- `000` → parent `00`
- `00` → parent `0`
- `0` → nema roditelja (root, level=1)

Level = dužina koda (`0`=1, `00`=2, `000`=3, `0000`=4).

## Plan implementacije

### 1. Edge function: `import-kontni-plan`

Nova edge funkcija koja:
- Prima XLSX fajl kao FormData upload (ili JSON sa parsiranim redovima)
- Parsira redove iz XLSX formata
- Za svaki red:
  - Izvlači `code` i `name` iz kolona
  - Računa `account_type` po prefiks-logici iznad
  - Računa `level` = `code.length`
  - Obeležava `is_system = true` (propisani kontni plan)
  - Čuva `name_sr = name` i `name = name` (isti tekst, sve srpski)
  - Čuva `Knjiženje` info u `description` (npr. "Karakter: Dugovni, Knjiženje: dozvoljeno, Devizni: Da")
- **Faza 1**: Upsert svih konta (batch po 100, conflict on `tenant_id, code`)
- **Faza 2**: Update `parent_id` za sve konta — za svaki kod skraćuje za 1 cifru i traži roditelja
- Vraća `{ inserted, updated, skipped, errors }`

Medjutim, posto XLSX parsiranje u Deno edge funkcijama zahteva eksternu biblioteku, **bolji pristup** je parsiranje na klijentskoj strani (u browseru koristeci vec dostupne alate) i slanje JSON podataka na backend.

### Konačni pristup: Klijentski import u ChartOfAccounts.tsx

Posto vec postoji `importChartOfAccounts` logika u `import-legacy-zip`, i posto je BizniSoft fajl Excel (ne CSV), najprakticniji pristup je:

**Parsiranje na frontendu** koristeći `xlsx` NPM biblioteku (SheetJS), pa upsert u Supabase direktno sa klijenta.

### 2. Dodati `xlsx` dependency

Dodati `xlsx` (SheetJS) paket za parsiranje Excel fajlova u browseru.

### 3. Izmene u `ChartOfAccounts.tsx`

Dodati dugme **"Uvezi kontni plan"** (Import) pored postojećeg "+" dugmeta koje:

1. Otvara file input dialog za `.xlsx` fajlove
2. Parsira XLSX koristeći SheetJS
3. Prikazuje preview dialog sa brojem konta po klasi i potvrdom
4. Na potvrdu, izvršava batch upsert u 2 faze:
   - **Faza 1**: Insert/upsert svih konta (bez parent_id)
   - **Faza 2**: Fetch svih unetih konta, izračunaj parent_id, batch update

UI preview dialog prikazuje:
```text
Ukupno konta: 2,356
├── Klasa 0 (Sredstva): 245
├── Klasa 1 (Zalihe): 312
├── ...
Knjiženje dozvoljeno: 1,847
Grupe (zabranjeno): 509
Postojeća konta: 85 (biće preskočena)

[Uvezi] [Otkaži]
```

### 4. Mapiranje kolona iz XLSX-a

```typescript
// Column indices from parsed XLSX
// Col 0: "+" marker (skip)
// Col 1: Račun (code)
// Col 2: Naziv računa (name)
// Col 3: Analitika
// Col 4: Karakter (Dugovni/Potražni)
// Col 5: Knjiženje (dozvoljeno/zabranjeno)
// Col 6: Devizni (True/False)
// Col 13: Šifra PDV knjiženja

function mapAccountType(code: string): string {
  const cls = code.charAt(0);
  if (cls === '0') return 'asset';
  if (cls === '1') return 'asset';
  if (cls === '2') return 'liability';
  if (cls === '3') return 'asset';
  if (cls === '4') {
    const sub = code.substring(0, 2);
    if (['40','41','42'].includes(sub)) return 'equity';
    return 'liability';
  }
  if (cls === '5') return 'expense';
  if (cls === '6') return 'revenue';
  if (cls === '7') return 'revenue';
  if (cls === '8') return 'equity';
  if (cls === '9') return 'expense';
  return 'asset';
}
```

### 5. Povezivanje sa zavisnostima i pravilima

Nakon importa, konta se automatski koriste kroz:
- **Posting Rules Engine** — `findPostingRule` / `resolvePostingRuleToJournalLines` traži konta po `code` u `chart_of_accounts`
- **Journal Entries** — sva knjiženja referenciraju `account_id` iz `chart_of_accounts`
- **Financial Reports** — Balance Sheet, Income Statement, Trial Balance filtriraju po `account_type`
- **PDV Evidence** — konta sa PDV šiframa se mogu koristiti za automatsko mapiranje PDV knjiženja

Posle importa, dodati opciju **"Poveži PDV šifre"** koja mapira `Šifra PDV knjiženja` kolonu na PDV entitete u sistemu.

### 6. Translations

Novi ključevi: `importChartOfAccounts`, `importPreview`, `accountClasses`, `postingAllowed`, `postingForbidden`, `importSuccess`, `importProgress`.

## Sumarni pregled izmena

| Fajl | Izmena |
|------|--------|
| `package.json` | Dodati `xlsx` dependency |
| `src/pages/tenant/ChartOfAccounts.tsx` | Dodati Import dugme, XLSX parsing, preview dialog, batch upsert sa parent_id resolution |
| `src/i18n/translations.ts` | Novi prevodi za import funkcionalnost |

~150 linija novog koda u ChartOfAccounts.tsx (import logika + preview dialog).

Nema potrebe za novom edge funkcijom — sve se radi na klijentu sa direktnim Supabase upsert-om, sto je konzistentno sa postojećom CRUD logikom na stranici.

