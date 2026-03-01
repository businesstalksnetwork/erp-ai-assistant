import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const TENANT_ID = "7774c25d-d9c0-4b26-a9eb-983f28cac822";
const BATCH_SIZE = 500;

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
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

    // Fetch CSV from storage
    const { data: fileData, error: dlError } = await supabase.storage
      .from("legacy-imports")
      .download("dbo.A_UnosPodataka.csv");

    if (dlError) throw new Error(`Storage download error: ${dlError.message}`);

    const csvText = await fileData.text();
    const lines = csvText.split("\n").filter((l) => l.trim().length > 0);

    // Get existing SKUs to deduplicate
    const { data: existingSkus } = await supabase
      .from("products")
      .select("sku")
      .eq("tenant_id", TENANT_ID);
    const skuSet = new Set((existingSkus || []).map((r: any) => r.sku));

    let inserted = 0;
    let skipped = 0;
    const errors: string[] = [];
    const batch: any[] = [];

    for (const line of lines) {
      const cols = parseCSVLine(line);
      if (cols.length < 2) continue;

      const sku = cols[0] || null;
      const name = cols[1] || "";
      if (!name) continue;

      if (sku && skuSet.has(sku)) { skipped++; continue; }
      if (sku) skuSet.add(sku);

      const unitOfMeasure = cols[2] || "kom";
      const purchasePrice = parseFloat(cols[4]) || 0;
      const salePrice = parseFloat(cols[5]) || 0;
      const isActive = (cols[6] || "1") === "1";

      const categories = [cols[7], cols[8], cols[9], cols[10], cols[11]]
        .filter(Boolean)
        .filter((c) => c.trim().length > 0);
      const description = categories.join(" > ") || null;

      batch.push({
        tenant_id: TENANT_ID,
        sku,
        name,
        unit_of_measure: unitOfMeasure,
        default_purchase_price: purchasePrice,
        purchase_price: purchasePrice,
        default_sale_price: salePrice,
        default_retail_price: salePrice,
        is_active: isActive,
        description,
      });

      if (batch.length >= BATCH_SIZE) {
        const { error } = await supabase.from("products").insert(batch);
        if (error) {
          errors.push(error.message);
        } else {
          inserted += batch.length;
        }
        batch.length = 0;
      }
    }

    // Insert remaining
    if (batch.length > 0) {
      const { error } = await supabase.from("products").insert(batch);
      if (error) {
        errors.push(error.message);
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted, skipped, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("import-legacy-products error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
