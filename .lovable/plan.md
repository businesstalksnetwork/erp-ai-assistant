

## Ispravka: "Istorija verzija" tab otvara popup koji ne moze da se zatvori

### Problem
Na stranici detalja ponude (QuoteDetail), tab "Istorija verzija" koristi komponentu `QuoteVersionHistory` koja je `Dialog` (popup). Kada se renderuje unutar taba sa `open={true}` i `onOpenChange={() => {}}`, prikazuje se kao modalni popup koji se ne moze zatvoriti.

### Resenje

Napraviti dva rezima prikaza u `QuoteVersionHistory` komponenti:
- **Dialog rezim** (podrazumevani) — za dugme "Istorija verzija" koje otvara popup
- **Inline rezim** — za tab "Istorija verzija" gde se sadrzaj prikazuje direktno bez Dialog omotaca

### Izmene fajlova

**1. `src/components/quotes/QuoteVersionHistory.tsx`**
- Dodati opcioni prop `inline?: boolean`
- Kada je `inline={true}`, renderovati samo listu verzija bez `Dialog`, `DialogContent`, `DialogHeader` omotaca
- Kada je `inline={false}` (podrazumevano), zadrzati postojece ponasanje sa Dialog-om

**2. `src/pages/tenant/QuoteDetail.tsx`** (linija ~340)
- Promeniti poziv u "versions" tabu da koristi `inline` rezim:

Trenutno:
```tsx
<QuoteVersionHistory open={true} onOpenChange={() => {}} quoteId={id!} />
```

Novo:
```tsx
<QuoteVersionHistory open={true} onOpenChange={() => {}} quoteId={id!} inline />
```

Ovo ce prikazati listu verzija direktno u tabu bez modalnog popup-a, dok dugme "Istorija verzija" (linija 249) i dalje otvara normalan dialog koji se moze zatvoriti.
