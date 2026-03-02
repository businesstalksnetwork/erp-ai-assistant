import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

const TENANT_ID = "7774c25d-d9c0-4b26-a9eb-983f28cac822";
const BATCH_SIZE = 500;

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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: fileData, error: dlError } = await supabase.storage.from("legacy-imports").download("dbo.A_UnosPodataka_Partner.csv");
    if (dlError) throw new Error(`Storage download error: ${dlError.message}`);

    const csvText = await fileData.text();
    const lines = csvText.split("\n").filter((l) => l.trim().length > 0);

    const { data: existingPartners } = await supabase.from("partners").select("pib, name").eq("tenant_id", TENANT_ID);
    const pibSet = new Set((existingPartners || []).filter((r: any) => r.pib).map((r: any) => r.pib));
    const nameSet = new Set((existingPartners || []).map((r: any) => r.name?.toLowerCase()));

    let inserted = 0; let skipped = 0; const errors: string[] = []; const batch: any[] = [];

    for (const line of lines) {
      const cols = parseCSVLine(line);
      if (cols.length < 2) continue;
      const partnerCode = cols[0] || null;
      const name = cols[1] || "";
      if (!name) continue;
      const country = cols[2] || "Serbia";
      const city = cols[3] || null;
      const pib = cols[4] || null;
      const contactPerson = cols[5] || null;

      if (pib && pibSet.has(pib)) { skipped++; continue; }
      if (!pib && nameSet.has(name.toLowerCase())) { skipped++; continue; }
      if (pib) pibSet.add(pib); nameSet.add(name.toLowerCase());

      batch.push({
        tenant_id: TENANT_ID, name, city, country, pib: pib || null, contact_person: contactPerson,
        type: "customer", notes: partnerCode ? `Legacy code: ${partnerCode}` : null, is_active: true,
      });

      if (batch.length >= BATCH_SIZE) {
        const { error } = await supabase.from("partners").insert(batch);
        if (error) errors.push(error.message); else inserted += batch.length;
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      const { error } = await supabase.from("partners").insert(batch);
      if (error) errors.push(error.message); else inserted += batch.length;
    }

    return new Response(
      JSON.stringify({ success: true, inserted, skipped, errors }),
      { status: 200, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) }
    );
  } catch (err) {
    return createErrorResponse(err, req, { logPrefix: "import-legacy-partners" });
  }
});
