

# Plan: Ispravka PDF generisanja, teme i navigacije

## Problem 1: PDF flash (svetla tema bljesne na ekranu)

**Uzrok**: `usePdfGenerator.ts` na liniji 27-29 direktno uklanja `dark` klasu sa `document.documentElement`, sto uzrokuje da cela aplikacija na ekranu prebaci u svetlu temu dok se PDF generise. Ovo je vidljivo korisniku kao blesak.

**Resenje**: Umesto uklanjanja `dark` klase sa zivog DOM-a, raditi iskljucivo na kloniranom elementu unutar offscreen wrapper-a. Klon vec ima forsirane inline stilove (bela pozadina, crn tekst), tako da uklanjanje `dark` klase sa globalnog dokumenta uopste nije potrebno.

- Ukloniti linije 25-29 (uklanjanje dark klase)
- Ukloniti linije 362-365 u `finally` bloku (vracanje dark klase)
- Offscreen wrapper sa klasom `pdf-export` vec ima sve potrebne CSS override-ove u `index.css`

## Problem 2: Fakture "blurred/grayed out" na ekranu u dark mode-u

**Uzrok**: `boostCanvasContrast` funkcija (linije 262-288) primenjuje pixel-level kontrast pojacannje sa faktorom 1.3 na vec renderovan canvas. Ovo moze da pogorsa kvalitet slike, posebno ako su boje vec bile prilagodene. Takodje, `webkitTextFillColor` override na svim elementima (linija 156) moze da interferira sa renderovanjem.

**Resenje**: Ukloniti `boostCanvasContrast` poziv. Svi stilovi su vec forsirani na klonu (crn tekst, bela pozadina), pa pixel manipulacija nije potrebna i samo degradira kvalitet.

- Ukloniti `boostCanvasContrast` funkciju (linije 262-288) i njen poziv (linija 306)

## Problem 3: Navigacija na pogresnu stranicu pri refresh-u

**Uzrok**: Ovo je postojece ponasanje u `AppLayout.tsx` linije 101-116 - logika za redirect pri promeni kompanije koristi `isInitialMount` ref da spreci redirect na prvom renderovanju. Medjutim, pri refresh-u kompanija moze da se ucita asinhrono, sto izaziva "second mount" efekat gde se `isInitialMount` postavlja na `false` pre nego sto su podaci potpuno ucitani, a zatim se `companyChanged` detektuje kao `true` i vrsi redirect na `/dashboard`.

**Resenje**: Dodati uslov da se redirect vrsi samo ako je prethodni `prevCompanyIdRef.current` razlicit od `null` (tj. samo ako je korisnik aktivno promenio kompaniju, ne pri inicijalnom ucitavanju).

## Tehnicke izmene

### Fajl 1: `src/hooks/usePdfGenerator.ts`

1. **Ukloniti dark mode toggle sa zivog DOM-a** (linije 24-29):
   - Obrisati proveru `wasDarkMode` i uklanjanje `dark` klase
   
2. **Ukloniti `boostCanvasContrast`** (linije 262-288, 306):
   - Obrisati celu funkciju i njen poziv nakon `html2canvas`

3. **Ukloniti restauraciju dark mode-a u `finally`** (linije 362-365):
   - Obrisati `if (wasDarkMode)` blok

### Fajl 2: `src/components/AppLayout.tsx`

1. **Popraviti redirect logiku** (linije 110-115):
   - Dodati uslov: `if (companyChanged && prevCompanyIdRef.current !== null && isViewingClientCompany ...)`
   - Ovo osigurava da se redirect desava samo pri eksplicitnoj promeni kompanije, ne pri refresh-u stranice

