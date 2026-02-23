

## Ispravka AI Uvida — Boje po hitnosti i sinhronizacija konekcija

### Problem 1: Nedostajuce rute u AiModuleInsights

`AiModuleInsights` nema 5 ruta koje `AiInsightsWidget` ima. Kada AI vrati uvide tipa `expense_spike`, `duplicate_invoices`, `weekend_postings`, `dormant_accounts` ili `at_risk_accounts` na stranicama modula — klik ne radi.

**Ispravka:** Dodati nedostajuce rute u `AiModuleInsights` mapu:

| insight_type | ruta |
|---|---|
| expense_spike | /analytics/expenses |
| duplicate_invoices | /purchasing/invoices |
| weekend_postings | /accounting/journal |
| dormant_accounts | /crm/companies |
| at_risk_accounts | /crm/companies |

### Problem 2: Badge boje ne odgovaraju hitnosti

Trenutno oba widgeta koriste:
- critical: `destructive` badge (crveno) -- ISPRAVNO
- warning: `secondary` badge (sivo) -- POGRESNO, treba `warning` (narandzasto)
- info: `outline` badge (sivo) -- POGRESNO, treba `info` (plavo)

Badge komponenta vec ima `warning` i `info` varijante definisane — samo ih treba koristiti.

### Problem 3: Nedostaje pozadinska boja redova

Svaki red treba imati blagu pozadinsku boju po hitnosti:
- critical: `bg-destructive/5` (bledo crvena)
- warning: `bg-warning/5` (bledo narandzasta)
- info: `bg-blue-50 dark:bg-blue-950/20` (bledo plava)

### Problem 4: Nekonzistentna boja ikone za warning

`AiModuleInsights` koristi `text-accent` za warning ikone (sto moze biti bilo koja boja zavisno od teme), dok `AiInsightsWidget` koristi `text-amber-500`. Treba ujednaciti na `text-amber-500`.

---

### Tehnicke izmene

#### Fajl 1: `src/components/ai/AiInsightsWidget.tsx`

Promeniti `severityConfig`:
```
critical: { icon: AlertCircle, color: "text-destructive", badge: "destructive", bg: "bg-destructive/5" }
warning:  { icon: AlertTriangle, color: "text-amber-500", badge: "warning", bg: "bg-warning/5" }
info:     { icon: Info, color: "text-blue-500", badge: "info", bg: "bg-blue-50 dark:bg-blue-950/20" }
```

Dodati `bg` klasu na svaki red dugme.

#### Fajl 2: `src/components/shared/AiModuleInsights.tsx`

1. Dodati 5 nedostajucih ruta u `insightRouteMap`
2. Promeniti `severityConfig` da koristi iste boje kao Widget
3. Dodati pozadinsku boju redova

#### Ukupno: 2 fajla, ~15 linija izmena

