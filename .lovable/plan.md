
# Analitika - Korisnička stranica za praćenje prometa

## Pregled rešenja

Vraćamo stranicu "Analitika" u glavni meni (dostupnu svim korisnicima, ne samo adminima) sa sledećim funkcionalnostima:

1. **Linijski grafik - Mesečni promet**
   - Kombinuje fakture i fiskalni promet po mesecima
   - X-osa: meseci, Y-osa: iznos u RSD
   - Prikazuje ukupan promet za izabranu godinu

2. **Pie chart - Naplaćeno vs Nenaplaćeno**
   - Procenat naplaćenog i nenaplaćenog prometa
   - Fiskalni promet se tretira kao "Maloprodaja" partner i uvek je naplaćen
   - Vizuelno jasno razdvaja zeleno (naplaćeno) i crveno (nenaplaćeno)

3. **Top 5 partnera po fakturisanom iznosu**
   - Lista top 5 klijenata/partnera po ukupnom prometu
   - Fiskalna kasa se prikazuje kao "Maloprodaja" ako postoji fiskalni promet

4. **Top 5 partnera po nenaplaćenom iznosu**
   - Lista top 5 partnera sa najvećim neplaćenim iznosom
   - Fiskalna kasa se ne pojavljuje ovde (uvek je naplaćena)

## Dodatni predlozi

5. **Trend naplate** - Linijski grafik koji prikazuje procenat naplate po mesecima (koliko brzo naplaćujete)

6. **Prosečno vreme naplate** - Kartica koja prikazuje prosečan broj dana od izdavanja do naplate fakture

7. **Sezonalnost prometa** - Uporedni prikaz prometa po mesecima između godina (ako ima podataka za više godina)

## Tehnička implementacija

### 1. Ažuriranje navigacije - `src/components/AppLayout.tsx`

Dodati "Analitika" stavku u glavni meni (mainNavItems) umesto samo admin sekcije:

```typescript
const mainNavItems = [
  { href: '/dashboard', label: 'Kontrolna tabla', icon: LayoutDashboard },
  { href: '/invoices', label: 'Fakture', icon: FileText },
  { href: '/kpo', label: 'KPO Knjiga', icon: BookOpen },
  // ... ostale stavke
  { href: '/invoice-analytics', label: 'Analitika', icon: PieChartIcon }, // NOVA stavka
];
```

### 2. Kreiranje nove route - `src/App.tsx`

Dodati rutu za korisničku analitiku:
```typescript
<Route path="/invoice-analytics" element={<ProtectedRoute><InvoiceAnalytics /></ProtectedRoute>} />
```

### 3. Refaktorisanje stranice `src/pages/InvoiceAnalytics.tsx`

Postojeća stranica se prilagođava da uključi:

**a) Kombinovani linijski grafik (fakture + fiskalna kasa):**
```typescript
const combinedMonthlyData = useMemo(() => {
  // Spoji podatke iz faktura i fiscal_daily_summary
  const monthlyMap = new Map<number, { invoiced: number; fiscal: number }>();
  
  // Dodaj fakture
  filteredInvoices.forEach(invoice => {
    const month = new Date(invoice.issue_date).getMonth();
    const current = monthlyMap.get(month) || { invoiced: 0, fiscal: 0 };
    current.invoiced += Number(invoice.total_amount);
    monthlyMap.set(month, current);
  });
  
  // Dodaj fiskalni promet
  fiscalDailySummaries.forEach(summary => {
    const month = new Date(summary.summary_date).getMonth();
    const current = monthlyMap.get(month) || { invoiced: 0, fiscal: 0 };
    current.fiscal += Number(summary.total_amount);
    monthlyMap.set(month, current);
  });
  
  return months.map((name, index) => ({
    name,
    ukupno: (monthlyMap.get(index)?.invoiced || 0) + (monthlyMap.get(index)?.fiscal || 0),
  }));
}, [filteredInvoices, fiscalDailySummaries]);
```

**b) Pie chart sa fiskalnom kasom kao "Maloprodaja":**
```typescript
const paymentDistributionData = useMemo(() => {
  // Fakture - naplaćeno vs nenaplaćeno
  const invoicePaid = filteredInvoices
    .filter(i => i.payment_status === 'paid')
    .reduce((sum, i) => sum + Number(i.total_amount), 0);
  
  const invoicePartial = filteredInvoices
    .filter(i => i.payment_status === 'partial')
    .reduce((sum, i) => sum + Number(i.paid_amount || 0), 0);
    
  const invoiceUnpaid = filteredInvoices
    .reduce((sum, i) => sum + Number(i.total_amount), 0) - invoicePaid - invoicePartial;
  
  // Fiskalna kasa - uvek naplaćeno
  const fiscalTotal = fiscalDailySummaries.reduce((sum, s) => sum + Number(s.total_amount), 0);
  
  const totalPaid = invoicePaid + invoicePartial + fiscalTotal;
  const totalUnpaid = invoiceUnpaid;
  
  return [
    { name: 'Naplaćeno', value: totalPaid, color: 'hsl(var(--chart-2))' },
    { name: 'Nenaplaćeno', value: totalUnpaid, color: 'hsl(var(--chart-5))' },
  ].filter(d => d.value > 0);
}, [filteredInvoices, fiscalDailySummaries]);
```

**c) Top 5 partnera sa "Maloprodaja":**
```typescript
const topPartnersByRevenue = useMemo(() => {
  const partnerMap = new Map<string, number>();
  
  // Fakture po klijentima
  filteredInvoices.forEach(invoice => {
    const current = partnerMap.get(invoice.client_name) || 0;
    partnerMap.set(invoice.client_name, current + Number(invoice.total_amount));
  });
  
  // Fiskalna kasa kao "Maloprodaja"
  const fiscalTotal = fiscalDailySummaries.reduce((sum, s) => sum + Number(s.total_amount), 0);
  if (fiscalTotal > 0) {
    partnerMap.set('Maloprodaja', fiscalTotal);
  }
  
  return Array.from(partnerMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}, [filteredInvoices, fiscalDailySummaries]);
```

### 4. Hook za fiskalne podatke

Koristiti postojeći `useFiscalEntries` hook za dobijanje `dailySummaries` za izabranu godinu.

### 5. Uklanjanje iz admin navigacije

Admin Analytics (/analytics) ostaje kao admin-only stranica za sistemsku analitiku. Korisnička analitika (/invoice-analytics) je nova, dostupna svim korisnicima.

## Layout stranice

```text
┌──────────────────────────────────────────────────────────────┐
│  Analitika                               [Godina: 2025 ▼]    │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │ Ukupan promet   │ │ Naplaćeno       │ │ Nenaplaćeno     │ │
│  │ 2.500.000 RSD   │ │ 2.100.000 RSD   │ │ 400.000 RSD     │ │
│  │ 45 faktura      │ │ 84% od ukupnog  │ │ 16% od ukupnog  │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────┐ ┌────────────────────────┐   │
│  │  MESEČNI PROMET (linija)   │ │  NAPLAĆENO/NENAPLAĆENO │   │
│  │  ~~~~~~~~~~~~~/\~~~~~~     │ │      PIE CHART         │   │
│  │  Jan Feb Mar Apr Maj Jun   │ │     ████████░░         │   │
│  └────────────────────────────┘ └────────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────┐ ┌────────────────────────┐   │
│  │  TOP 5 PO PROMETU          │ │  TOP 5 NENAPLAĆENO     │   │
│  │  1. Maloprodaja   800k     │ │  1. Firma ABC   150k   │   │
│  │  2. Firma ABC     500k     │ │  2. Firma XYZ   100k   │   │
│  │  3. Firma XYZ     400k     │ │  3. Firma 123    80k   │   │
│  └────────────────────────────┘ └────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Koraci implementacije

1. Ažurirati navigaciju u `AppLayout.tsx` - dodati Analitika link za sve korisnike
2. Dodati novu rutu `/invoice-analytics` u `App.tsx`
3. Refaktorisati `InvoiceAnalytics.tsx` da:
   - Koristi `useFiscalEntries` hook za fiskalne podatke
   - Kombinuje fakture i fiskalni promet u linijski grafik
   - Tretira fiskalni promet kao "Maloprodaja" u top listama
   - Prikazuje pie chart sa naplaćeno/nenaplaćeno distribucijom
4. Dodati responsivan dizajn za mobilne uređaje
