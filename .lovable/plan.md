
# Plan: Očuvanje unosa klijenta pri promeni taba

## Problem

Kada unosite podatke o klijentu i promenite tab (browser tab), podaci nestanu. Ovo se dešava jer:

1. Kada se vratite na tab, backend osvežava sesiju korisnika
2. Tokom osvežavanja, prikazuje se spinner (loading ekran)
3. Cela stranica Klijenti se ukloni i ponovo učita
4. Sav uneti tekst u formi se gubi

## Zašto draft sistem ne pomaže

Draft (auto-save) je trenutno aktivan **samo dok je dijalog otvoren** (`enabled: isOpen && !editId`). Kada se stranica ponovo učita:
- `isOpen` se resetuje na `false`
- Pošto je `enabled = false`, draft se ne može ni sačuvati ni vratiti
- Podaci su izgubljeni

## Rešenje

Promena u jednom fajlu: `src/pages/Clients.tsx`

### Izmena 1: Ukloniti uslov `isOpen` iz draft sistema

Umesto `enabled: isOpen && !editId`, draft ce uvek biti aktivan (`enabled: !editId`). Ovo znači:
- Draft se čuva čim korisnik unese bilo koji podatak
- Kada se stranica ponovo učita (posle promene taba), draft se automatski vraća i dijalog se ponovo otvara

### Izmena 2: Dodati proveru da se prazan formular ne čuva

Kako ne bi čuvali prazan formular kao draft, dodaćemo pomoćnu funkciju koja proverava da li formular sadrži ikakve podatke:

```text
// Proveri da li forma ima unete podatke (nije prazna)
const hasFormData = formData.name || formData.pib || formData.address || 
                    formData.city || formData.email || formData.maticni_broj || 
                    formData.vat_number;
```

Finalni uslov biće: `enabled: !editId && (isOpen || !!hasFormData)` -- draft se čuva kad je dijalog otvoren ILI kad postoje sačuvani podaci (za restore scenario).

## Očekivano ponašanje posle popravke

1. Otvorite formu za novog klijenta
2. Unesete PIB, ime, adresu...
3. Promenite tab da kopirate podatke
4. Vratite se nazad
5. Dijalog se automatski ponovo otvori sa svim prethodno unetim podacima
6. Nastavite sa unosom kao da se ništa nije desilo
