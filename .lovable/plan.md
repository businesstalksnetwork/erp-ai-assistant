

# Plan: Sprečiti zatvaranje ekrana pri promeni taba

## Problem

Kada promenite tab i vratite se, cela stranica trepne i dijalog se zatvori. Razlog:

1. Vraćanje na tab osvežava sesiju korisnika (TOKEN_REFRESHED)
2. Tokom osvežavanja, sistem ponovo učitava profil korisnika
3. Dok se profil učitava, prikazuje se **spinner koji uklanja celu stranicu**
4. Kada se profil učita, stranica se ponovo montira -- ali dijalog je već zatvoren

## Rešenje

Promena u jednom fajlu: `src/App.tsx` (komponenta `ProtectedRoute`)

### Trenutni kod (problematičan):
```text
if (loading || profileLoading) {
  return <spinner />;  // Uklanja celu stranicu!
}
```

### Novi kod (popravljen):
```text
if (loading || (profileLoading && !profile)) {
  return <spinner />;  // Spinner samo pri PRVOM učitavanju profila
}
```

Razlika: Spinner se prikazuje samo kada profil **još nije učitan** (prvo otvaranje aplikacije). Kada se profil osvežava u pozadini (npr. posle promene taba), stranica ostaje vidljiva sa starim podacima dok se novi ne učitaju.

## Šta se menja

- Fajl: `src/App.tsx`, komponenta `ProtectedRoute`
- Dodajemo `profile` u destrukturiranje iz `useAuth()`
- Menjamo uslov za prikaz spinnera: umesto `profileLoading`, koristimo `profileLoading && !profile`

## Očekivano ponašanje posle popravke

1. Otvorite formu za novog klijenta i unesete podatke
2. Promenite tab (npr. da kopirate nešto)
3. Vratite se nazad
4. Dijalog ostaje otvoren sa svim podacima -- nema treperenja, nema spinnera
5. Profil se tiho osvežava u pozadini bez prekidanja rada

## Tehnički detalji

Izmena u `ProtectedRoute` komponenti:

```text
// Dodajemo profile u destrukturiranje
const { user, loading, profileLoading, profile, isAdmin, isEmailVerified, isSubscriptionExpired, isBookkeeper } = useAuth();

// Spinner samo pri prvom učitavanju (kada profil još ne postoji)
if (loading || (profileLoading && !profile)) {
  return <spinner />;
}
```

Ovo je bezbedna promena jer:
- Pri prvom otvaranju aplikacije, `profile` je `null` dok se ne učita -- spinner se i dalje prikazuje
- Pri osvežavanju sesije (promena taba), `profile` već ima vrednost -- stranica ostaje vidljiva

