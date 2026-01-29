

# Isključivanje Default Supabase Verifikacionih Emailova

## Problem

Trenutno se šalju **DVA verifikaciona emaila**:
1. ✅ **Naš custom email** sa `verification@pausalbox.rs` (Resend) - radi ispravno
2. ❌ **Default Supabase email** sa `no-reply@auth.lovable.cloud` - treba isključiti

## Rešenje

Treba uključiti **Auto-confirm email signups** u backend konfiguraciji. Ovo će:
- Isključiti slanje default Supabase verifikacionih emailova
- Automatski potvrditi email adresu pri registraciji
- Naš custom sistem će i dalje raditi jer sami kontrolišemo `email_confirm` status kroz `verify-email` edge funkciju

## Koraci implementacije

### 1. Konfiguracija Auth sistema

Koristićemo `configure-auth` tool da uključimo auto-confirm:

```
autoConfirmEmail: true
```

### 2. Izmena signup flow-a (opciono)

Pošto će email sada automatski biti potvrđen, možemo promeniti logiku:
- Korisnik se registruje
- Email se automatski potvrdi u Supabase
- Naš custom email se šalje (verifikacija sad služi kao "aktivacija" ili "potvrda")
- Korisnik klikne link i biva preusmeren na login

**ILI** možemo zadržati pravu verifikaciju tako što:
- Ne koristimo auto-confirm
- Umesto toga, u `signUp` opcijama postavimo `emailRedirectTo` na nepostojeći URL tako da default email ne radi
- Ali ovo nije čisto rešenje

## Preporučeni pristup

Najčistije rešenje je da:
1. Uključimo auto-confirm (isključuje default email)
2. Modifikujemo naš sistem da radi kao "aktivacioni" umesto "verifikacionog"
3. Korisnik mora kliknuti na link da bi mogao da koristi aplikaciju (čak i ako je email tehnički potvrđen)

## Alternativa: Dvostruka verifikacija

Ako želiš pravu verifikaciju gde korisnik NE MOŽE da se uloguje dok ne potvrdi email:
1. Dodajemo polje `is_email_verified` u `profiles` tabelu (default: false)
2. Naš `verify-email` edge function postavlja ovo na true
3. Login forma proverava ovo polje pre nego što pusti korisnika

## Fajlovi koji se menjaju

| Fajl | Akcija |
|------|--------|
| Auth konfiguracija | Uključi auto-confirm |
| `src/pages/Auth.tsx` | Eventualno prilagodi poruke |

## Očekivani rezultat

- Samo jedan email stiže (sa `verification@pausalbox.rs`)
- Link vodi na `https://pausalbox.aiknjigovodja.rs/verify?token=...`
- Nema više `auth.lovable.cloud` emailova

