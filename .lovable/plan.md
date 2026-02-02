
# Plan: Smanjenje QR sekcije za domaće fakture

## Problem
Faktura je prevelika i ne staje na jednu stranu kada se štampa. QR sekcija (linije 785-811) trenutno prikazuje:
- QR kod veličine 160px
- Sve platne instrukcije pored QR koda (Primalac, Račun, Iznos, Svrha, Model, Poziv na broj)

Ove instrukcije su redundantne jer se svi podaci već vide u gornjem delu fakture.

## Rešenje

### 1. Smanjenje QR koda
- Trenutna veličina: `size={160}`
- Nova veličina: `size={100}` (dovoljno za skeniranje, značajno manje)

### 2. Zamena teksta
**Umesto:**
```
PODACI ZA UPLATU
Primalac: ...
Račun: ...
Iznos: ...
Svrha: ...
Model: 00
Poziv na broj: ...
```

**Samo:**
```
Plati pomoću QR koda.
```

### 3. Kompaktniji layout
- QR kod i tekst u jednoj liniji, centrirano
- Uklanjanje debug sekcije za štampu (već je print:hidden)
- Manji padding

## Fajl za izmenu

### src/pages/InvoiceDetail.tsx (linije 785-811)

Zamena cele QR sekcije sa kompaktnijom verzijom:

```tsx
<div className="border rounded-lg p-3 print:break-inside-avoid">
  <div className="flex items-center justify-center gap-4">
    <QRCodeSVG
      value={ipsString}
      size={100}
      level="L"
      includeMargin={false}
    />
    <p className="text-sm text-muted-foreground">Plati pomoću QR koda.</p>
  </div>
  {/* Debug: prikaži IPS string - samo za development */}
  <details className="mt-2 print:hidden">
    <summary className="text-xs text-muted-foreground cursor-pointer">Debug QR</summary>
    <pre className="mt-1 text-xs bg-muted p-2 rounded whitespace-pre-wrap break-all">{ipsString}</pre>
  </details>
</div>
```

## Vizuelni rezultat

**Før (trenutno):**
```
┌─────────────────────────────────────────────┐
│         PODACI ZA UPLATU                    │
│ ┌────────┐  Primalac: Firma doo             │
│ │  QR    │  Račun: 123-456789-00            │
│ │ (160)  │  Iznos: 60.000,00 RSD            │
│ │        │  Svrha: Faktura 001/25           │
│ └────────┘  Model: 00                       │
│             Poziv na broj: 00125            │
└─────────────────────────────────────────────┘
```

**После (novo):**
```
┌─────────────────────────────────────────────┐
│    ┌────┐                                   │
│    │ QR │  Plati pomoću QR koda.            │
│    │(100)│                                  │
│    └────┘                                   │
└─────────────────────────────────────────────┘
```

## Ušteda prostora
- QR kod: 160px → 100px (37.5% manje)
- Tekst: 6 linija → 1 linija
- Padding: p-4 → p-3
- Ukupna ušteda: ~50-60% manje vertikalnog prostora

## Tehnički detalji
- `includeMargin={false}` - uklanja unutrašnju marginu QR koda za još kompaktniji prikaz
- `size={100}` - optimalna veličina za skeniranje mobilnim uređajima (minimum preporučen za IPS)
- Sve platne informacije ostaju dostupne u IPS stringu unutar QR koda
