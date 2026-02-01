
# Plan: Zaštita od spam naloga sa disposable email adresama

## Problem

Pronađeni su nalozi registrovani sa disposable email servisima (mailinator.com) koji se koriste za kreiranje lažnih/test naloga:

| Email | Status | Verifikovan | Tip naloga |
|-------|--------|-------------|------------|
| knjigovodja@mailinator.com | approved | Ne | Knjigovođa |
| marko@mailinator.com | approved | Ne | Paušalac |

Ovi nalozi nikada nisu verifikovali email (tokeni nisu iskorišćeni), ali su manuelno odobreni.

## Rešenje

Implementacija višeslojne zaštite:

### 1. Blokada disposable email domena pri registraciji

Dodaćemo listu blokiranih domena i proveru u Auth.tsx formi:

**Blokirani domeni:**
- mailinator.com, guerrillamail.com, tempmail.com, 10minutemail.com
- throwaway.email, fakeinbox.com, maildrop.cc, yopmail.com
- temp-mail.org, disposablemail.com, trashmail.com

**Lokacija izmene:** `src/pages/Auth.tsx`

Dodaje se validacija pre slanja forme:
```
const BLOCKED_EMAIL_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 
  '10minutemail.com', 'throwaway.email', 'fakeinbox.com',
  'maildrop.cc', 'yopmail.com', 'temp-mail.org',
  'disposablemail.com', 'trashmail.com', 'getnada.com',
  'mohmal.com', 'tempail.com', 'emailondeck.com'
];

const isDisposableEmail = (email: string) => {
  const domain = email.split('@')[1]?.toLowerCase();
  return BLOCKED_EMAIL_DOMAINS.includes(domain);
};
```

### 2. Server-side validacija u Edge funkciji

Dodatna provera u `send-verification-email` funkciji kao backup:

**Lokacija:** `supabase/functions/send-verification-email/index.ts`

### 3. Admin Panel - oznaka neverifikovanih korisnika

Dodati vizuelni indikator u tabeli korisnika koji pokazuje:
- Da li je korisnik verifikovao email
- Upozorenje za manuelno odobrene neverifikovane naloge

**Lokacija:** `src/pages/AdminPanel.tsx`

### 4. Brisanje postojećih spam naloga

Admin može koristiti postojeću funkcionalnost za brisanje:
- `knjigovodja@mailinator.com` 
- `marko@mailinator.com`

## Tehnički detalji

### Izmene u Auth.tsx

1. Dodati konstantu `BLOCKED_EMAIL_DOMAINS` na vrh fajla
2. Dodati helper funkciju `isDisposableEmail()`
3. U `handleSignUp` pre poziva `supabase.auth.signUp`:
   ```typescript
   if (isDisposableEmail(email)) {
     toast({
       title: 'Nevalidna email adresa',
       description: 'Nije dozvoljeno korišćenje privremenih email servisa.',
       variant: 'destructive',
     });
     setLoading(false);
     return;
   }
   ```

### Izmene u send-verification-email

Dodati istu proveru kao backup (defense in depth):
```typescript
const BLOCKED_DOMAINS = ['mailinator.com', ...];
const domain = email.split('@')[1]?.toLowerCase();
if (BLOCKED_DOMAINS.includes(domain)) {
  throw new Error('Disposable email addresses are not allowed');
}
```

### Izmene u AdminPanel.tsx

U tabeli korisnika dodati kolonu ili badge:
- Ikona `CheckCircle` za verifikovane
- Ikona `AlertTriangle` za neverifikovane sa tooltipom "Email nije verifikovan"

## Sažetak implementacije

| Fajl | Akcija |
|------|--------|
| `src/pages/Auth.tsx` | Dodati blocklist proveru pri registraciji |
| `supabase/functions/send-verification-email/index.ts` | Backup server-side provera |
| `src/pages/AdminPanel.tsx` | Vizuelni indikator verifikacije |

## Napomena za brisanje

Za brisanje postojećih spam naloga:
1. U Admin Panelu pronađi korisnika
2. Klikni na tri tačke u koloni "Akcije"
3. Izaberi "Obriši korisnika"

Ovo će potpuno ukloniti nalog iz sistema (auth + profile + svi povezani podaci).
