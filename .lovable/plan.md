
# Plan: Popravka preuzimanja podataka o firmama (Checkpoint/APR lookup)

## Problem

Kada unesete PIB i kliknete na lupu za automatsko povlačenje podataka, pojavljuje se greška "Neuspešno pretraživanje APR registra". Razlog je isti kao i sa kursom -- backend funkcija `apr-lookup` postoji u kodu, ali **nije postavljena na server** (vraća grešku 404).

## Rešenje

### Korak 1: Postaviti (deploy) backend funkciju
Funkcija `apr-lookup` ce biti postavljena na server kako bi bila dostupna za pozive iz aplikacije.

### Korak 2: Popraviti autentifikaciju u funkciji
Funkcija trenutno koristi metod `getClaims()` za proveru korisnika, koji nije standardan i može izazvati greške. Biće zamenjen sa `getUser()` koji koriste sve ostale funkcije u aplikaciji i pouzdano radi.

## Očekivano ponašanje posle popravke
1. Unesete PIB u formu za novog klijenta
2. Kliknete na lupu (ikonu za pretragu)
3. Sistem pozove Checkpoint.rs API (primarni izvor)
4. Ako Checkpoint ne vrati podatke, koristi NBS registar kao rezervu
5. Ako ni NBS ne vrati, pokušava APR registar
6. Naziv firme, adresa, grad i matični broj se automatski popune

---

## Tehnički detalji

### Izmena autentifikacije u `supabase/functions/apr-lookup/index.ts`
Zamena nestandardnog `getClaims()` poziva sa proverenim `getUser()` pristupom:

```text
// Trenutno (ne radi pouzdano):
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

// Novo (standardan pristup):
const { data: { user }, error: userError } = await supabase.auth.getUser();
```

### Deploy
- Funkcija: `supabase/functions/apr-lookup/index.ts`
- Status: Kod postoji, potreban deploy + popravka auth metode
- Tajne: `CHECKPOINT_API_TOKEN` je vec konfigurisan
