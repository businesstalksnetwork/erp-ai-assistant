

# Dopuna svih praznih tabela i popravka veza

## Sta je problem

Pregled baze je pokazao da:
1. **2000 nabavnih porudzbina nema nijednu liniju** (po_lines = 0)
2. **200 proizvodnih naloga nema BOM vezu** (bom_template_id = NULL)
3. **30+ tabela je potpuno prazno** -- stranice koje ih prikazuju nece raditi
4. **Nema valuta, praznika, PDV perioda** -- osnovni sistemski podaci fale

## Sta ce se popuniti

### Kriticne popravke veza

| Problem | Popravka |
|---|---|
| PO lines = 0 (2000 PO-a bez stavki) | Dodati 1-3 linije za svaki PO |
| Production orders bez BOM-a | Kreirati 20 BOM templates + bom_lines, povezati sa production orders |
| POS daily reports = 3 | Generisati dnevni izvestaj za svaku POS sesiju (~261) |

### Nove tabele za popuniti

| Tabela | Kolicina | Opis |
|---|---|---|
| **currencies** | 5 | RSD, EUR, USD, CHF, GBP |
| **exchange_rates** | 60 | Mesecni kursevi za 2025 (5 valuta x 12 meseci) |
| **holidays** | 10 | Srpski drzavni praznici za 2025 |
| **pdv_periods** | 12 | Mesecni PDV periodi za 2025 |
| **pdv_entries** | ~300 | PDV stavke vezane za fakture/ulazne fakture |
| **salespeople** | 5 | Prodajni predstavnici (iz postojecih zaposlenih) |
| **sales_channels** | 4 | Direktna prodaja, Web, Partner, Telefon |
| **sales_targets** | 60 | Mesecni targeti za svakog salesperson-a |
| **leave_requests** | 50 | Zahtevi za odmor za 2025 |
| **attendance_records** | ~2500 | Dnevna evidencija dolazaka (10 zaposlenih x 250 dana) |
| **payroll_runs** | 12 | Mesecni obracun plata |
| **payroll_items** | 300 | 25 zaposlenih x 12 meseci |
| **fixed_assets** | 20 | IT oprema, namestaj, vozila |
| **bom_templates** | 20 | Bill of Materials za proizvode |
| **bom_lines** | 60-80 | Materijali po BOM-u |
| **production_consumption** | ~400 | Utrosak materijala po proizvodnim nalozima |
| **activities** | 200 | CRM aktivnosti (pozivi, emailovi, sastanci) |
| **meetings** | 30 | Sastanci sa klijentima |
| **allowances** | 50 | Dodaci na platu |
| **deductions** | 30 | Odbici od plate |
| **overtime_hours** | 40 | Prekovremeni rad |
| **insurance_records** | 25 | Zdravstveno osiguranje po zaposlenom |
| **position_templates** | 10 | Sabloni pozicija |
| **purchase_order_lines** | ~4000 | 1-3 stavke po PO |
| **pos_daily_reports** | ~261 | Dnevni POS izvestaji |

### Tabele koje se NE popunjavaju (zahtevaju korisnicku akciju)

Sledece tabele se koriste za specificne operacije i nema smisla ih automatski popunjavati:
- `documents` / `dms_projects` -- DMS zahteva upload fajlova
- `approval_workflows` -- konfiguracija tokova odobravanja
- `kalkulacije` / `nivelacije` / `kompenzacija` -- specificni srpski dokumenti
- `credit_notes` / `return_cases` -- povratnice se prave iz faktura
- `internal_orders` / `internal_transfers` / `internal_goods_receipts` -- interni nalozi
- `deferrals` / `bad_debt_provisions` -- razgranicenja

## Tehnicki detalji

### Izmena: `supabase/functions/seed-demo-data/index.ts`

Postojeca edge funkcija se prosiruje sa novim sekcijama (32-50+). Dodaje se i cleanup za nove tabele. Kljucne promene:

1. Cleanup blok se prosiruje sa novim tabelama
2. Dodaje se 18+ novih sekcija za generisanje podataka
3. PO lines se generisu za svih 200 PO-a (2000 je zapravo greska u sedu, treba biti 200)
4. BOM templates se kreiraju i povezuju sa production_orders

### Redosled novih inserata

```text
32. Currencies (5)
33. Exchange rates (60)  
34. Holidays (10)
35. Position templates (10)
36. Salespeople (5) -- zavisi od employees
37. Sales channels (4)
38. Sales targets (60) -- zavisi od salespeople
39. PDV periods (12)
40. PDV entries (~300) -- zavisi od invoices, supplier_invoices
41. Purchase order lines (~600) -- zavisi od purchase_orders, products
42. BOM templates (20) + BOM lines (80) -- zavisi od products
43. Update production_orders sa bom_template_id
44. Production consumption (~400) -- zavisi od production_orders, products
45. Fixed assets (20) -- zavisi od chart_of_accounts
46. Leave requests (50) -- zavisi od employees
47. Attendance records (~2500) -- zavisi od employees
48. Payroll runs (12) + Payroll items (300) -- zavisi od employees
49. Allowances (50) + Deductions (30) -- zavisi od employees
50. Overtime hours (40) -- zavisi od employees
51. Insurance records (25) -- zavisi od employees
52. Activities (200) -- zavisi od companies, contacts, leads, opportunities
53. Meetings (30)
54. POS daily reports (~261) -- zavisi od pos_sessions
```

### Upravljanje timeout-om

Funkcija mora da zavrsi unutar 60 sekundi. Posto vec ima mnogo podataka, nove sekcije koriste manje batch-ove i efikasniji kod. Ako bude potrebno, podaci se mogu razdeliti na dva poziva.

### Fajlovi za izmenu

| Fajl | Izmena |
|---|---|
| `supabase/functions/seed-demo-data/index.ts` | Prosirenje sa ~20 novih sekcija podataka + cleanup |

