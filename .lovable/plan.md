

# PIB Validacija preko Checkpoint API na Registraciji

## Cilj

Validirati PIB u pozadini tokom registracije koristeći Checkpoint API da se osigura da samo korisnici sa **stvarnim, aktivnim PIB-ovima** mogu da se registruju.

## Arhitektura rešenja

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Auth.tsx      │────▶│  validate-pib    │────▶│  Checkpoint.rs  │
│  (Registracija) │     │  (Edge Function) │     │      API        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         │                       ▼
         │              ┌──────────────────┐
         │              │   NBS / APR      │
         │              │   (Fallback)     │
         │              └──────────────────┘
         ▼
   Ako PIB nije validan,
   blokira se registracija
```

## Implementacija

### 1. Nova Edge Funkcija: `validate-pib`

Kreiram novu javnu (bez JWT) edge funkciju koja:
- Prima PIB kao parametar
- Proverava preko Checkpoint.rs API-ja da li firma postoji
- Koristi NBS i APR kao fallback
- Vraća `{ valid: true/false, companyName?: string }`

**Fajl:** `supabase/functions/validate-pib/index.ts`

```typescript
// Javna funkcija - ne zahteva autentikaciju
// Koristi iste API izvore kao apr-lookup
// Vraća samo valid/invalid status + naziv firme
```

### 2. Ažuriranje `supabase/config.toml`

```toml
[functions.validate-pib]
verify_jwt = false
```

### 3. Modifikacija `src/pages/Auth.tsx`

U `handleSignUp` funkciji, pre poziva `supabase.auth.signUp`:

```typescript
// Validacija PIB-a preko backend-a
const pibToValidate = accountType === 'pausal' ? pib : agencyPib;
if (pibToValidate) {
  const { data: validationResult } = await supabase.functions.invoke('validate-pib', {
    body: { pib: pibToValidate }
  });
  
  if (!validationResult?.valid) {
    toast({
      title: 'Nevalidan PIB',
      description: 'PIB nije pronađen u registru aktivnih firmi.',
      variant: 'destructive',
    });
    setLoading(false);
    return;
  }
}
```

## Korisničko iskustvo

- Korisnik unosi PIB (9 cifara)
- Frontend validacija proverava format
- Na submit, backend proverava da li PIB postoji
- Ako ne postoji: prikazuje se poruka greške, registracija se blokira
- Ako postoji: registracija nastavlja normalno
- **Korisnik ne vidi da se vrši provera** (osim loading indikatora)

## Bezbednost

- Edge funkcija je javna ali ima rate limiting na nivou Supabase-a
- Ne vraća osetljive podatke (samo valid/invalid + naziv)
- CHECKPOINT_API_TOKEN ostaje zaštićen na serveru

## Fajlovi koji se menjaju

| Fajl | Akcija |
|------|--------|
| `supabase/functions/validate-pib/index.ts` | NOVO - Edge funkcija za validaciju |
| `supabase/config.toml` | Dodavanje konfiguracije za novu funkciju |
| `src/pages/Auth.tsx` | Dodavanje poziva validate-pib pre registracije |

## Očekivani rezultat

- Samo korisnici sa stvarnim PIB-ovima mogu da se registruju
- Lažni/nepostojeći PIB-ovi se odbijaju sa jasnom porukom
- Proces je transparentan za korisnika (samo vidi loading)

