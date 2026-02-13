
# Popunjavanje testnih podataka za "AI IT Development"

## Sta se pravi

Jedna nova edge funkcija `seed-demo-data` koja ce u jednom pozivu napuniti kompletnu bazu podataka za tenant "AI IT Development" sa realisticnim srpskim poslovnim podacima za celu 2025. godinu.

## Obim podataka

| Modul | Podatci |
|---|---|
| **Pravno lice** | Update PIB, maticni broj, adresa za AI IT Development |
| **Lokacije** | 3 lokacije (Beograd - centrala, Novi Sad - filijala, Nis - magacin) |
| **Odeljenja** | 5 odeljenja (IT, Prodaja, Finansije, Logistika, Proizvodnja) |
| **Zaposleni** | 25 zaposlenih sa ugovorima, platama, evidencijom rada |
| **Partneri** | 50 klijenata + 15 dobavljaca sa srpskim imenima i PIB-ovima |
| **Kompanije (CRM)** | 50 kompanija sa kategorijama |
| **Kontakti** | 80 kontakata povezanih sa kompanijama |
| **Proizvodi** | 100 proizvoda (IT oprema, softver, usluge) sa SKU i barkodovima |
| **Skladista** | 3 skladista sa WMS zonama i binovima |
| **Magacinski saldo** | Stock za svih 100 proizvoda u vise skladista |
| **Fiskalni periodi** | 12 meseci za 2025. godinu (otvoreni) |
| **Fakture** | 10.000 izlaznih faktura sa linijama (jan-dec 2025) |
| **Fiskalni racuni** | 5.000 fiskalnih racuna (POS + fakture) |
| **Fiskalni uredjaji** | 3 uredjaja (po lokaciji) |
| **Ulazne fakture** | 2.000 ulaznih faktura od dobavljaca |
| **Nabavne porudzbine** | 500 nabavnih porudzbina |
| **Prodajni nalozi** | 1.000 prodajnih naloga |
| **Ponude** | 300 ponuda |
| **Proizvodni nalozi** | 200 proizvodnih naloga sa BOM-ovima |
| **POS sesije** | 365 dnevnih sesija sa transakcijama |
| **Magacinska primanja** | 500 prijema robe |
| **Inventurni pokreti** | 15.000 ulaznih/izlaznih kretanja |
| **CRM Leads** | 200 leadova u razlicitim fazama |
| **CRM Opportunities** | 100 prilika u razlicitim stageiovima |
| **Godisnji odmori** | Balans za svakog zaposlenog |
| **Evidencija rada** | Dnevni worklogs za 25 zaposlenih x 250 radnih dana |
| **Otvorene stavke** | AR/AP stavke sa delimicnim placanjima |
| **Knjizenja** | Journal entries za fakture i plate |

## Tehnicki detalji

### Nova edge funkcija: `supabase/functions/seed-demo-data/index.ts`

- Koristi `SUPABASE_SERVICE_ROLE_KEY` za direktan pristup bez RLS ogranicenja
- Zahteva super_admin autorizaciju (ista provera kao create-tenant)
- Podatke ubacuje u batch-evima od po 500 redova (Supabase limit)
- Koristi postojece chart_of_accounts ID-ove i tax_rate ID-ove
- Generise realisticne srpske nazive firmi, imena zaposlenih, nazive proizvoda
- Datumi ravnomerno rasporedjeni od 01.01.2025 do 31.12.2025
- Iznosi faktura variraju od 5.000 do 500.000 RSD
- Statusne distribucije: 70% paid, 20% sent, 10% draft za fakture

### Pozivanje

Korisnik ce moci da pozove funkciju klikom na dugme ili cu ja pozvati direktno nakon deploy-a. Funkcija se poziva jednom i traje oko 30-60 sekundi.

### Redosled insertovanja (zbog FK constraints)

```text
1. Legal entity update (PIB, adresa)
2. Lokacije
3. Odeljenja
4. Fiskalni periodi (12 meseci 2025)
5. Fiskalni uredjaji
6. Partneri (50 klijenata + 15 dobavljaca)
7. Kompanije + kategorije + kontakti
8. Proizvodi (100)
9. Skladista + WMS zone + binovi
10. Inventory stock
11. Zaposleni + ugovori
12. Fakture (10.000) + invoice_lines (batch po 500)
13. Fiskalni racuni (5.000)
14. Ulazne fakture (2.000)
15. Nabavne porudzbine (500) + linije
16. Prodajni nalozi (1.000) + linije
17. Ponude (300) + linije
18. Proizvodni nalozi (200)
19. POS sesije (365) + transakcije
20. Inventory movements (15.000)
21. CRM leads (200) + opportunities (100)
22. Evidencija rada + godisnji odmori
23. Open items + delimicna placanja
24. Journal entries za kljucne dokumente
```

### Fajlovi koji se menjaju

| Fajl | Promene |
|---|---|
| `supabase/functions/seed-demo-data/index.ts` | **NOVO** - Kompletna seed edge funkcija |

Nema promena na frontend-u -- funkcija ce se pozvati direktno posle deploy-a da napuni bazu.
