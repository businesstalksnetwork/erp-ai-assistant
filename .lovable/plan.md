
# Popravka svih analitičkih stranica

## Problem

Sve analitičke stranice (Analytics Dashboard, Financial Ratios, Budget vs Actuals, Break-Even, Cash Flow Forecast, Profitability) ne prikazuju podatke jer frontend kod koristi kolone koje ne postoje u bazi:

### Nepostojece kolone u upitima

| Tabela | Frontend trazi | Baza ima |
|---|---|---|
| `journal_lines` | `amount`, `side` | `debit`, `credit` |
| `journal_lines` | `tenant_id` (filter) | nema `tenant_id` (pripada `journal_entries`) |
| `invoices` | `paid_at` | ne postoji |
| `loans` | `monthly_payment` | ne postoji (ima `principal`, `interest_rate`, `term_months`) |

### Prazne tabele (seed ih nije popunio)

- `budgets` -- Budget vs Actuals nema podataka
- `cost_centers` -- Profitability by Cost Center je prazna
- `bank_statements` -- Cash Flow Forecast nema pocetni saldo
- `ar_aging_snapshots` -- Cash Flow nema aging podatke
- `loans` -- nema podataka za mesecne rate

### Premalo journal entries

Samo 20 journal entries (svaka 100. faktura) -- treba vise za smislene grafike.

---

## Plan popravke

### Korak 1: Popravka svih analytics upita u frontendu

Svaki upit koji koristi `journal_lines` mora se prepraviti da:
- Umesto `.eq("tenant_id", tenantId!)` na `journal_lines`, koristi filter preko relacije `journal:journal_entry_id(tenant_id, ...)`
- Umesto `amount` i `side`, koristi `debit` i `credit` kolone
- Logika: `net = debit - credit` umesto `side === "debit" ? amount : -amount`

**Fajlovi za izmenu:**

1. **`src/pages/tenant/AnalyticsDashboard.tsx`**
   - Popraviti journal_lines upit: ukloniti `.eq("tenant_id")`, dodati filter `.eq("journal.tenant_id", tenantId)`
   - Zameniti `amount`/`side` sa `debit`/`credit`

2. **`src/pages/tenant/FinancialRatios.tsx`**
   - Ista popravka za journal_lines
   - Ukloniti referencu na `paid_at` -- koristiti `updated_at` ili procenu na osnovu `due_date`

3. **`src/pages/tenant/BudgetVsActuals.tsx`**
   - Popraviti journal_lines upit

4. **`src/pages/tenant/BreakEvenAnalysis.tsx`**
   - Popraviti journal_lines upit

5. **`src/pages/tenant/CashFlowForecast.tsx`**
   - Popraviti referencu na `paid_at` u invoices
   - Popraviti `monthly_payment` -- izracunati iz `principal / term_months`

6. **`src/pages/tenant/ProfitabilityAnalysis.tsx`**
   - Popraviti journal_lines upit za cost center tab

### Korak 2: Dopuna seed funkcije

Dodati u `seed-demo-data` funkciju generisanje podataka za:

- **Budgets** (~21 redova) -- godisnji budzet za svaki revenue/expense account
- **Cost Centers** (5) -- IT, Prodaja, Finansije, Logistika, Proizvodnja
- **Bank Statements** (12) -- mesecni izvodi za 2025
- **Loans** (3) -- aktivni krediti
- **Vise journal entries** (500+) -- za svaku 4. fakturu umesto svake 100.
- **Journal lines sa cost_center_id** -- povezati neke linije sa cost centrima
- **`paid_at` simulacija** -- posto kolona ne postoji, DSO ce koristiti `due_date` + random offset

### Korak 3: Ponovno pokretanje seed funkcije

Pozvati azuriranu seed funkciju da popuni nove tabele.

---

## Tehnicki detalji

### Primer popravke journal_lines upita (pre/posle)

Pre:
```typescript
const { data: lines } = await (supabase
  .from("journal_lines")
  .select("amount, side, accounts:account_id(account_type, code), 
           journal:journal_entry_id(entry_date, status)")
  .eq("tenant_id", tenantId!));

const net = line.side === "debit" ? amt : -amt;
```

Posle:
```typescript
const { data: lines } = await (supabase
  .from("journal_lines")
  .select("debit, credit, accounts:account_id(account_type, code), 
           journal:journal_entry_id(entry_date, status, tenant_id)")
  .eq("journal.tenant_id", tenantId!));

const net = (Number(line.debit) || 0) - (Number(line.credit) || 0);
```

### DSO popravka (bez `paid_at`)

Posto `invoices` nema `paid_at`, DSO ce se racunati kao prosecno vreme od `invoice_date` do `due_date` za placene fakture, ili cemo dodati `paid_at` kolonu u migraciji.

Preporuka: **dodati `paid_at` kolonu** u migraciji jer je DSO kljucni pokazatelj.

### Loans `monthly_payment` popravka

```typescript
// Izracunati iz postojecih kolona
const monthlyPayment = loan.principal / loan.term_months;
```

---

## Fajlovi za izmenu

| Fajl | Izmena |
|---|---|
| `src/pages/tenant/AnalyticsDashboard.tsx` | Popravka journal_lines upita (debit/credit, tenant filter) |
| `src/pages/tenant/FinancialRatios.tsx` | Popravka journal_lines upita + DSO bez paid_at |
| `src/pages/tenant/BudgetVsActuals.tsx` | Popravka journal_lines upita |
| `src/pages/tenant/BreakEvenAnalysis.tsx` | Popravka journal_lines upita |
| `src/pages/tenant/CashFlowForecast.tsx` | Popravka loans + invoices upita |
| `src/pages/tenant/ProfitabilityAnalysis.tsx` | Popravka journal_lines upita za cost center |
| `supabase/functions/seed-demo-data/index.ts` | Dodati budgets, cost_centers, bank_statements, loans, vise JE |
| Migracija | Dodati `paid_at` kolonu na `invoices` tabelu |
