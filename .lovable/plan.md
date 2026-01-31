

# Plan: Migracija na DigitalOcean Spaces (S3-kompatibilan storage)

## Pregled trenutnog stanja

Projekat trenutno koristi 4 Supabase Storage bucket-a:

| Bucket | Sadržaj | Javni/Privatni | Broj fajlova |
|--------|---------|----------------|--------------|
| `company-logos` | Logoi kompanija | Javni | ~7 |
| `company-documents` | Dokumenti kompanija | Privatni | ~15 |
| `reminder-attachments` | Prilozi podsetnika | Privatni | ~16 |
| `invoice-pdfs` | PDF fakture za email | Privatni | Dinamički |

**Ukupno fajlova za migraciju**: ~38+ fajlova

---

## Arhitektura rešenja

### Nova struktura foldera na DigitalOcean Spaces

```text
bucket-name/
├── users/
│   └── {user_id}/
│       ├── logos/
│       │   └── {company_id}/{timestamp}_{filename}
│       ├── documents/
│       │   └── {company_id}/{folder_id}/{timestamp}_{filename}
│       ├── reminders/
│       │   └── {company_id}/{timestamp}_{filename}
│       └── invoices/
│           └── {company_id}/{invoice_id}_{timestamp}.pdf
```

Ovako je sve organizovano po korisniku (user_id), a zatim po tipu sadržaja.

---

## Faze implementacije

### Faza 1: Priprema i konfiguracija

1. **Dodavanje DigitalOcean Spaces kredencijala**
   - Potrebni secrets: `DO_SPACES_KEY`, `DO_SPACES_SECRET`, `DO_SPACES_BUCKET`, `DO_SPACES_REGION`, `DO_SPACES_ENDPOINT`

2. **Kreiranje storage servisnog sloja**
   - Nova edge funkcija: `storage-service` - centralizovana tačka za sve storage operacije
   - Podržava: upload, download, delete, presigned URLs, list files

### Faza 2: Kreiranje edge funkcija

1. **`storage-upload`** - Upload fajlova na DigitalOcean Spaces
2. **`storage-download`** - Generisanje presigned URL-ova za preuzimanje
3. **`storage-delete`** - Brisanje fajlova
4. **`storage-migrate`** - Jednokratna migracija postojećih fajlova

### Faza 3: Ažuriranje frontend hook-ova

Potrebno je ažurirati sledeće hook-ove da koriste nove edge funkcije umesto direktnog Supabase Storage API-ja:

| Hook | Fajl |
|------|------|
| `useDocuments` | `src/hooks/useDocuments.ts` |
| `useReminders` | `src/hooks/useReminders.ts` |
| `useInvoiceEmail` | `src/hooks/useInvoiceEmail.ts` |

I komponente:
- `src/pages/Companies.tsx` (logo upload)
- `src/pages/CompanyProfile.tsx` (logo upload)

### Faza 4: Migracija postojećih podataka

1. Kreiranje admin edge funkcije koja:
   - Lista sve fajlove iz svih Supabase bucket-a
   - Preuzima svaki fajl
   - Upload-uje na DigitalOcean Spaces sa novom strukturom
   - Ažurira URL-ove u bazi podataka

2. Ažuriranje baze:
   - `companies.logo_url` - novi DO URL
   - `documents.file_path` - novi DO path
   - `payment_reminders.attachment_url` - novi DO path

---

## Tehnički detalji

### Edge funkcija: storage-upload

```typescript
// Primer strukture
// PUT /storage-upload
// Body: { type: 'logo'|'document'|'reminder'|'invoice', companyId, folderId?, file }

const SPACES_ENDPOINT = Deno.env.get('DO_SPACES_ENDPOINT');
const SPACES_BUCKET = Deno.env.get('DO_SPACES_BUCKET');
// ... S3 kompatibilni SDK
```

### Izmene u useDocuments.ts

```typescript
// Umesto direktnog Supabase storage poziva:
const { error } = await supabase.storage.from('company-documents').upload(path, file);

// Koristićemo edge funkciju:
const formData = new FormData();
formData.append('file', file);
formData.append('type', 'document');
formData.append('companyId', companyId);
formData.append('folderId', folderId);

const { data, error } = await supabase.functions.invoke('storage-upload', {
  body: formData
});
```

### Presigned URLs za privatne fajlove

Za preuzimanje privatnih fajlova (dokumenti, fakture), edge funkcija generiše presigned URL sa ograničenim trajanjem (1h za dokumente, 7 dana za fakture).

---

## Potrebni koraci od korisnika

1. **Kreirati DigitalOcean Spaces bucket**
   - Izabrati region (npr. `fra1` za Frankfurt)
   - Podesiti kao privatni bucket
   - Omogućiti CDN (opcionalno, za logoe)

2. **Generisati API ključeve**
   - Spaces Access Key
   - Spaces Secret Key

3. **Dostaviti podatke za konfiguraciju**:
   - Bucket name
   - Region
   - Endpoint URL
   - Access Key
   - Secret Key

---

## Rizici i napomene

1. **Vreme migracije** - Sa ~40 fajlova, migracija bi trajala nekoliko minuta
2. **Downtime** - Potreban kratak period kada se menjaju URL-ovi u bazi
3. **Stari linkovi** - Postojeći Supabase URL-ovi u emailovima neće raditi nakon migracije
4. **Testiranje** - Potrebno temeljno testiranje svih funkcionalnosti pre produkcije

---

## Alternativno rešenje

Umesto potpune migracije, možemo implementirati **hibridni pristup**:
- Novi fajlovi idu na DigitalOcean Spaces
- Stari fajlovi ostaju na Supabase dok ne isteknu
- Postepena migracija tokom vremena

