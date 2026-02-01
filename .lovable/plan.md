
# Plan: Cifra 0 bez tačkice na fakturama, avansima i predračunima

## Analiza problema

Iznosi na dokumentima koriste CSS klasu `font-mono` koja je povezana sa fontom **JetBrains Mono**. Ovaj font ima stilizovanu nulu ("slashed zero") sa tačkom/crtom u sredini kruga, koju korisnik ne želi na dokumentima.

## Rešenje

Koristiti OpenType CSS svojstvo `font-feature-settings: "zero" 0` koje **isključuje** slashed zero varijante za brojeve, ili primeniti **alternativan font** samo na dokumentima.

Pošto **JetBrains Mono** podržava ovu OpenType osobinu, možemo iskoristiti `font-variant-numeric: normal` ili eksplicitno `font-feature-settings` za elemente unutar `.print-invoice` kako bismo dobili čistu nulu.

**Alternativni pristup**: Primeniti font **Inter** (koji je sada globalni font aplikacije i ima čistu nulu) na monospaced elemente unutar dokumenata, uz simulaciju monospace izgleda pomoću `font-variant-numeric: tabular-nums`.

## Fajl za izmenu

### src/index.css

Dodati CSS pravila koja će za `.print-invoice` i `.pdf-export` kontekste **override-ovati** font-mono klasu:

- Za `.print-invoice .font-mono` i `.pdf-export .print-invoice .font-mono` primeniti Inter font sa `font-variant-numeric: tabular-nums` za izjednačene cifre
- Ovo će osigurati da svi monospaced brojevi (cene, količine, ukupno) na fakturama koriste Inter koji ima čistu nulu

## Tehnička implementacija

```css
/* Override font-mono za dokumente - Inter ima čistu nulu */
.print-invoice .font-mono {
  font-family: 'Inter', system-ui, sans-serif !important;
  font-variant-numeric: tabular-nums !important;
}

.pdf-export .print-invoice .font-mono {
  font-family: 'Inter', system-ui, sans-serif !important;
  font-variant-numeric: tabular-nums !important;
}

@media print {
  .print-invoice .font-mono {
    font-family: 'Inter', system-ui, sans-serif !important;
    font-variant-numeric: tabular-nums !important;
  }
}
```

## Rezultat

- Svi iznosi na fakturama, avansima i predračunima će koristiti **Inter** font sa tabularnim ciframa
- Cifra 0 će biti čist krug bez tačke
- Ostatak aplikacije nastavlja da koristi JetBrains Mono gde je primenjeno
- Promene se primenjuju na ekranski prikaz dokumenta, PDF eksport i štampu
