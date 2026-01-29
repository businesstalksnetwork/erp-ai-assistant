

# Custom Auth Verification Emails via Resend

## Pregled

Implementiraćemo custom sistem za slanje verifikacionih emailova prilikom registracije korisnika. Umesto default Lovable Cloud emailova (`no-reply@auth.lovable.cloud`), emailovi će ići sa **`verification@pausalbox.rs`** putem Resend-a.

## Kako će raditi

```text
┌──────────────┐     ┌─────────────────┐     ┌──────────────────────────┐     ┌─────────┐
│   Korisnik   │────▶│   Auth.tsx      │────▶│ send-verification-email  │────▶│ Resend  │
│ (registruje  │     │ (poziva edge    │     │ (Edge Function)          │     │   API   │
│     se)      │     │  funkciju)      │     │ - generiše token         │     │         │
└──────────────┘     └─────────────────┘     │ - čuva u verification_   │     └────┬────┘
                                              │   tokens tabeli          │          │
                                              │ - šalje custom email     │          │
                                              └──────────────────────────┘          │
                                                                                    ▼
┌──────────────┐     ┌─────────────────┐     ┌──────────────────────────┐     ┌─────────┐
│   Korisnik   │────▶│  /verify?token= │────▶│ verify-email             │────▶│Supabase │
│  (klikne na  │     │    (ruta)       │     │ (Edge Function)          │     │  Auth   │
│    link)     │     │                 │     │ - validira token         │     │(confirm)│
└──────────────┘     └─────────────────┘     │ - poziva admin confirm   │     └─────────┘
                                              └──────────────────────────┘
```

## Koraci implementacije

### 1. Kreiranje tabele `verification_tokens`

Čuvaćemo custom tokene za verifikaciju:

```sql
CREATE TABLE public.verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index za brzo pronalaženje tokena
CREATE INDEX idx_verification_tokens_token ON public.verification_tokens(token);

-- RLS - samo service role može pristupiti
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;
```

### 2. Email template za verifikaciju

Dodaćemo template u `email_templates` tabelu:

```sql
INSERT INTO public.email_templates (template_key, name, subject, html_content, description, placeholders)
VALUES (
  'email_verification',
  'Verifikacija email adrese',
  'Potvrdite vašu email adresu - PausalBox',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #333;">Dobrodošli u PausalBox!</h2>
    <p>Poštovani {{full_name}},</p>
    <p>Hvala vam što ste se registrovali. Da biste aktivirali vaš nalog, molimo vas da potvrdite vašu email adresu klikom na dugme ispod:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{verification_url}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Potvrdi email adresu</a>
    </div>
    <p style="color: #666; font-size: 14px;">Ako dugme ne radi, kopirajte ovaj link u browser:</p>
    <p style="color: #666; font-size: 12px; word-break: break-all;">{{verification_url}}</p>
    <p style="color: #999; font-size: 12px; margin-top: 30px;">Link ističe za 24 sata.</p>
  </div>',
  'Template za verifikaciju email adrese',
  '["full_name", "verification_url"]'
);
```

### 3. Edge funkcija: `send-verification-email`

Nova edge funkcija koja:
- Prima user_id i email
- Generiše sigurni token (crypto.randomUUID)
- Čuva token u `verification_tokens` tabeli (ističe za 24h)
- Šalje email preko Resend-a sa `verification@pausalbox.rs`

```typescript
// supabase/functions/send-verification-email/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const PRODUCTION_URL = "https://pausalbox.aiknjigovodja.rs";

// Generiše token, čuva u bazu, šalje email
```

### 4. Edge funkcija: `verify-email`

Edge funkcija za verifikaciju tokena:
- Prima token iz query stringa
- Proverava validnost i rok isteka
- Koristi Supabase Admin API da potvrdi korisnika
- Markira token kao iskorišćen

```typescript
// supabase/functions/verify-email/index.ts
// Validira token i potvrđuje korisnika
```

### 5. Ažuriranje `Auth.tsx`

Promenićemo signup flow:
- Posle uspešnog `signUp()`, pozivamo `send-verification-email` edge funkciju
- Prikazujemo poruku da provere inbox

### 6. Nova stranica: `/verify`

Jednostavna stranica koja:
- Čita `token` iz URL-a
- Poziva `verify-email` edge funkciju
- Prikazuje uspeh ili grešku
- Redirect na login posle uspešne verifikacije

## Šta ostaje isto

- Postojeći `send-invoice-email` i `send-notification-emails` - ne diramo
- Password reset flow - koristi default Supabase mehanizam (može se kasnije prebaciti na isti način)

## Fajlovi koji se menjaju/kreiraju

| Fajl | Akcija |
|------|--------|
| `supabase/functions/send-verification-email/index.ts` | Novi |
| `supabase/functions/verify-email/index.ts` | Novi |
| `supabase/config.toml` | Dodaj dve funkcije |
| `src/pages/Auth.tsx` | Izmena signup flowa |
| `src/pages/VerifyEmail.tsx` | Nova stranica |
| `src/App.tsx` | Dodaj rutu `/verify` |
| SQL migracija | Tabela + template |

## Očekivani rezultat

- Verifikacioni email dolazi sa `verification@pausalbox.rs`
- Custom dizajn emaila (PausalBox branding)
- Link vodi direktno na `https://pausalbox.aiknjigovodja.rs/verify?token=...`
- Korisnik vidi lepu poruku posle verifikacije i biva preusmeren na login

