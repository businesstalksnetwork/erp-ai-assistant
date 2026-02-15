

# Kompletna revizija ERP sistema: Nedostajuce veze i podaci

## STANJE BAZE - Kompletna matrica

### A. BROKEN CONNECTIONS (Podaci postoje ali nisu povezani)

| Parent | Child/Link | Rows | Problem |
|---|---|---|---|
| **opportunities** (100) | contact_id | 100 | Sve NULL - nema kontakt osobe |
| **opportunities** (100) | salesperson_id | 100 | Sve NULL - nema dodeljenog prodavca |
| **opportunities** (100) | lead_id | 100 | Sve NULL - nema veze sa lead-om |
| **supplier_invoices** (500) | purchase_order_id | 500 | Sve NULL - nijedna ulazna faktura nije vezana za PO |
| **meetings** (30) | meeting_participants | 0 | Sastanci nemaju ucesnike |
| **fixed_assets** (20) | fixed_asset_depreciation | 0 | Sredstva nemaju obracunatu amortizaciju |
| **loans** (3) | loan_schedules | 0 | Krediti nemaju plan otplate |
| **loans** (3) | loan_payments | 0 | Krediti nemaju nijednu uplatu |
| **bank_statements** (12) | bank_statement_lines | 0 | Izvodi nemaju nijednu stavku |
| **departments** (5) | department_positions | 0 | Odeljenja nemaju sistematizovana radna mesta |
| **attendance_records** | employee coverage | 15 emp = 0 | Samo 10 od 25 zaposlenih ima evidenciju |
| **open_items** (300) | open_item_payments | 0 | Nema nijedne uplate otvorenih stavki |
| **wms_zones** (12) | wms_aisles | 0 | Zone nemaju hodnike |
| **wms_bins** (60) | wms_bin_stock | 0 | Binovi nemaju zalihe |

### B. PRAZNE TABELE (stranice prikazuju "nema podataka")

| Tabela | Zavisi od | Stranica | Prioritet |
|---|---|---|---|
| **bank_statement_lines** | bank_statements | BankStatements | VISOK |
| **department_positions** | departments, position_templates | Departments | VISOK |
| **fixed_asset_depreciation** | fixed_assets | FixedAssets | VISOK |
| **loan_schedules** | loans | Loans | VISOK |
| **loan_payments** | loans, loan_schedules | Loans | VISOK |
| **meeting_participants** | meetings, contacts, employees | Meetings | VISOK |
| **inventory_cost_layers** | products, warehouses | InventoryCostLayers | VISOK |
| **retail_prices** | products | RetailPrices | VISOK |
| **web_prices** | products | WebPrices | VISOK |
| **wms_aisles** | wms_zones | WmsZones | SREDNJI |
| **wms_bin_stock** | wms_bins, products | WmsBinDetail | SREDNJI |
| **wms_tasks** | wms_bins, products | WmsTasks | SREDNJI |
| **wms_cycle_counts** | warehouses | WmsCycleCounts | SREDNJI |
| **payroll_parameters** | tenant | Payroll config | SREDNJI |
| **open_item_payments** | open_items, bank_statements | OpenItems | SREDNJI |
| **notifications** | users | NotificationBell | NIZAK |
| **return_cases / return_lines** | invoices, products | Returns | NIZAK |
| **credit_notes** | invoices | Returns | NIZAK |

### C. KOMPLETNA MATRICA ZAVISNOSTI SVIH MODULA

```text
MODUL: RACUNOVODSTVO (Accounting)
+-----------------------------+------------------+-----------------------------+
| Entitet                     | Rows | Zavisnosti / Veze                      |
+-----------------------------+------+----------------------------------------+
| chart_of_accounts           |   21 | --> journal_lines.account_id           |
|                             |      | --> fixed_assets.account_id            |
|                             |      | --> budgets.account_id                 |
+-----------------------------+------+----------------------------------------+
| journal_entries             |  600 | --> journal_lines (1800)  OK           |
|                             |      | <-- fiscal_periods                     |
+-----------------------------+------+----------------------------------------+
| journal_lines               | 1800 | --> chart_of_accounts  OK              |
|                             |      | --> cost_centers (parcijalno)          |
+-----------------------------+------+----------------------------------------+
| fiscal_periods              |   12 | --> journal_entries  OK                |
+-----------------------------+------+----------------------------------------+
| budgets                     |   48 | --> chart_of_accounts  OK              |
|                             |      | MISSES: cost_center_id veza            |
+-----------------------------+------+----------------------------------------+
| fixed_assets                |   20 | --> chart_of_accounts  OK              |
|                             |      | XX fixed_asset_depreciation = 0        |
+-----------------------------+------+----------------------------------------+
| bank_accounts               |    1 | --> bank_statements (12)  OK           |
+-----------------------------+------+----------------------------------------+
| bank_statements             |   12 | XX bank_statement_lines = 0            |
+-----------------------------+------+----------------------------------------+
| loans                       |    3 | XX loan_schedules = 0                  |
|                             |      | XX loan_payments = 0                   |
+-----------------------------+------+----------------------------------------+
| open_items                  |  300 | --> partners  OK                       |
|                             |      | XX open_item_payments = 0              |
+-----------------------------+------+----------------------------------------+
| pdv_periods                 |   12 | --> pdv_entries (100)  OK              |
+-----------------------------+------+----------------------------------------+
| tax_rates                   |    3 | --> products  OK                       |
|                             |      | --> invoice_lines  OK                  |
+-----------------------------+------+----------------------------------------+
| currencies                  |    5 | --> exchange_rates (48)  OK            |
+-----------------------------+------+----------------------------------------+

MODUL: PRODAJA (Sales)
+-----------------------------+------+----------------------------------------+
| invoices                    | 2000 | --> invoice_lines (4936)  OK           |
|                             |      | --> partners  OK                       |
|                             |      | --> legal_entities  OK                 |
|                             |      | paid_at popunjeno za 1425  OK          |
+-----------------------------+------+----------------------------------------+
| quotes                      |  300 | --> quote_lines (921)  OK              |
|                             |      | --> partners  OK                       |
+-----------------------------+------+----------------------------------------+
| sales_orders                |  300 | --> sales_order_lines (590)  OK        |
|                             |      | --> partners  OK                       |
+-----------------------------+------+----------------------------------------+
| salespeople                 |    5 | --> sales_targets (60)  OK             |
|                             |      | XX opportunities.salesperson_id = NULL |
+-----------------------------+------+----------------------------------------+
| sales_channels              |    4 | OK                                     |
+-----------------------------+------+----------------------------------------+

MODUL: CRM
+-----------------------------+------+----------------------------------------+
| companies                   |  100 | --> contacts via assignments (80)  OK  |
|                             |      | --> activities (50 linked)  OK         |
+-----------------------------+------+----------------------------------------+
| contacts                    |  160 | --> contact_company_assignments  OK    |
|                             |      | XX opportunities.contact_id = NULL     |
+-----------------------------+------+----------------------------------------+
| leads                       |  200 | --> activities (50 linked)  OK         |
|                             |      | XX opportunities.lead_id = NULL        |
+-----------------------------+------+----------------------------------------+
| opportunities               |  100 | XX contact_id = NULL (100/100)         |
|                             |      | XX salesperson_id = NULL (100/100)     |
|                             |      | XX lead_id = NULL (100/100)            |
|                             |      | --> activities (50 linked)  OK         |
+-----------------------------+------+----------------------------------------+
| activities                  |  200 | Parcijalno: 50 company, 50 lead,      |
|                             |      | 50 opportunity  OK                     |
+-----------------------------+------+----------------------------------------+
| meetings                    |   30 | XX meeting_participants = 0            |
+-----------------------------+------+----------------------------------------+

MODUL: NABAVKA (Purchasing)
+-----------------------------+------+----------------------------------------+
| purchase_orders             |  200 | --> purchase_order_lines (397)  OK     |
|                             |      | --> partners  OK                       |
|                             |      | XX supplier_invoices ne referenciraju  |
+-----------------------------+------+----------------------------------------+
| supplier_invoices           |  500 | XX purchase_order_id = NULL (500/500)  |
|                             |      | --> supplier_id  OK                    |
+-----------------------------+------+----------------------------------------+
| goods_receipts              |  200 | --> goods_receipt_lines (512)  OK      |
|                             |      | --> purchase_orders  OK                |
+-----------------------------+------+----------------------------------------+

MODUL: ZALIHE (Inventory)
+-----------------------------+------+----------------------------------------+
| products                    |  200 | --> inventory_stock (190)  OK          |
|                             |      | --> tax_rates  OK                      |
|                             |      | XX inventory_cost_layers = 0           |
|                             |      | XX retail_prices = 0                   |
|                             |      | XX web_prices = 0                      |
+-----------------------------+------+----------------------------------------+
| warehouses                  |    3 | --> inventory_stock  OK                |
|                             |      | --> inventory_movements  OK            |
+-----------------------------+------+----------------------------------------+
| inventory_movements         | 3000 | --> products  OK                       |
|                             |      | --> warehouses  OK                     |
+-----------------------------+------+----------------------------------------+

MODUL: WMS (Warehouse Management)
+-----------------------------+------+----------------------------------------+
| wms_zones                   |   12 | XX wms_aisles = 0                      |
+-----------------------------+------+----------------------------------------+
| wms_bins                    |   60 | XX wms_bin_stock = 0                   |
+-----------------------------+------+----------------------------------------+
| wms_tasks                   |    0 | XX potpuno prazno                      |
+-----------------------------+------+----------------------------------------+
| wms_cycle_counts            |    0 | XX potpuno prazno                      |
+-----------------------------+------+----------------------------------------+

MODUL: PROIZVODNJA (Production)
+-----------------------------+------+----------------------------------------+
| bom_templates               |   20 | --> bom_lines (67)  OK                 |
+-----------------------------+------+----------------------------------------+
| production_orders           |  200 | --> bom_templates  OK                  |
|                             |      | --> production_consumption (243)  OK   |
|                             |      | production_waste = 0  (nije kriticno)  |
+-----------------------------+------+----------------------------------------+

MODUL: HR (Human Resources)
+-----------------------------+------+----------------------------------------+
| employees                   |   25 | --> employee_contracts (25)  OK        |
|                             |      | --> employee_salaries (25)  OK         |
|                             |      | --> departments  OK                    |
|                             |      | --> payroll_items (300)  OK            |
|                             |      | --> allowances (50)  OK                |
|                             |      | --> deductions (30)  OK                |
|                             |      | --> insurance_records (25)  OK         |
|                             |      | --> leave_requests (50)  OK            |
|                             |      | --> annual_leave_balances (25)  OK     |
|                             |      | --> overtime_hours (40)  OK            |
|                             |      | XX attendance: samo 10/25 pokriveno    |
+-----------------------------+------+----------------------------------------+
| departments                 |    5 | XX department_positions = 0            |
+-----------------------------+------+----------------------------------------+
| position_templates          |   10 | XX department_positions = 0 (ne koristi)|
+-----------------------------+------+----------------------------------------+
| payroll_runs                |   12 | --> payroll_items (300)  OK            |
|                             |      | XX payroll_parameters = 0              |
+-----------------------------+------+----------------------------------------+

MODUL: POS (Point of Sale)
+-----------------------------+------+----------------------------------------+
| pos_sessions                |  261 | --> pos_transactions (1424)  OK        |
|                             |      | --> pos_daily_reports (261)  OK        |
|                             |      | --> fiscal_devices  OK                 |
+-----------------------------+------+----------------------------------------+
| fiscal_receipts             | 1000 | --> fiscal_devices  OK                 |
+-----------------------------+------+----------------------------------------+
```

## PLAN POPRAVKE - 3 FAZE

### Faza 1: Popravka broken veza (Kriticno)

Azuriranje postojecih podataka da se poveze ono sto postoji.

| Akcija | SQL/Seed | Rows |
|---|---|---|
| opportunities.contact_id --> random contacts | UPDATE | 100 |
| opportunities.salesperson_id --> salespeople | UPDATE | 100 |
| opportunities.lead_id --> leads | UPDATE | 100 |
| supplier_invoices.purchase_order_id --> POs | UPDATE | 200 (od 500) |
| attendance_records za preostalih 15 emp | INSERT | ~660 |

### Faza 2: Popuna praznih child tabela (Visok prioritet)

| Tabela | Rows | Logika |
|---|---|---|
| bank_statement_lines | ~120 | 10 stavki po izvodu (primanja/isplate) |
| department_positions | ~15 | 3 pozicije po odeljenju iz position_templates |
| fixed_asset_depreciation | ~120 | Mesecna amortizacija za svako sredstvo |
| loan_schedules | ~108 | Amortizacioni plan za 3 kredita |
| loan_payments | ~30 | Uplate za protekle mesece |
| meeting_participants | ~90 | 3 ucesnika po sastanku (kontakt + zaposleni) |
| inventory_cost_layers | ~400 | FIFO slojevi za top 50 proizvoda |
| retail_prices + retail_price_lists | ~200 | Maloprodajne cene za sve proizvode |
| web_prices + web_price_lists | ~100 | Web cene za 50% proizvoda |
| open_item_payments | ~150 | Parcijalne uplate za neke open items |
| payroll_parameters | ~10 | Poreski pragovi, stope doprinosa |

### Faza 3: Popuna WMS i preostalih tabela (Srednji prioritet)

| Tabela | Rows | Logika |
|---|---|---|
| wms_aisles | ~36 | 3 hodnika po zoni |
| wms_bin_stock | ~120 | Zalihe u binovima (mapiranje inventory_stock) |
| wms_tasks | ~50 | Picking/putaway taskovi |
| wms_cycle_counts + lines | ~10+60 | Inventure |
| return_cases + return_lines | ~10+20 | Povratnice iz faktura |
| credit_notes | ~10 | Knjizna odobrenja |
| notifications | ~50 | Sistemske notifikacije |

## TEHNICKI DETALJI

### Implementacija: Novi Edge Function `seed-demo-data-phase3`

Posto `seed-demo-data` vec ima timeout problem, svi novi podaci idu u novu funkciju koja radi u 3 pod-faze. Funkcija ce:

1. Ucitati ID-jeve postojecih entiteta (employees, contacts, products, etc.)
2. UPDATE broken veze (opportunities, supplier_invoices)
3. INSERT child tabele po redosledu zavisnosti

### Redosled izvrsavanja

```text
1. UPDATE opportunities (contact_id, salesperson_id, lead_id)
2. UPDATE supplier_invoices (purchase_order_id za prvih 200)
3. INSERT department_positions (zavisi od departments + position_templates)
4. INSERT attendance_records za 15 zaposlenih
5. INSERT bank_statement_lines (zavisi od bank_statements)
6. INSERT fixed_asset_depreciation (zavisi od fixed_assets)
7. INSERT loan_schedules + loan_payments (zavisi od loans)
8. INSERT meeting_participants (zavisi od meetings + contacts + employees)
9. INSERT payroll_parameters
10. INSERT inventory_cost_layers (zavisi od products + warehouses)
11. INSERT retail_price_lists + retail_prices (zavisi od products)
12. INSERT web_price_lists + web_prices (zavisi od products)
13. INSERT open_item_payments (zavisi od open_items)
14. INSERT wms_aisles (zavisi od wms_zones)
15. INSERT wms_bin_stock (zavisi od wms_bins + products)
16. INSERT wms_tasks (zavisi od wms_bins)
17. INSERT wms_cycle_counts + lines
18. INSERT return_cases + return_lines
19. INSERT credit_notes
20. INSERT notifications
```

### Fajlovi za izmenu

| Fajl | Izmena |
|---|---|
| `supabase/functions/seed-demo-data-phase3/index.ts` | Nova funkcija sa svim popravkama i dopunama |

