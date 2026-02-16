

# Plan: Podsetnici - razumljiv tab navigation na mobilnom

## Problem

Na mobilnom ekranu, TabsList prikazuje samo ikonice i brojeve (badge), bez ikakvog teksta. Korisnik vidi npr. kalendar ikonu i broj "4", trougao upozorenja i "0", ali ne zna sta koja ikonica znaci. Razlog: sav tekst je sakriven sa `hidden sm:inline` klasom.

## Resenje

Zameniti trenutni `flex-wrap` TabsList sa horizontalnim scroll kontejnerom i prikazati skracene tekstualne labele na mobilnom umesto sakrivanja teksta.

### Izmene u `src/pages/Reminders.tsx` (linije 1195-1226)

**TabsList**: Promeniti iz `flex flex-wrap` u `overflow-x-auto flex-nowrap` za horizontalni scroll.

**Svaki TabsTrigger**: Umesto `hidden sm:inline` na tekstu, koristiti kratke labele vidljive na svim velicinama:

| Tab | Trenutno (skriveno na mob) | Novo (mobilno) | Desktop |
|-----|---------------------------|-----------------|---------|
| currentMonth | Tekuci mesec | Mesec | Tekuci mesec |
| nextThreeMonths | Naredna 3 meseca | 3 mes. | Naredna 3 meseca |
| untilEndOfYear | Do kraja godine | Godina | Do kraja godine |
| overdue | Istekli | Istekli | Istekli |
| archived | Arhivirano | Arhiva | Arhivirano |
| all | Svi | Svi | Svi |

Konkretno za svaki trigger:
- Ukloniti `hidden sm:inline` sa `<span>` elementa
- Dodati dve verzije teksta: kratku za mobile (`sm:hidden`) i dugu za desktop (`hidden sm:inline`)
- Smanjiti `min-w-[120px]` na `min-w-fit` za kompaktniji prikaz
- Dodati `whitespace-nowrap` i `text-xs sm:text-sm` za velicinu fonta

**TabsList wrapper**: Dodati `overflow-x-auto scrollbar-hide` i `flex-nowrap` umesto `flex-wrap` da tabovi budu u jednom redu sa horizontalnim scrollom.

### Fajlovi koji se menjaju

| Fajl | Izmena |
|------|--------|
| `src/pages/Reminders.tsx` | TabsList i TabsTrigger - vidljive kratke labele na mobilnom, horizontalni scroll |

