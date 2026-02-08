
# Plan: Klikabilni limiti sa linijskim dijagramom pregleda prometa

## Ideja

Kartice limita (6M i 8M) na dashboard-u postaju klikabilne. Klikom na bilo koju karticu otvara se Dialog sa detaljnim pregledom:

- Linijski dijagram mesecnog prometa sa linijom limita
- Razlaganje prometa po kategorijama (fakture, fiskalna kasa, KPO)
- Kumulativna linija koja vizuelno prikazuje kako se priblizavate limitu

## Kako ce izgledati

### Za Godisnji limit (6M):
- Dijagram prikazuje mesecni promet (Jan-Dec) tekuce godine
- Dve linije: kumulativni ukupni promet + mesecni promet
- Horizontalna referentna linija na 6M (crvena isprekidana)
- Dodatna horizontalna linija na 80% (4.8M) kao upozorenje (zuta)
- Razlaganje: koliko dolazi iz faktura, koliko iz fiskalne kase

### Za Klizni limit (8M):
- Dijagram prikazuje mesecni domaci promet (poslednjih 12 meseci)
- Kumulativna linija + mesecni promet
- Horizontalna referentna linija na 8M + upozorenje na 80%
- Razlaganje: fakture, fiskalna kasa, KPO unosi

### Vizuelni elementi u dijalogu:
- Naslov sa ikonom i trenutnim procentom
- Linijski grafik sa animiranim prikazom
- Mini tabela sa razlaganjem prometa ispod grafika
- Boje uskladjene sa temom (primary/warning/destructive zavisno od nivoa)

## Tehnicki detalji

### Fajl: `src/pages/Dashboard.tsx`

**Dodati state za dialog:**
```text
const [limitDialogOpen, setLimitDialogOpen] = useState(false);
const [selectedLimit, setSelectedLimit] = useState<'6m' | '8m'>('6m');
```

**Uciniti kartice klikabilnim:**
- Dodati `cursor-pointer` i `onClick` handler na obe limit kartice
- Klik otvara Dialog sa odgovarajucim limitom

**Kreirati novi komponent `LimitDetailDialog`:**
- Prima: limitType ('6m' | '8m'), limits data, invoices, dailySummaries, open/onClose
- Prikazuje Dialog sa linijskim dijagramom i razlaganjem

### Novi fajl: `src/components/LimitDetailDialog.tsx`

Komponenta sadrzi:

1. **Priprema podataka:**
   - Grupisanje faktura i fiskalnih podataka po mesecima
   - Racunanje kumulativnog prometa (running total)
   - Za 6M: svi prihodi po mesecima tekuce godine
   - Za 8M: domaci prihodi po mesecima poslednjih 12 meseci

2. **Linijski dijagram (recharts):**
   - X osa: meseci (Jan-Dec ili poslednjih 12)
   - Primarna linija: kumulativni promet (area chart sa gradijentom)
   - Sekundarna linija: mesecni promet (tanja linija)
   - Referentna linija: limit (6M ili 8M) - crvena isprekidana
   - Referentna linija: 80% upozorenje - zuta isprekidana
   - Custom tooltip sa formatiranim iznosima

3. **Razlaganje prometa ispod grafika:**
   - Kartice za svaku kategoriju (Fakture, Fiskalna kasa, KPO)
   - Sa procentualnim udelom u ukupnom prometu
   - Vizuelno oznacene odgovarajucim bojama

4. **Footer sa korisnim informacijama:**
   - "Preostalo do limita: X RSD"
   - Projekcija: "Pri trenutnom tempu, limit ce biti dostignut u mesecu Y" (opciono)

### Koristeni recharts elementi:
- `AreaChart` sa gradijentom za kumulativni prikaz
- `Line` za mesecni promet
- `ReferenceLine` za limit i upozorenje
- `CartesianGrid`, `XAxis`, `YAxis` za mrezu
- `ChartTooltip` sa custom formaterom

### Stil kartica (clickable):
```text
<Card 
  className={cn("card-hover cursor-pointer", ...)}
  onClick={() => { setSelectedLimit('6m'); setLimitDialogOpen(true); }}
>
```

Dodata animacija: lagani scale efekat na hover (`hover:scale-[1.01]`) da naznaci da je klikabilno.

### Responsive dizajn:
- Na mobilnim uredjajima dijagram zauzima punu sirinu
- Razlaganje prometa ide u jednu kolonu umesto grid-a
- Dialog je full-width na mobilnim (`max-w-2xl` na desktopu)
