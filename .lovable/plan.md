

# Validacija PIB-a na registraciji

## Problem

Trenutna validacija PIB-a samo proverava minimalnu dužinu:
```typescript
if (fields.pib !== undefined && fields.pib.trim().length < 9) {
  newErrors.pib = 'PIB mora imati najmanje 9 karaktera';
}
```

Ovo dozvoljava unos slova i specijalnih karaktera, što nije validno.

## Rešenje

Implementiraću strogu validaciju koja proverava:
1. Da PIB sadrži **samo brojeve**
2. Da ima **tačno 9 cifara**

## Tehnički detalji

### Izmena u `src/pages/Auth.tsx`

Ažuriraću `validateForm` funkciju:

**Trenutno (linije 124-131 i 133-140):**
```typescript
if (fields.pib !== undefined && fields.pib.trim().length < 9) {
  newErrors.pib = 'PIB mora imati najmanje 9 karaktera';
}
```

**Novo:**
```typescript
if (fields.pib !== undefined) {
  const pibTrimmed = fields.pib.trim();
  if (!/^\d{9}$/.test(pibTrimmed)) {
    newErrors.pib = 'PIB mora imati tačno 9 cifara';
  }
}
```

Ista promena za `agencyPib`:
```typescript
if (fields.agencyPib !== undefined) {
  const agencyPibTrimmed = fields.agencyPib.trim();
  if (!/^\d{9}$/.test(agencyPibTrimmed)) {
    newErrors.agencyPib = 'PIB agencije mora imati tačno 9 cifara';
  }
}
```

### Regex objašnjenje

- `^\d{9}$` - proverava da string počinje i završava sa tačno 9 cifara (0-9)
- `\d` - bilo koja cifra
- `{9}` - tačno 9 puta
- `^` i `$` - početak i kraj stringa (ne dozvoljava dodatne karaktere)

## Fajlovi koji se menjaju

| Fajl | Izmena |
|------|--------|
| `src/pages/Auth.tsx` | Ažuriranje validacije PIB-a (linije ~124-140) |

## Očekivani rezultat

- PIB polje prihvata samo 9 cifara
- Poruka greške: "PIB mora imati tačno 9 cifara"
- Validacija se primenjuje na oba PIB polja (paušalac i knjigovođa)

