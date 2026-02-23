

## Sveobuhvatna revizija aplikacije — pronadjeni problemi i plan ispravki

### Pronadjeni problemi

#### 1. Nepostojeca ruta `/crm/quotes` u CompanyDetail stranici (404)

**Fajl:** `src/pages/tenant/CompanyDetail.tsx`

Na tri mesta se koristi `/crm/quotes` umesto ispravne `/sales/quotes`:
- Linija 464: dugme "Dodaj" za ponude → `navigate("/crm/quotes")`
- Linija 485: klik na red ponude → `navigate("/crm/quotes")`

Oba treba promeniti u `/sales/quotes`. Takodje, klik na red ponude treba da vodi na detalj te ponude (`/sales/quotes/${q.id}`), a ne na listu.

#### 2. QuoteVersionHistory — React `forwardRef` warning

**Fajl:** `src/components/quotes/QuoteVersionHistory.tsx`

Konzola prijavljuje: "Function components cannot be given refs". Ovo je zato sto `TabsContent` prosledjuje ref na `QuoteVersionHistory`, koja nije omotana u `forwardRef`. Treba je omotati sa `React.forwardRef` ili staviti dodatni wrapper `<div>` u `TabsContent`.

#### 3. Nema rute za `SalesOrders` inline kreiranje

Nema route `/sales/quotes/new` — korisnik mora da koristi dialog na `/sales/quotes`. Ovo nije bug ali smanjuje konekciju izmedju modula.

---

### Plan ispravki

#### Ispravka 1: CompanyDetail — popraviti navigaciju ka ponudama

**Fajl:** `src/pages/tenant/CompanyDetail.tsx`

| Linija | Trenutno | Novo |
|--------|----------|------|
| 464 | `navigate("/crm/quotes")` | `navigate("/sales/quotes")` |
| 485 | `navigate("/crm/quotes")` | `navigate(\`/sales/quotes/${q.id}\`)` |

Ovo ispravlja dva 404 scenarija i dodaje ispravnu navigaciju ka detalju ponude umesto ka listi.

#### Ispravka 2: QuoteVersionHistory — dodati wrapper div u TabsContent

**Fajl:** `src/pages/tenant/QuoteDetail.tsx`

Umesto direktnog renderovanja `<QuoteVersionHistory>` u `TabsContent`, omotati ga u `<div>` da se izbegne React ref warning:

```tsx
<TabsContent value="versions">
  <div>
    <QuoteVersionHistory open={true} onOpenChange={() => {}} quoteId={id!} inline />
  </div>
</TabsContent>
```

### Tehnicki detalji

**Fajlovi koji se menjaju:**
1. `src/pages/tenant/CompanyDetail.tsx` — 2 izmene navigacije
2. `src/pages/tenant/QuoteDetail.tsx` — wrapper div oko QuoteVersionHistory

Ukupno: 3 fajla, 4 izmene linija.

