
# Plan: Tri ispravke - PDF fakture, Download umesto Print, Profil u header dropdown

## 1. Ispravka "grayed out" faktura u PDF-u

Problem: PDF generator koristi `html2canvas` koji rasterizuje HTML u sliku. Tokom tog procesa, kod forsira kontrast i menja boje svih elemenata, ali logika za detekciju pozadinskih boja i teksta ponekad pogresno preboji elemente u svetlije nijanse - rezultat je "grayed out" izgled.

Resenje: U `src/hooks/usePdfGenerator.ts`:
- Povecati `contrastFactor` sa 1.15 na 1.3 za jasniji tekst
- Promeniti `mutedText` boju sa `#222222` na `#000000` i na desktopu (trenutno je crna samo na mobilnom)
- Forsirati `font-weight: bold` za sve `font-semibold` i `font-bold` elemente u klonu da ne izgube debljinu pri rasterizaciji
- Ukloniti prebojavanje `bg-secondary` elemenata u svetliju sivu jer ih to cini jedva vidljivim - ostaviti originalnu boju ili koristiti tamniju varijantu

## 2. Desktop: Download umesto Print

Problem: Na desktopu dugme kaze "Preuzmi" ali zapravo otvara print dijalog (`handlePrint()`). Na mobilnom postoji pravi PDF download. Treba ujednaciti - svuda koristiti download PDF.

Resenje: U `src/pages/InvoiceDetail.tsx` (linije 454-503):
- Ukloniti uslovni prikaz za mobile-only download dugme (linije 472-485)
- Promeniti dugme "Preuzmi/Stampaj" (linija 486-489) da poziva `handleDownloadPDF()` umesto `handlePrint()`
- Ikonu promeniti sa `Printer` na `Download`
- Tekst: "Preuzmi PDF" (ili "Sacuvaj PDF")
- Opciono: Potpuno ukloniti `handlePrint` funkciju (linije 283-378) posto se vise nece koristiti

## 3. Moj Profil u header dropdown + Promeni lozinku u Profil

Problem: "Moj Profil" je trenutno link u sidebar-u. "Promeni lozinku" je u header dropdown-u. Korisnik zeli:
- Dodati "Moj Profil" link u header user dropdown
- Premestiti "Promeni lozinku" iz header dropdown-a u stranicu Profila (vec postoji u Security tabu)
- Ukloniti "Moj Profil" iz sidebar profileGroup navigacije

Resenje:

**`src/components/AppLayout.tsx`:**
- U header dropdown (linija 364): Ukloniti `<ChangePasswordDialog asDropdownItem={true} />`
- Dodati `<DropdownMenuItem>` sa linkom na `/profile` i ikonom `User` sa tekstom "Moj Profil"
- U sidebar `profileGroup` (unutar `getFilteredNavItems`): Ukloniti `{ href: '/profile', label: 'Moj Profil', icon: Users }` iz niza

**`src/pages/Profile.tsx`:**
- "Promeni lozinku" vec postoji u Security tabu (linija 736) - ostaje tu
- Nema potrebe za dodatnim izmenama na Profile strani

---

## Tehnicki detalji - fajlovi koji se menjaju

| Fajl | Izmena |
|------|--------|
| `src/hooks/usePdfGenerator.ts` | Pojacati kontrast, popraviti boje teksta |
| `src/pages/InvoiceDetail.tsx` | Zamena Print dugmeta sa Download, uklanjanje handlePrint |
| `src/components/AppLayout.tsx` | Moj Profil u dropdown, uklanjanje Promeni lozinku iz dropdown-a, uklanjanje Moj Profil iz sidebar-a |
