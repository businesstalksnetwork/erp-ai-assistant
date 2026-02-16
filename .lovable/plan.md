
# Plan: Logo vidljiv u oba moda na mobilnom headeru

## Problem
Mobilni header koristi `logoLight` (tamni logo) koji nije citljiv na tamnoj pozadini u dark modu.

## Resenje

### Fajl: `src/components/AppLayout.tsx`

Promeniti mobilni header da koristi logo na osnovu trenutne teme:
- Light mode: `logoLight` (tamni logo na svetloj pozadini)
- Dark mode: `logoDark` (svetli logo na tamnoj pozadini)

Linija sa `<img src={logoLight}` u mobilnom headeru se menja u:
```tsx
<img src={theme === 'dark' ? logoDark : logoLight} alt="Paušal box" className="h-10" />
```

`theme` je vec dostupan iz `useTheme()` hook-a koji se vec koristi u komponenti. `logoDark` je vec importovan.

Jedna linija izmene, bez novih importa.
