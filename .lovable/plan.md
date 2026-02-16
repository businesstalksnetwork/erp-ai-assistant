

# Plan: Prikazivanje naziva samo za izabranu stavku u donjem meniju

## Opis
Na mobilnom donjem meniju, nazivi stavki ce biti vidljivi samo za trenutno aktivnu (izabranu) stavku. Neaktivne stavke ce prikazivati samo ikonu.

## Izmene

### Fajl: `src/components/AppLayout.tsx`

**Stavke navigacije (linije 398-399)**: Umesto da se `item.label` uvek prikazuje, prikazivace se samo kada je `isActive`:
```tsx
<item.icon className={cn("h-5 w-5", isActive && "scale-110")} />
{isActive && <span>{item.label}</span>}
```

**"Vise" dugme (linija 411)**: Ukloniti tekst "Vise" posto se ono nikada ne smatra aktivnim - prikazivace samo ikonu, konzistentno sa neaktivnim stavkama.

Jedna mala izmena, bez novih importa ili fajlova.
