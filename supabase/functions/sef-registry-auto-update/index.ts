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

// Parse date from DD.MM.YYYY format to YYYY-MM-DD
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Remove trailing dot and \r if present
  const cleanDate = dateStr.trim().replace(/\.?\r?$/, '');
  
  const parts = cleanDate.split('.');
  if (parts.length < 3) return null;
  
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  
  return `${year}-${month}-${day}`;
}

// Parse CSV line respecting quoted values
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.replace(/^"|"$/g, '').trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.replace(/^"|"$/g, '').trim());
  
  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('=== Starting automatic SEF registry update ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch CSV from government website
    console.log(`Fetching CSV from: ${CSV_URL}`);
    const csvResponse = await fetch(CSV_URL);
    
    if (!csvResponse.ok) {
      throw new Error(`Failed to fetch CSV: ${csvResponse.status} ${csvResponse.statusText}`);
    }
    
    const csvContent = await csvResponse.text();
    console.log(`Downloaded CSV: ${csvContent.length} bytes`);

    // 2. Parse CSV
    const lines = csvContent.split('\n').filter((line: string) => line.trim());
    console.log(`Total lines to process: ${lines.length}`);

    // Skip header row
    const dataLines = lines.slice(1);
    
    const entries: RegistryEntry[] = [];
    let parseErrors = 0;

    for (const line of dataLines) {
      try {
        // Try semicolon first (Serbian CSV format), then comma
        let cols = parseCSVLine(line, ';');
        if (cols.length < 3) {
          cols = parseCSVLine(line, ',');
        }

        if (cols.length < 3) {
          parseErrors++;
          continue;
        }

        const pibRaw = cols[0].replace(/\D/g, ''); // Keep only digits
        
        // PIB can be 9 or 13 digits
        if (!pibRaw || (pibRaw.length !== 9 && pibRaw.length !== 13)) {
          parseErrors++;
          continue;
        }

        // Use first 9 digits as the primary PIB identifier
        const pib = pibRaw.substring(0, 9);

        entries.push({
          pib,
          jbkjs: cols[1] || null,
          registration_date: parseDate(cols[2]),
          deletion_date: cols[3] ? parseDate(cols[3]) : null,
        });
      } catch (e) {
        parseErrors++;
      }
    }

    console.log(`Parsed ${entries.length} valid entries, ${parseErrors} parse errors`);

    // 3. Deduplicate entries by PIB (keep last occurrence)
    const uniqueEntries = Array.from(
      new Map(entries.map(entry => [entry.pib, entry])).values()
    );

    console.log(`Deduplicated to ${uniqueEntries.length} unique PIBs`);

    // 4. Upsert in batches of 1000
    const batchSize = 1000;
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < uniqueEntries.length; i += batchSize) {
      const batch = uniqueEntries.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('sef_registry')
        .upsert(batch, { 
          onConflict: 'pib',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, error);
        
        // Fallback: try single entry upsert for each item in failed batch
        for (const entry of batch) {
          const { error: singleError } = await supabase
            .from('sef_registry')
            .upsert([entry], { onConflict: 'pib', ignoreDuplicates: false });
          
          if (singleError) {
            console.error(`Single entry error for PIB ${entry.pib}:`, singleError);
            errors++;
          } else {
            imported++;
          }
        }
      } else {
        imported += batch.length;
      }

      // Log progress every 50 batches
      if ((i / batchSize) % 50 === 0) {
        console.log(`Progress: ${i + batch.length}/${uniqueEntries.length}`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('=== SEF Registry Auto-Update Complete ===');
    console.log(`Duration: ${duration}s`);
    console.log(`Total lines: ${lines.length - 1}`);
    console.log(`Parsed: ${entries.length}`);
    console.log(`Unique PIBs: ${uniqueEntries.length}`);
    console.log(`Imported: ${imported}`);
    console.log(`Errors: ${errors}`);
    console.log(`Parse errors: ${parseErrors}`);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        duration: `${duration}s`,
        stats: {
          totalLines: lines.length - 1,
          parsed: entries.length,
          uniquePibs: uniqueEntries.length,
          imported,
          errors,
          parseErrors,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error('=== SEF Registry Auto-Update FAILED ===');
    console.error(`Duration: ${duration}s`);
    console.error('Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        timestamp: new Date().toISOString(),
        duration: `${duration}s`,
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
