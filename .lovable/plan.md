

# Automatski nedeljni update SEF registra firmi

## Pregled rešenja

Kreiraće se nova Edge funkcija `sef-registry-auto-update` koja će:
1. Automatski preuzeti CSV fajl sa https://efaktura.gov.rs/extfile/sr/list/spisak_firmi.csv
2. Procesirati sadržaj koristeći već postojeću logiku iz `sef-registry-import`
3. Ažurirati bazu podataka (upsert - novi zapisi se dodaju, postojeći se ažuriraju)
4. Logovati rezultate za monitoring

Cron job će pokretati ovu funkciju jednom nedeljno (npr. ponedeljkom u 3:00 ujutru).

## Arhitektura

```text
┌─────────────────────────────────────┐
│          pg_cron                    │
│    (ponedeljak 3:00 AM)             │
└──────────────┬──────────────────────┘
               │ HTTP POST
               ▼
┌─────────────────────────────────────┐
│   sef-registry-auto-update          │
│   Edge Function                     │
│                                     │
│   1. fetch() → efaktura.gov.rs CSV  │
│   2. Parse CSV (;, \r, datumi...)   │
│   3. Deduplikovati po PIB           │
│   4. Upsert u sef_registry tabelu   │
│   5. Log rezultate                  │
└─────────────────────────────────────┘
```

## Tehnička implementacija

### 1. Nova Edge funkcija: `supabase/functions/sef-registry-auto-update/index.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CSV_URL = 'https://efaktura.gov.rs/extfile/sr/list/spisak_firmi.csv';

interface RegistryEntry {
  pib: string;
  jbkjs: string | null;
  registration_date: string | null;
  deletion_date: string | null;
}

// Funkcije parseDate i parseCSVLine iste kao u sef-registry-import
// ...

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting automatic SEF registry update...');
    
    // 1. Fetch CSV from government website
    const csvResponse = await fetch(CSV_URL);
    if (!csvResponse.ok) {
      throw new Error(`Failed to fetch CSV: ${csvResponse.status}`);
    }
    const csvContent = await csvResponse.text();
    console.log(`Downloaded CSV: ${csvContent.length} bytes`);

    // 2. Parse and process (reuse existing logic)
    // ... parsing logic ...

    // 3. Upsert to database
    // ... batch upsert with fallback ...

    // 4. Return results
    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      // ... stats ...
    }));
  } catch (error) {
    console.error('Auto-update error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { status: 500 });
  }
});
```

### 2. Konfiguracija funkcije: `supabase/config.toml`

Dodati novi entry:
```toml
[functions.sef-registry-auto-update]
verify_jwt = false  # Cron job nema JWT token
```

### 3. Cron job setup (SQL)

Poziv cron.schedule() za nedeljno pokretanje:
```sql
SELECT cron.schedule(
  'sef-registry-weekly-update',
  '0 3 * * 1',  -- Ponedeljkom u 03:00
  $$
  SELECT net.http_post(
    url := 'https://kskpmgohvrljbdphyzkw.supabase.co/functions/v1/sef-registry-auto-update',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

## Bezbednost

- Funkcija koristi `verify_jwt = false` jer je pozvana od strane cron job-a (koji nema korisničku sesiju)
- Ne briše postojeće podatke - koristi upsert koji ažurira ili dodaje
- Nije izložena riziku jer samo čita javno dostupan CSV

## Praćenje i logovanje

Edge funkcija će logovati:
- Vreme početka i kraja
- Veličinu preuzetog fajla
- Broj parsiranih, deduplikovanih i uvezenih zapisa
- Eventualne greške

## Preporuka za manuelnu proveru

U Admin Panel-u možete pratiti datum poslednjeg ažuriranja i statistiku registra. Predlažem da se u budućnosti doda:
- Polje `last_auto_update` u neku config tabelu
- Notifikacija adminu ako auto-update ne uspe

## Koraci implementacije

1. Kreirati novu Edge funkciju `sef-registry-auto-update`
2. Ažurirati `supabase/config.toml` sa novom funkcijom
3. Deploy Edge funkcije
4. Pokrenuti SQL za kreiranje cron job-a (jednom)

