

# Plan: Podsetnici tabovi - scroll na pocetak i default prikaz

## Problem

Na mobilnom, TabsList je scrollable ali pocetna pozicija scrolla moze biti pomerena udesno, tako da prvi tab "Mesec" (currentMonth) nije vidljiv. Korisnik vidi samo srednje/desne tabove.

## Resenje

### Izmene u `src/pages/Reminders.tsx`

1. **Dodati `useRef` i `useEffect`** za TabsList kontejner koji ce na mount i pri promeni activeTab-a skrolovati aktivni tab u vidljivo podrucje.

2. **Konkretno**:
   - Kreirati `const tabsListRef = useRef<HTMLDivElement>(null)`
   - Dodati `useEffect` koji na mount resetuje `scrollLeft = 0` da "Mesec" bude prvi vidljiv tab
   - Dodati drugi `useEffect` koji pri promeni `activeTab` pronalazi aktivni `[data-state=active]` element i poziva `scrollIntoView({ inline: 'nearest', behavior: 'smooth' })` da se aktivni tab uvek vidi
   - Proslediti ref na TabsList: zamenom TabsList sa `div` wrapperom koji drzi ref, ili direktno na TabsList koristeci `ref` prop (Radix TabsList prima ref)

3. **Osigurati da `defaultValue="currentMonth"`** ostaje i da je scroll pozicija 0 na pocetku

### Fajl koji se menja

| Fajl | Izmena |
|------|--------|
| `src/pages/Reminders.tsx` | Dodati ref na TabsList, useEffect za scroll na pocetak i scroll-into-view aktivnog taba |

