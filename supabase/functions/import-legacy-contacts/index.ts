import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

const TENANT_ID = "7774c25d-d9c0-4b26-a9eb-983f28cac822";
const BATCH_SIZE = 200;

function parseCSVLine(line: string): string[] {
  const result: string[] = []; let current = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } } else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; } else { current += ch; }
  }
  result.push(current.trim()); return result;
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: fileData, error: dlError } = await supabase.storage.from("legacy-imports").download("dbo.A_aPodaci.csv");
    if (dlError) throw new Error(`Storage download error: ${dlError.message}`);

    const csvText = await fileData.text();
    const lines = csvText.split("\n").filter((l) => l.trim().length > 0);

    const { data: existingContacts } = await supabase.from("contacts").select("email").eq("tenant_id", TENANT_ID).not("email", "is", null);
    const emailSet = new Set((existingContacts || []).map((r: any) => r.email?.toLowerCase()));

    let inserted = 0; let skipped = 0; const errors: string[] = []; const batch: any[] = [];

    for (const line of lines) {
      const cols = parseCSVLine(line);
      if (cols.length < 2) continue;
      const legacyPartnerId = cols[0] || null;
      const firstName = cols[1] || "";
      const lastName = cols[2] || null;
      const city = cols[4] || null;
      const email = cols[5] || null;
      const phone = cols[6] || null;

      if (!firstName) continue;
      if (email && emailSet.has(email.toLowerCase())) { skipped++; continue; }
      if (email) emailSet.add(email.toLowerCase());

      batch.push({
        tenant_id: TENANT_ID, firstName, lastName, email: email || null, phone: phone || null,
        city: city === "SRBIJA" ? null : city, country: city === "SRBIJA" ? "Serbia" : null,
        notes: legacyPartnerId ? `Legacy partner ref: ${legacyPartnerId}` : null, type: "contact",
      });

      if (batch.length >= BATCH_SIZE) {
        const { error } = await supabase.from("contacts").insert(batch);
        if (error) errors.push(error.message); else inserted += batch.length;
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      const { error } = await supabase.from("contacts").insert(batch);
      if (error) errors.push(error.message); else inserted += batch.length;
    }

    return new Response(
      JSON.stringify({ success: true, inserted, skipped, errors }),
      { status: 200, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) }
    );
  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "import-legacy-contacts" });
  }
});
