
# Plan: Popravka pristupa logoima firmi na DigitalOcean Spaces

## Dijagnoza problema

Logoi firmi se ne prikazuju jer su fajlovi postavljeni kao **privatni** na DigitalOcean Spaces. Kada browser pokušava da učita logo direktno iz `<img src="...">` taga, DigitalOcean vraća **`AccessDenied`** grešku.

### Detalji greške

| Aspekt | Vrednost |
|--------|----------|
| URL | `https://pausalbox.fra1.digitaloceanspaces.com/users/.../logos/.../logo.jpg` |
| Greška | `AccessDenied` (403) |
| Browser greška | `net::ERR_BLOCKED_BY_ORB` |
| Uzrok | Fajlovi uploadovani bez `public-read` ACL-a |

## Rešenje

Potrebno je uraditi dve stvari:

### Korak 1: Ispraviti upload funkciju za nove logoe

Izmeniti `storage-upload` Edge funkciju da postavlja `x-amz-acl: public-read` za logo fajlove.

**Lokacija**: `supabase/functions/storage-upload/index.ts`

**Izmena**:
```typescript
// Trenutni kod (linije 155-160):
await s3Client.putObject(path, buffer, {
  metadata: { 
    'Content-Type': contentType,
  },
});

// Novi kod:
await s3Client.putObject(path, buffer, {
  metadata: { 
    'Content-Type': contentType,
    ...(type === 'logo' && { 'x-amz-acl': 'public-read' }),
  },
});
```

### Korak 2: Popraviti postojeće logoe

Kreirati novu edge funkciju `storage-fix-logos` koja će:
1. Pročitati sve logoe iz baze (companies.logo_url koji počinju sa `https://pausalbox...`)
2. Za svaki logo:
   - Preuzeti fajl sa DO Spaces
   - Ponovo ga uploadovati sa `public-read` ACL-om
3. Ne menjati URL u bazi (ostaje isti)

**Nova funkcija**: `supabase/functions/storage-fix-logos/index.ts`

## Tehnički detalji

### s3-lite-client ACL podrška

Biblioteka `s3-lite-client` podržava postavljanje ACL-a kroz `metadata` opciju:

```typescript
await s3client.putObject("key", data, {
  metadata: {
    "x-amz-acl": "public-read",
  },
});
```

### Zahvaćeni fajlovi

Na osnovu prethodnog snimka baze, postoji **7 kompanija sa logoima** koje treba popraviti:
- PBC CONSULTING
- Studio Voho
- Aleksandar Mastilovic PR
- Milenko Čabrić PR Kera-ProMax
- LawIT
- Rajić Mont
- DAVIDOV Production

### Očekivani rezultat

- Novi logoi će se automatski uploadovati kao javni
- Postojeći logoi će postati javno dostupni nakon pokretanja fix funkcije
- Logoi će se pravilno prikazivati u aplikaciji bez grešaka

## Sažetak implementacije

| Fajl | Akcija |
|------|--------|
| `supabase/functions/storage-upload/index.ts` | Izmena - dodavanje ACL za logoe |
| `supabase/functions/storage-fix-logos/index.ts` | Novo - jednokratna popravka postojećih logoa |
| `supabase/config.toml` | Izmena - registracija nove funkcije |
