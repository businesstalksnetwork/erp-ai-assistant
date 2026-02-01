
# Plan: Sveobuhvatna Sigurnosna Zaštita Aplikacije

## Pronađeni Sigurnosni Problemi

### KRITIČNI PROBLEMI (Hitno rešiti)

| Problem | Rizik | Status |
|---------|-------|--------|
| **Nedostaje frontend blokada disposable email-ova** | Spam nalozi mogu se kreirati zaobilaženjem server-side provere | ❌ Nije implementirano |
| **verification_tokens tabela bez RLS politika** | Tokeni za verifikaciju/reset mogu biti ukradeni | ❌ KRITIČNO |
| **Leaked password protection onemogućen** | Korisnici mogu koristiti kompromitovane lozinke | ⚠️ Potrebna konfiguracija |

### VISOK PRIORITET

| Problem | Rizik | Status |
|---------|-------|--------|
| **Nema rate limiting/captcha na login** | Brute force napadi mogući | ❌ Nedostaje |
| **profiles tabela - mogući leak podataka** | Osetljivi korisnički podaci | ⚠️ RLS postoji, ali treba review |

---

## Implementacija

### 1. Frontend Blokada Disposable Email-ova

**Fajl:** `src/pages/Auth.tsx`

**Akcija:** Dodati blocklist i validaciju pre registracije

```typescript
// Na vrhu fajla, posle importa
const BLOCKED_EMAIL_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 
  '10minutemail.com', 'throwaway.email', 'fakeinbox.com',
  'maildrop.cc', 'yopmail.com', 'temp-mail.org',
  'disposablemail.com', 'trashmail.com', 'getnada.com',
  'mohmal.com', 'tempail.com', 'emailondeck.com', 'sharklasers.com',
  'guerrillamail.info', 'grr.la', 'guerrillamail.biz', 'guerrillamail.de',
  'guerrillamail.net', 'guerrillamail.org', 'spam4.me', 'getairmail.com',
  'mailnesia.com', 'tmpmail.org', 'tmpmail.net', 'discard.email',
  'mailcatch.com', 'mintemail.com', 'mt2009.com', 'nospam.ze.tc',
  'owlymail.com', 'rmqkr.net', 'jetable.org', 'spamgourmet.com'
];

const isDisposableEmail = (email: string): boolean => {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? BLOCKED_EMAIL_DOMAINS.includes(domain) : false;
};
```

**U handleSignUp funkciji (pre PIB validacije):**
```typescript
// Blokada disposable email domena
if (isDisposableEmail(email)) {
  toast({
    title: 'Nevalidna email adresa',
    description: 'Nije dozvoljeno korišćenje privremenih email servisa za registraciju.',
    variant: 'destructive',
  });
  setLoading(false);
  return;
}
```

---

### 2. RLS Politike za verification_tokens

**SQL Migracija:**

```sql
-- Omogući RLS
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;

-- Blokiraj SVE korisničke pristupe - samo service role može pristupiti
-- (Edge funkcije koriste service role)
CREATE POLICY "No public access to tokens"
  ON public.verification_tokens
  FOR ALL
  USING (false);
```

Ovo osigurava da:
- Niko ne može čitati tokene kroz klijentske upite
- Edge funkcije (send-verification-email, verify-email) koriste service_role_key i zaobilaze RLS
- Potpuna zaštita od krađe tokena

---

### 3. Leaked Password Protection

Potrebno je omogućiti ovu opciju u Lovable Cloud auth podešavanjima. Ova funkcija proverava da li je lozinka koju korisnik unosi pronađena u poznatim curenjima podataka.

---

### 4. Rate Limiting za Login (Preporučeno)

Supabase automatski ima ugrađeni rate limiting na auth endpoint-ovima, ali za dodatnu zaštitu može se dodati:

**Opcija A:** Koristiti Supabase-ov ugrađeni rate limiting (već aktivan)
**Opcija B:** Dodati honeypot polje u formu za detekciju botova

```typescript
// U login formi - honeypot polje (sakriveno od korisnika)
<input 
  type="text" 
  name="website" 
  style={{ display: 'none' }} 
  tabIndex={-1} 
  autoComplete="off"
/>

// U handleSignIn - provera honeypot-a
const honeypot = formData.get('website') as string;
if (honeypot) {
  // Bot je popunio honeypot, tiho odbij
  console.warn('Honeypot triggered');
  setLoading(false);
  return;
}
```

---

### 5. Pregled profiles RLS Politika

Trenutne politike:
- Korisnici mogu videti samo svoj profil
- Admini mogu videti sve profile

Ovo je korektno postavljeno. Anonimni korisnici NE mogu pristupiti podacima jer:
- RLS zahteva `auth.uid()` proveru
- Nema politike za `anon` role

---

## Sažetak Implementacije

| Fajl/Akcija | Prioritet | Efekat |
|-------------|-----------|--------|
| `src/pages/Auth.tsx` - blocklist | KRITIČNO | Sprečava spam registracije na frontend-u |
| SQL Migracija - verification_tokens RLS | KRITIČNO | Štiti tokene od krađe |
| Lovable Cloud - enable leaked password | VISOKO | Sprečava korišćenje kompromitovanih lozinki |
| Auth.tsx - honeypot | SREDNJE | Dodatna anti-bot zaštita |

## Već Implementirano ✅

- Server-side blokada disposable email-ova u `send-verification-email` funkciji
- PIB validacija kroz Checkpoint.rs API
- Email verifikacija obavezna pre prijave
- RLS politike na svim ostalim tabelama
- is_approved() provera za pristup podacima
- SEF API ključevi sakriveni od klijenta
- Private storage bucket-i za osetljive fajlove

## Napomena

Brisanje postojećih spam naloga (`knjigovodja@mailinator.com`, `marko@mailinator.com`) treba uraditi ručno kroz Admin Panel nakon implementacije ovih zaštita.
