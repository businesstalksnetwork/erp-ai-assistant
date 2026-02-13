

# Add Section Sub-Groups to All Sidebar Modules

Apply the same section-divider pattern already used in Inventory to every module that has 5+ items. Modules with fewer items (Purchasing, Production, Web, Returns) stay flat since they don't benefit from sub-grouping.

## Modules to Reorganize

### Accounting (15 items -> 4 sections)

**Knjizenje (Bookkeeping)**
- Kontni plan (Chart of Accounts)
- Nalozi za knjizenje (Journal Entries)
- Glavna knjiga (General Ledger)

**Fakturisanje i placanja (Invoicing and Payments)**
- Fakture (Invoices)
- Izvodi (Bank Statements)
- Otvorene stavke (Open Items)
- Kompenzacija

**Osnovna sredstva i obracuni (Assets and Accruals)**
- Osnovna sredstva (Fixed Assets)
- Razgranicenja (Deferrals)
- Krediti (Loans)
- Kursne razlike (FX Revaluation)

**Poresko i zatvaranje (Tax and Closing)**
- PDV periodi
- Fiskalni periodi
- Zakljucenje godine (Year-End)
- Izvestaji (Reports)

### CRM (7 items -> 2 sections)

**Pregled (Overview)**
- CRM kontrolna tabla (Dashboard)

**Evidencija (Records)**
- Kompanije, Kontakti, Lidovi, Prilike, Sastanci, Partneri

### Sales (6 items -> 2 sections)

**Dokumenta (Documents)**
- Ponude (Quotes)
- Prodajni nalozi (Sales Orders)

**Performanse i cene (Performance and Pricing)**
- Kanali prodaje, Prodavci, Performanse prodaje, Maloprodajne cene

### HR (19 items -> 5 sections)

**Organizacija (Organization)**
- Zaposleni, Ugovori, Odeljenja, Sabloni pozicija

**Radno vreme (Working Time)**
- Radni nalozi, Prekovremeni, Nocni rad, Prisustvo

**Odsustva (Leave)**
- Godisnji odmor, Praznici, Zahtevi za odsustvo

**Zarade i naknade (Compensation)**
- Odbici, Dodaci, Istorija plata, Obracun zarada

**Ostalo (Other)**
- Eksterni radnici, Osiguranje, eBolovanje, HR Izvestaji

### Documents (7 items -> 2 sections)

**Delovodnik (Registry)**
- Delovodnik, Arhivska knjiga, Arhiviranje

**Upravljanje (Management)**
- Projekti, Pretraga, Izvestaji, Podesavanja

### POS (4 items -> 2 sections)

**Terminal**
- POS terminal

**Administracija (Administration)**
- Sesije, Fiskalni uredjaji, Dnevni izvestaj

### Settings (9 items -> 3 sections)

**Opstа podesavanja (General)**
- Podesavanja kompanije, Poreske stope, Valute

**Pristup i kontrola (Access and Control)**
- Korisnici, Tokovi odobrenja, Odobrenja na cekanju

**Sistem (System)**
- Integracije, Revizorski trag, Monitor dogadjaja

## Translation Keys to Add

New section keys needed (both `en` and `sr`):

| Key | English | Serbian |
|-----|---------|---------|
| bookkeeping | Bookkeeping | Knjizenje |
| invoicingPayments | Invoicing & Payments | Fakturisanje i placanja |
| assetsAccruals | Assets & Accruals | Sredstva i obracuni |
| taxClosing | Tax & Closing | Porezi i zatvaranje |
| overview | Overview | Pregled |
| records | Records | Evidencija |
| salesDocuments | Documents | Dokumenta |
| performancePricing | Performance & Pricing | Performanse i cene |
| organization | Organization | Organizacija |
| workingTime | Working Time | Radno vreme |
| leave | Leave | Odsustva |
| compensation | Compensation | Zarade i naknade |
| other | Other | Ostalo |
| registry | Registry | Delovodnik |
| management | Management | Upravljanje |
| terminal | Terminal | Terminal |
| administration | Administration | Administracija |
| generalSettings | General | Opsta podesavanja |
| accessControl | Access & Control | Pristup i kontrola |
| system | System | Sistem |

## Files Modified

1. **`src/layouts/TenantLayout.tsx`** -- Add `section` markers to all nav arrays
2. **`src/i18n/translations.ts`** -- Add ~20 new section label translation keys

