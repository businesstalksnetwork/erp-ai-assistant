
# Plan: Sveobuhvatna Sigurnosna Zaštita Aplikacije

## Status: ✅ IMPLEMENTIRANO

---

## Implementirane Sigurnosne Mere

### 1. Frontend Blokada Disposable Email-ova ✅

**Fajl:** `src/pages/Auth.tsx`

- Dodata lista od 40+ blokiranih disposable email domena
- Validacija se vrši pre registracije
- Korisnik dobija jasnu poruku greške

### 2. RLS Politike za verification_tokens ✅

**Status:** Već implementirano u bazi

- RLS omogućen na tabeli
- Politika "No public access to verification tokens" blokira sve klijentske pristupe
- Edge funkcije (send-verification-email, verify-email) koriste service_role_key

### 3. Honeypot Anti-Bot Zaštita ✅

**Fajl:** `src/pages/Auth.tsx`

- Dodato skriveno "website" polje u login i signup forme
- Botovi koji popune ovo polje se tiho odbijaju
- Polje je nevidljivo za korisnike (display: none, tabIndex: -1)

---

## Već Implementirano ✅

- Server-side blokada disposable email-ova u `send-verification-email` funkciji
- PIB validacija kroz Checkpoint.rs API
- Email verifikacija obavezna pre prijave
- RLS politike na svim tabelama
- is_approved() provera za pristup podacima
- SEF API ključevi sakriveni od klijenta (companies_safe view)
- Private storage bucket-i za osetljive fajlove
- Advisory locks za redni broj fakture (sprečava race condition)

---

## Preporuke za Dalje Unapređenje

| Mera | Prioritet | Napomena |
|------|-----------|----------|
| Leaked password protection | VISOKO | Omogućiti u Lovable Cloud auth podešavanjima |
| Brisanje spam naloga | SREDNJE | Ručno obrisati mailinator.com naloge kroz Admin Panel |

---

## Sigurnosna Arhitektura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Disposable email blocklist (40+ domena)                    │
│  ✅ Honeypot anti-bot polja                                     │
│  ✅ Zod validacija za email/password                            │
│  ✅ PIB format validacija (9 cifara)                            │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EDGE FUNCTIONS (Deno)                      │
├─────────────────────────────────────────────────────────────────┤
│  ✅ validate-pib: Checkpoint.rs API provera                     │
│  ✅ send-verification-email: Server-side email blocklist        │
│  ✅ verify-email: Token validacija i expiry                     │
│  ✅ Service role key za zaobilaženje RLS                        │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATABASE (PostgreSQL)                     │
├─────────────────────────────────────────────────────────────────┤
│  ✅ RLS na svim tabelama                                        │
│  ✅ verification_tokens: Potpuna blokada javnog pristupa        │
│  ✅ companies_safe view: Skriva SEF API ključeve                │
│  ✅ SECURITY DEFINER funkcije za osetljive operacije            │
│  ✅ Advisory locks za konkurentne operacije                     │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                          STORAGE                                │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Private bucket-i: reminder-attachments, invoice-pdfs        │
│  ✅ RLS politike za pristup fajlovima                           │
└─────────────────────────────────────────────────────────────────┘
```
