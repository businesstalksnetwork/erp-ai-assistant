

# Plan: Dodavanje valute za stranu cenu u šifarniku

## Problem
Polje "Cena (strana valuta)" ne specificira koja je valuta u pitanju. Cena od 4280 EUR i 4280 USD nisu iste, pa je neophodno sačuvati i prikazati valutu uz deviznu cenu.

## Izmene

### 1. Baza podataka - nova kolona `foreign_currency`
SQL migracija koja dodaje kolonu `foreign_currency` (TEXT, nullable, default NULL) u tabelu `service_catalog`.

### 2. Hook - `useServiceCatalog.ts`
- Dodati `foreign_currency: string | null` u `ServiceCatalogItem` interfejs
- Uključiti u tipove za insert/update

### 3. Dijalog - `ServiceCatalogDialog.tsx`
- Dodati state `foreignCurrency` (default: "EUR")
- Pored polja "Cena (strana valuta)" dodati Select dropdown sa valutama (EUR, USD, CHF, GBP)
- Label se menja dinamički: "Cena (EUR)" umesto "Cena (strana valuta)"
- Dropdown se prikazuje samo kada je unet iznos za stranu cenu (ili uvek, za jasnoću)
- Sačuvati `foreign_currency` u `onSave` podatke

### 4. Tabela - `ServiceCatalog.tsx` (stranica)
- Kolona "Cena (strana)" prikazuje iznos sa oznakom valute, npr. "4.280,00 EUR" umesto samo "4.280,00"

### 5. Interfejs dijaloga - layout
Umesto dva jednaka polja u redu, devizna sekcija će biti:
```
Cena (RSD)          |  Cena (strana valuta)
[___0.00___]        |  [EUR v] [___4280___]
```
Select za valutu i input za iznos će biti u istom redu, gde select zauzima manji prostor.

## Tehnicki detalji

- Podržane valute: EUR, USD, CHF, GBP (iste kao u ostatku aplikacije)
- Kolona je nullable - ako nema devizne cene, `foreign_currency` ostaje NULL
- Postojeći zapisi sa `default_foreign_price` bez valute treće se tretirati kao EUR (default)
