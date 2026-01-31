
# Plan: Čišćenje Supabase Storage i Test Slanja Fakture

## Pregled trenutnog stanja

### Supabase Storage - Stari fajlovi za brisanje

| Bucket | Broj fajlova | Veličina |
|--------|--------------|----------|
| company-logos | 10 | ~3 MB |
| company-documents | 15 | ~1.7 MB |
| reminder-attachments | 29 | ~2.6 MB |
| invoice-pdfs | 17 | ~187 MB |
| **Ukupno** | **71 fajlova** | **~194 MB** |

**Napomena**: Bucket `invoice-pdfs` sadrži istorijske fajlove koji više nisu linkani (signed URL-ovi su istekli), ali brisanje ovog bucket-a oslobodiće najviše prostora.

## Koraci implementacije

### Korak 1: Kreiranje Edge funkcije za brisanje starih fajlova

Kreirati novu edge funkciju `storage-cleanup` koja će:
- Obrisati sve fajlove iz bucket-a: `company-logos`, `company-documents`, `reminder-attachments`, `invoice-pdfs`
- Zahtevati admin pristup za izvršavanje
- Podržati dry-run opciju za pregled šta će biti obrisano

### Korak 2: Pokretanje čišćenja

1. **Dry run** - prvo prikazati listu fajlova koji će biti obrisani
2. **Izvršenje** - obrisati sve fajlove iz navedenih bucket-a

### Korak 3: Test slanja fakture emailom

Poslati fakturu **5/2026** (MAXIMUS DETELINARA) na **bogdan.ciric023@gmail.com**:
1. Generisati PDF u browseru
2. Upload PDF-a na DigitalOcean Spaces
3. Kreirati signed URL za download
4. Poslati email sa linkom

---

## Tehnički detalji

### Nova Edge funkcija: storage-cleanup

```typescript
// supabase/functions/storage-cleanup/index.ts
- Prima: { dryRun: boolean, buckets?: string[] }
- Vraća: { deleted: number, errors: string[] }
- Koristi: supabase.storage.from(bucket).list() i remove()
```

### Flow slanja fakture

```
[Browser] → generatePdfBlob()
    ↓
[storage-upload] → DigitalOcean Spaces
    ↓
[storage-download] → Signed URL (7 dana)
    ↓
[send-invoice-email] → Resend API
    ↓
[Email] → bogdan.ciric023@gmail.com
```

### Očekivani rezultat

- Oslobođeno ~194 MB prostora na Lovable Cloud
- Potvrda da email flow radi sa DO Spaces
- Email stigao sa PDF prilogom na navedenu adresu
