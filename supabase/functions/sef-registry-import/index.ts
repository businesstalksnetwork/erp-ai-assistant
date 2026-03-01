import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { csvContent, clearExisting } = await req.json();

    if (!csvContent) {
      return new Response(
        JSON.stringify({ error: 'No CSV content provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting SEF registry import...');

    // Clear existing data if requested
    if (clearExisting) {
      console.log('Clearing existing SEF registry data...');
      const { error: deleteError } = await supabase
        .from('sef_registry')
        .delete()
        .neq('pib', ''); // Delete all rows
      
      if (deleteError) {
        console.error('Error clearing data:', deleteError);
      }
    }

    // Parse CSV
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

    console.log(`Parsed ${entries.length} valid entries, ${parseErrors} errors`);

    // Deduplicate entries by PIB (keep last occurrence)
    const uniqueEntries = Array.from(
      new Map(entries.map(entry => [entry.pib, entry])).values()
    );

    console.log(`Deduplicated to ${uniqueEntries.length} unique PIBs`);

    // Insert in batches of 1000
    const batchSize = 1000;
    let imported = 0;
    let duplicates = 0;

    for (let i = 0; i < uniqueEntries.length; i += batchSize) {
      const batch = uniqueEntries.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('sef_registry')
        .upsert(batch, { 
          onConflict: 'pib',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`Batch ${i / batchSize + 1} error:`, error);
        
        // Fallback: try single entry upsert for each item in failed batch
        for (const entry of batch) {
          const { error: singleError } = await supabase
            .from('sef_registry')
            .upsert([entry], { onConflict: 'pib', ignoreDuplicates: false });
          
          if (singleError) {
            console.error(`Single entry error for PIB ${entry.pib}:`, singleError);
            duplicates++;
          } else {
            imported++;
          }
        }
      } else {
        imported += batch.length;
      }

      // Log progress every 10 batches
      if ((i / batchSize) % 10 === 0) {
        console.log(`Progress: ${i + batch.length}/${uniqueEntries.length}`);
      }
    }

    console.log(`Import complete: ${imported} imported, ${duplicates} duplicates/errors`);

    return new Response(
      JSON.stringify({
        success: true,
        totalLines: lines.length - 1,
        parsed: entries.length,
        uniquePibs: uniqueEntries.length,
        imported,
        duplicates,
        parseErrors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
