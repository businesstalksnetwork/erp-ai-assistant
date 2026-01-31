
# Plan: Ispravka Edge Funkcija za DigitalOcean Spaces

## Dijagnostikovan problem

Greška u logovima:
```
Error: [unenv] fs.readFile is not implemented yet!
```

**Uzrok**: AWS S3 SDK (`@aws-sdk/client-s3`) importovan preko `esm.sh` koristi Node.js `fs` modul za čitanje konfiguracionih fajlova (npr. `~/.aws/config`). Ovaj modul nije dostupan u Deno/Edge runtime okruženju.

## Rešenje

Zamena AWS S3 SDK sa **s3-lite-client** - lightweight bibliotekom dizajniranom specifično za Deno i S3-kompatibilne storage servise (uključujući DigitalOcean Spaces).

### Prednosti s3-lite-client:
- Napravljen za Deno runtime
- Nema zavisnosti od Node.js modula
- Podržava presigned URLs
- Kompatibilan sa DigitalOcean Spaces

## Izmene po fajlovima

### 1. `supabase/functions/storage-upload/index.ts`

**Izmene:**
- Zamena importa: `@aws-sdk/client-s3` → `s3_lite_client`
- Korišćenje `S3Client` iz Deno biblioteke
- Metoda `putObject()` umesto `send(PutObjectCommand)`

```typescript
// STARO:
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.712.0';

// NOVO:
import { S3Client } from 'https://deno.land/x/s3_lite_client@0.7.0/mod.ts';

// STARO:
const command = new PutObjectCommand({...});
await s3Client.send(command);

// NOVO:
await s3Client.putObject(path, buffer, {
  metadata: { 'Content-Type': contentType },
  // ACL nije direktno podržan, public-read se postiže bucket policy-jem
});
```

### 2. `supabase/functions/storage-download/index.ts`

**Izmene:**
- Zamena importa za S3 klijent i presigner
- Korišćenje `getPresignedUrl()` metode iz s3-lite-client

```typescript
// STARO:
import { S3Client, GetObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.712.0';
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3.712.0';

// NOVO:
import { S3Client } from 'https://deno.land/x/s3_lite_client@0.7.0/mod.ts';

// STARO:
const command = new GetObjectCommand({...});
const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });

// NOVO:
const signedUrl = await s3Client.getPresignedUrl('GET', path, { expiresIn });
```

### 3. `supabase/functions/storage-delete/index.ts`

**Izmene:**
- Zamena importa
- Korišćenje `deleteObject()` metode

```typescript
// STARO:
import { S3Client, DeleteObjectCommand, DeleteObjectsCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.712.0';

// NOVO:
import { S3Client } from 'https://deno.land/x/s3_lite_client@0.7.0/mod.ts';

// STARO:
const command = new DeleteObjectCommand({...});
await s3Client.send(command);

// NOVO:
await s3Client.deleteObject(path);
```

### 4. `supabase/functions/storage-migrate/index.ts`

**Izmene:**
- Iste izmene kao za upload
- Korišćenje `putObject()` za upload migriranih fajlova

## Konfiguracija S3 klijenta za s3-lite-client

```typescript
function getS3Client() {
  const endpoint = Deno.env.get('DO_SPACES_ENDPOINT')!;
  const region = Deno.env.get('DO_SPACES_REGION')!;
  const bucket = Deno.env.get('DO_SPACES_BUCKET')!;
  
  return new S3Client({
    endPoint: endpoint.replace('https://', '').replace('http://', ''),
    port: 443,
    useSSL: true,
    region,
    bucket,
    accessKey: Deno.env.get('DO_SPACES_KEY')!,
    secretKey: Deno.env.get('DO_SPACES_SECRET')!,
    pathStyle: false,
  });
}
```

## Napomena o ACL (Access Control List)

s3-lite-client ne podržava direktno `ACL` parametar u `putObject()`. Za javne logoe (public-read), postoje dve opcije:

1. **Bucket Policy** - Podesiti bucket policy na DigitalOcean da dozvoli javni pristup za `users/*/logos/*` putanje
2. **Separate bucket** - Koristiti poseban javni bucket samo za logoe

Preporučujem opciju 1 jer je jednostavnija i ne zahteva promene u kodu.

## Redosled implementacije

1. Ažurirati `storage-upload/index.ts` sa s3-lite-client
2. Ažurirati `storage-download/index.ts` sa s3-lite-client
3. Ažurirati `storage-delete/index.ts` sa s3-lite-client
4. Ažurirati `storage-migrate/index.ts` sa s3-lite-client
5. Deploy-ovati funkcije
6. Testirati upload dokumenta

## Očekivani rezultat

Nakon implementacije, upload dokumenata će raditi bez greške `fs.readFile is not implemented` jer s3-lite-client ne koristi Node.js specifične module.
