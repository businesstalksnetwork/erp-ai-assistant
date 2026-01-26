
# Plan: Kompletno poboljšanje Dark Mode stilova (posle logina)

## Pregled problema

Aplikacija koristi CSS varijable sa HSL vrednostima za teme, ali na nekim mestima koriste se hardkodirane boje koje nemaju dark mode varijante. Evo identifikovanih problema po stranicama:

## Problemi po stranicama

### 1. BookkeeperSettings.tsx (linije 87-117)
**Problem:** Status badge-ovi koriste hardkodirane boje bez dark varijanti:
- `bg-amber-50` - nevidljivo u dark mode
- `bg-green-50` - nevidljivo u dark mode  
- `bg-red-50` - nevidljivo u dark mode

**Rešenje:** Dodati dark varijante:
```
bg-amber-50 → bg-amber-50 dark:bg-amber-950
text-amber-600 → text-amber-600 dark:text-amber-400
border-amber-300 → border-amber-300 dark:border-amber-700

bg-green-50 → bg-green-50 dark:bg-green-950
text-green-600 → text-green-600 dark:text-green-400
border-green-300 → border-green-300 dark:border-green-700

bg-red-50 → bg-red-50 dark:bg-red-950
text-red-600 → text-red-600 dark:text-red-400
border-red-300 → border-red-300 dark:border-red-700
```

### 2. Profile.tsx (linije 352, 399, 428)
**Problem:** Baneri koriste hardkodirane boje:
- Partner discount banner: `bg-green-50` (linija 428)
- Subscription warning: `bg-orange-50` (linija 399)
- Bookkeeper badge: `bg-green-50` (linija 352)

**Rešenje:** Već ima delimično rešeno ali treba proveriti:
- `bg-green-50 dark:bg-green-950` - OK
- `bg-green-100 dark:bg-green-900` - dodati
- `bg-orange-50` → dodati `dark:bg-orange-950`

### 3. Invoices.tsx (linije 230, 260-268)
**Problem:** Payment status badge-ovi:
- `bg-green-500` za "Plaćeno" - OK (koristi čistu boju)
- `bg-yellow-500` za "Delimično" - OK
- `bg-orange-500` za avansne - OK

**Status:** Ove boje rade u oba moda jer su dovoljno zasićene.

### 4. FiscalCashRegister.tsx (linije 100-122)
**Problem:** Summary kartice koriste hardkodirane boje:
- `text-green-600` / `text-green-500` - treba proveriti kontrast
- `text-red-600` / `text-red-500` - treba proveriti kontrast
- Kartice koriste CSS varijable (`bg-primary`) - OK

**Status:** Uglavnom OK, ali može se poboljšati dodavanjem dark varijanti za tekst.

### 5. SEFCenter.tsx (linije 56-86)
**Problem:** Status badge-ovi su definisani sa custom varijantama:
- Koristi `variant: 'success'` i `variant: 'secondary'` - treba proveriti Badge komponentu

**Status:** Ako Badge komponenta ima proper dark mode podršku za `success` varijantu, onda je OK.

### 6. Reminders.tsx
**Problem:** Recurrence type badge-ovi mogu koristiti hardkodirane boje.

**Rešenje:** Proveriti i dodati dark varijante ako je potrebno.

### 7. AdminPanel.tsx
**Problem:** Tabela korisnika i stat kartice mogu imati problema sa hover state-ovima.

**Rešenje:** Proveriti hover boje na tabelama.

### 8. Clients.tsx (linije 341-362)
**Problem:** SEF status indikatori:
- `text-green-600 dark:text-green-500` - Već ima dark varijantu
- `text-amber-600 dark:text-amber-500` - Već ima dark varijantu

**Status:** OK - već implementirano.

## Tehničke izmene

### Fajl 1: `src/pages/BookkeeperSettings.tsx`

**Linije 91-116** - Funkcija `getBookkeeperStatusBadge`:

Trenutno:
```typescript
case 'pending':
  return (
    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
```

Novo:
```typescript
case 'pending':
  return (
    <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950">
```

Isto za `accepted` (green) i `rejected` (red) case-ove.

### Fajl 2: `src/pages/Profile.tsx`

**Linija 352** - Bookkeeper free badge:
```typescript
// Trenutno:
className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg"

// Proveriti da ima dark varijantu - ako nema, dodati
```

**Linija 399** - Subscription warning:
```typescript
// Trenutno:
className={`p-4 rounded-lg ${isSubscriptionExpired ? 'bg-destructive/10' : 'bg-orange-50 dark:bg-orange-950'}`}

// Već ima dark varijantu - OK
```

**Linija 428-438** - Partner discount banner:
```typescript
// Trenutno ima:
className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800"

// Unutrašnji div:
className="p-2 bg-green-100 dark:bg-green-900 rounded-full"

// Tekst boje:
className="font-medium text-green-700 dark:text-green-300"
className="text-sm text-green-600 dark:text-green-400"

// Sve ima dark varijante - OK
```

### Fajl 3: `src/pages/Reminders.tsx`

Potražiti bilo koje korišćenje hardkodiranih boja u badge-ovima za recurrence type i dodati dark varijante.

### Fajl 4: `src/pages/AdminPanel.tsx`

Proveriti stat kartice i tabelu korisnika za hover state-ove. Većina koristi CSS varijable koje automatski reaguju na temu.

### Fajl 5: `src/pages/Invoices.tsx`

**Linija 230** - Avansna faktura badge:
```typescript
// Trenutno:
className={invoice.advance_status === 'open' ? 'bg-orange-500 text-white' : ''}

// Orange-500 je dovoljno zasićena, radi u oba moda - OK
```

### Fajl 6: `src/pages/FiscalCashRegister.tsx`

**Linije 100-122** - Summary kartice tekst:
```typescript
// Trenutno:
className="text-2xl font-bold text-green-600"
className="text-2xl font-bold text-red-600"

// Dodati dark varijante za bolji kontrast:
className="text-2xl font-bold text-green-600 dark:text-green-400"
className="text-2xl font-bold text-red-600 dark:text-red-400"
```

**Linije 192-199** - Tabela boje:
```typescript
// Trenutno:
className="text-right font-mono text-green-600"
className="text-right font-mono text-red-600"

// Dodati dark varijante:
className="text-right font-mono text-green-600 dark:text-green-400"
className="text-right font-mono text-red-600 dark:text-red-400"
```

### Fajl 7: `src/components/ui/badge.tsx`

Proveriti da `success` i `warning` varijante imaju proper dark mode podršku. Trenutno:
```typescript
success: "border-transparent bg-success text-success-foreground hover:bg-success/90 hover:scale-105",
warning: "border-transparent bg-warning text-warning-foreground hover:bg-warning/90 hover:scale-105",
```

Ovo koristi CSS varijable (`bg-success`, `text-success-foreground`) koje bi trebalo da rade ako su pravilno definisane u `index.css`.

## Sažetak izmena

| Fajl | Tip izmena | Prioritet |
|------|------------|-----------|
| `src/pages/BookkeeperSettings.tsx` | Badge dark varijante (3 statusa) | Visok |
| `src/pages/FiscalCashRegister.tsx` | Tekst boje za summary i tabelu | Srednji |
| `src/pages/Profile.tsx` | Provera postojećih dark varijanti | Nizak (već OK) |
| `src/pages/Invoices.tsx` | Provera badge boja | Nizak (već OK) |
| `src/pages/Clients.tsx` | Već implementirano | OK |
| `src/pages/Reminders.tsx` | Proveriti recurrence badge-ove | Nizak |

## Očekivani rezultat

- Svi status badge-ovi će biti čitljivi u dark mode-u
- Tekst u summary karticama će imati dovoljan kontrast
- Aplikacija će izgledati konzistentno u oba moda

## Napomena

Većina stranica već koristi Tailwind CSS varijable (`text-muted-foreground`, `bg-card`, `border-border`) koje automatski reaguju na dark mode. Problemi su uglavnom u specifičnim badge-ovima i indikatorima koji koriste hardkodirane boje.
