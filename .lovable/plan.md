

# Plan: E2E testiranje i optimizacija responzivnosti

## Pregled

Kompletan prolaz kroz aplikaciju sa ciljem: (1) kreiranje E2E testova za kriticne tokove, (2) popravke responzivnosti i mobile optimizacije na svim stranicama.

---

## Deo 1: E2E testovi (Playwright)

Kreirati testove u `e2e/` folderu za sledece tokove:

### Test 1: `e2e/auth.spec.ts` - Autentifikacija
- Landing page se ucitava
- Navigacija na /auth
- Login forma se prikazuje
- Signup forma se prikazuje (tab switch)
- Validacija praznih polja

### Test 2: `e2e/navigation.spec.ts` - Navigacija
- Sidebar linkovi vode na ispravne rute
- Mobile meni se otvara/zatvara
- Header dropdown prikazuje "Moj Profil"
- Company selector se prikazuje

### Test 3: `e2e/invoice-flow.spec.ts` - Fakture
- Lista faktura se ucitava
- Filter i pretraga rade
- "Nova faktura" dugme vodi na /invoices/new
- Forma za novu fakturu se prikazuje sa svim sekcijama

### Test 4: `e2e/responsive.spec.ts` - Responzivnost
- Kljucne stranice se renderuju bez horizontal scroll-a na 375px sirini
- Mobile kartica layout na Invoices listi
- Dashboard kartice se pravilno slazu

---

## Deo 2: Responzivnost i Mobile optimizacija

Nakon detaljnog pregleda svih stranica, identifikovao sam sledece oblasti za poboljsanje:

### 2.1 NewInvoice.tsx (1445 linija)
**Problem**: Forma za novu fakturu ima `max-w-4xl mx-auto` sto ogranicava sirinu, ali neke interne sekcije nemaju mobile-friendly layout.
- Stavke fakture (items): tabela sa inputima moze biti teska za koristiti na mobilnom
- Submit dugmad na dnu: `flex gap-4` moze biti bolje sa `flex-col sm:flex-row`
- Client combobox popover moze biti sirok na mobilnom

**Ispravke**:
- Dodati `w-full` na submit dugmad za mobile: `flex flex-col sm:flex-row gap-2 sm:gap-4`
- Stavke: na mobilnom koristiti vertikalni stack umesto horizontalnog grid-a
- Smanjiti padding na CardHeader za mobile

### 2.2 KPOBook.tsx (642 linija)
**Problem**: Tabela sa KPO unosima moze biti siroka na mobilnom.
**Ispravke**:
- Dodati `overflow-x-auto` na Table wrapper
- Na mobilnom prikazati skracene nazive kolona ili sakriti manje bitne kolone

### 2.3 FiscalCashRegister.tsx (336 linija)
**Problem**: Tabs mogu biti preuski na mobilnom, summary kartice mogu overflow-ovati.
**Ispravke**:
- TabsList: dodati `w-full` i `grid grid-cols-2` na mobilnom
- Summary kartice: `grid-cols-2` umesto `grid-cols-4` na malim ekranima

### 2.4 SEFCenter.tsx (1775 linija)
**Problem**: Najkompleksnija stranica - tabele, filteri, i mnogo akcija.
**Ispravke**:
- Tabela: `overflow-x-auto` sa `min-w-[600px]` na Table
- Mobile card view za SEF fakture (slicno kao Invoices.tsx)
- Filter sekcija: stack vertikalno na mobilnom
- Bulk actions dugmad: stack na mobilnom

### 2.5 Documents.tsx (628 linija)
**Problem**: File upload i folder navigacija na mobilnom.
**Ispravke**:
- Grid za foldere: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Upload dugme: full width na mobilnom
- File tabela: overflow-x-auto + mobile card view

### 2.6 Reminders.tsx (1594 linija)
**Problem**: Duga forma za kreiranje podsetnika, tabela za listu.
**Ispravke**:
- Dialog za novi podsetnik: sirinu prilagoditi mobilnom
- Tabela: mobile card view
- Tab navigation: horizontalni scroll za TabsList

### 2.7 Profile.tsx (1249 linija)
**Problem**: Settings tab sa mnostvom switch-eva moze biti nepregledan.
**Ispravke**:
- TabsList: dodati horizontalni scroll na mobilnom ili koristiti `grid grid-cols-2 sm:grid-cols-4`
- Push notification karta: stack dugme ispod switch-a na mobilnom

### 2.8 InvoiceAnalytics.tsx
**Ispravke**:
- Grafikon: responsive visina
- Stat kartice: `grid-cols-2` na mobilnom

### 2.9 Index.tsx (Landing page) (520 linija)
**Ispravke**:
- Stats grid: `grid-cols-2` na mobilnom (vec implementirano)
- Hero sekcija: proveriti font velicine
- Comparison tabela: horizontal scroll na mobilnom

### 2.10 AppLayout.tsx - Mobile bottom navigation
**Problem**: Na mobilnom korisnik mora otvoriti hamburger meni za navigaciju, sto zahteva dva klika.
**Ispravke**:
- Dodati opcioni bottom tab bar sa 4-5 najvaznijih linkova (Dashboard, Fakture, KPO, Podsetnici, Vise)
- `fixed bottom-0` sa `pb-safe` za safe area na iPhone-ima

---

## Tehnicki detalji

### Fajlovi koji se kreiraju
| Fajl | Opis |
|------|------|
| `e2e/auth.spec.ts` | Auth flow testovi |
| `e2e/navigation.spec.ts` | Navigacija testovi |
| `e2e/invoice-flow.spec.ts` | Fakture flow testovi |
| `e2e/responsive.spec.ts` | Responzivnost testovi |

### Fajlovi koji se menjaju
| Fajl | Opis |
|------|------|
| `src/pages/NewInvoice.tsx` | Mobile layout za formu i stavke |
| `src/pages/KPOBook.tsx` | Overflow-x, mobile card view |
| `src/pages/FiscalCashRegister.tsx` | Grid i tabs mobile layout |
| `src/pages/SEFCenter.tsx` | Mobile card view, filter stack |
| `src/pages/Documents.tsx` | Grid, upload, mobile cards |
| `src/pages/Reminders.tsx` | Dialog i tabela mobile |
| `src/pages/Profile.tsx` | TabsList, switch layout |
| `src/pages/InvoiceAnalytics.tsx` | Responsive grafikon |
| `src/pages/Index.tsx` | Comparison tabela scroll |
| `src/components/AppLayout.tsx` | Mobile bottom navigation bar |
| `src/index.css` | Safe area i bottom nav utility klase |

### Prioritet implementacije
1. E2E testovi (osnova za validaciju)
2. AppLayout bottom navigation (najveci UX uticaj)
3. SEFCenter mobile card view (najkompleksnija stranica)
4. NewInvoice mobile optimizacija (najcesci korisnikov tok)
5. Ostale stranice (KPO, Fiscal, Documents, Reminders, Profile)
6. Landing page i Analytics

