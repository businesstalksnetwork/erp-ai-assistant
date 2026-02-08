

# Plan: Tacnih 365 dana za 8M klizni limit u grafikonu

## Problem

Trenutno `useLimitChartData` za 8M limit zaokruzuje na cele mesece -- prvi mesec pocinje od 1. tog meseca (npr. 1. feb 2025), a ne od tacnog datuma pre 365 dana (npr. 8. feb 2025). To znaci da grafikon moze prikazivati podatke van prozora od 365 dana ili propustiti neke.

## Resenje

Klipovati prvi mesec tako da pocinje tacno od `rollingStart` (danas - 364 dana), a ne od pocetka kalendarskog meseca. Ostali meseci ostaju puni kalendarski meseci, a poslednji mesec zavrsava danas.

### Primer:
- Danas: 08.02.2026
- Rolling start: 09.02.2025 (364 dana unazad = 365 dana ukljucujuci danas)
- Prvi mesec na grafiku: **09.02.2025 - 28.02.2025** (ne od 01.02.)
- Ostali meseci: puni kalendarski (mar 2025, apr 2025, ...)
- Poslednji mesec: 01.02.2026 - 08.02.2026

## Tehnicki detalji

### Fajl: `src/hooks/useLimitChartData.ts`

Izmena u `else` grani (linija 59-71) za 8M rolling limit:

1. Izracunati `rollingStart = subDays(todayDateOnly, 364)` pre formiranja meseci
2. Za prvi mesec (i === 11, najstariji): `start = rollingStart` umesto `startOfMonth(subMonths(...))`
3. Sve ostalo ostaje isto -- srednji meseci koriste pune kalendarske granice, poslednji mesec (i === 0) zavrsava na `todayDateOnly`

Izmenjeni kod:
```text
} else {
  const rollingStart = subDays(todayDateOnly, 364);
  for (let i = 11; i >= 0; i--) {
    const monthDate = subMonths(todayDateOnly, i);
    const calStart = startOfMonth(monthDate);
    // First month: clip to rolling start (exact 365 days)
    const start = i === 11 ? rollingStart : calStart;
    const end = i === 0 ? todayDateOnly : endOfMonth(calStart);
    months.push({
      start,
      end,
      label: format(calStart, 'MMM yy', { locale: sr }),
      key: format(calStart, 'yyyy-MM'),
    });
  }
}
```

Ovo osigurava da grafikon uvek prikazuje tacno 365 dana podataka, svaki dan, bez viska ili manjka.

