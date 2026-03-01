import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const TENANT_ID = "f726c1e8-4ad3-47c6-94b7-dfd39bfa07b8";
const LEGAL_ENTITY_ID = "80a07d0f-3014-4475-9876-be51c5d3f714";
const BATCH_SIZE = 100;

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { step, data } = body;

    let result: any = {};

    switch (step) {
      case "partners": {
        // Get existing PIBs
        const { data: existing } = await supabase
          .from("partners")
          .select("pib, name")
          .eq("tenant_id", TENANT_ID);
        const pibSet = new Set((existing || []).filter((r: any) => r.pib).map((r: any) => r.pib));
        const nameSet = new Set((existing || []).map((r: any) => r.name?.toLowerCase()));

        let inserted = 0, skipped = 0;
        const errors: string[] = [];
        const batch: any[] = [];

        for (const p of data) {
          const name = p.name?.trim();
          if (!name) continue;
          const pib = p.pib?.trim() || null;

          if (pib && pibSet.has(pib)) { skipped++; continue; }
          if (!pib && nameSet.has(name.toLowerCase())) { skipped++; continue; }
          if (pib) pibSet.add(pib);
          nameSet.add(name.toLowerCase());

          batch.push({
            tenant_id: TENANT_ID,
            name,
            pib: pib || null,
            maticni_broj: p.maticni_broj || null,
            city: p.city || null,
            postal_code: p.postal_code || null,
            country: p.country || "Srbija",
            type: "customer",
            is_active: true,
            notes: [
              p.legacy_code ? `Šifra: ${p.legacy_code}` : null,
              p.partner_type ? `Tip: ${p.partner_type}` : null,
              p.bank_accounts ? `Računi: ${p.bank_accounts}` : null,
            ].filter(Boolean).join("; ") || null,
          });

          if (batch.length >= BATCH_SIZE) {
            const { error } = await supabase.from("partners").insert(batch);
            if (error) errors.push(error.message);
            else inserted += batch.length;
            batch.length = 0;
          }
        }
        if (batch.length > 0) {
          const { error } = await supabase.from("partners").insert(batch);
          if (error) errors.push(error.message);
          else inserted += batch.length;
        }
        result = { inserted, skipped, errors };
        break;
      }

      case "products": {
        const { data: existing } = await supabase
          .from("products")
          .select("sku")
          .eq("tenant_id", TENANT_ID);
        const skuSet = new Set((existing || []).map((r: any) => r.sku));

        let inserted = 0, skipped = 0;
        const errors: string[] = [];
        const batch: any[] = [];

        for (const p of data) {
          const name = p.name?.trim();
          if (!name) continue;
          const sku = p.sku?.trim() || null;

          if (sku && skuSet.has(sku)) { skipped++; continue; }
          if (sku) skuSet.add(sku);

          batch.push({
            tenant_id: TENANT_ID,
            sku,
            name,
            unit_of_measure: p.unit || "KOM",
            barcode: p.barcode || null,
            is_active: true,
            description: p.is_service ? "Usluga" : null,
            default_sale_price: p.sale_price || 0,
            default_retail_price: p.retail_price || 0,
            default_purchase_price: 0,
          });

          if (batch.length >= BATCH_SIZE) {
            const { error } = await supabase.from("products").insert(batch);
            if (error) {
              // fallback: insert one by one
              for (const item of batch) {
                const { error: e2 } = await supabase.from("products").insert(item);
                if (e2) errors.push(`${item.sku}: ${e2.message}`);
                else inserted++;
              }
            } else {
              inserted += batch.length;
            }
            batch.length = 0;
          }
        }
        if (batch.length > 0) {
          const { error } = await supabase.from("products").insert(batch);
          if (error) {
            for (const item of batch) {
              const { error: e2 } = await supabase.from("products").insert(item);
              if (e2) errors.push(`${item.sku}: ${e2.message}`);
              else inserted++;
            }
          } else {
            inserted += batch.length;
          }
        }
        result = { inserted, skipped, errors };
        break;
      }

      case "employees": {
        const { data: existing } = await supabase
          .from("employees")
          .select("jmbg")
          .eq("tenant_id", TENANT_ID);
        const jmbgSet = new Set((existing || []).filter((r: any) => r.jmbg).map((r: any) => r.jmbg));

        let inserted = 0, skipped = 0;
        const errors: string[] = [];

        for (const e of data) {
          if (e.jmbg && jmbgSet.has(e.jmbg)) { skipped++; continue; }
          if (e.jmbg) jmbgSet.add(e.jmbg);

          const { error } = await supabase.from("employees").insert({
            tenant_id: TENANT_ID,
            first_name: e.first_name,
            last_name: e.last_name,
            full_name: `${e.first_name} ${e.last_name}`,
            jmbg: e.jmbg || null,
            city: e.city || null,
            employment_type: "full_time",
            status: "active",
          });
          if (error) errors.push(`${e.first_name} ${e.last_name}: ${error.message}`);
          else inserted++;
        }
        result = { inserted, skipped, errors };
        break;
      }

      case "chart_of_accounts": {
        // Insert chart of accounts entries
        const { data: existing } = await supabase
          .from("chart_of_accounts")
          .select("code")
          .eq("tenant_id", TENANT_ID);
        const codeSet = new Set((existing || []).map((r: any) => r.code));

        let inserted = 0, skipped = 0;
        const errors: string[] = [];

        for (const acc of data) {
          if (codeSet.has(acc.code)) { skipped++; continue; }
          codeSet.add(acc.code);

          // Determine account type by prefix
          const prefix = acc.code.charAt(0);
          let accountType = "asset";
          if (prefix === "3") accountType = "equity";
          else if (prefix === "4") accountType = "liability";
          else if (prefix === "5") accountType = "revenue";
          else if (prefix === "6") accountType = "expense";

          const { error } = await supabase.from("chart_of_accounts").insert({
            tenant_id: TENANT_ID,
            code: acc.code,
            name: acc.name,
            account_type: accountType,
            is_active: true,
          });
          if (error) errors.push(`${acc.code}: ${error.message}`);
          else inserted++;
        }
        result = { inserted, skipped, errors };
        break;
      }

      case "opening_balances": {
        // Create a journal entry with all opening balance lines
        // First, resolve account codes to IDs
        const { data: accounts } = await supabase
          .from("chart_of_accounts")
          .select("id, code")
          .eq("tenant_id", TENANT_ID);

        const codeToId: Record<string, string> = {};
        for (const a of accounts || []) {
          codeToId[a.code] = a.id;
        }

        // Check if PST000 already exists
        const { data: existingJE } = await supabase
          .from("journal_entries")
          .select("id")
          .eq("tenant_id", TENANT_ID)
          .eq("entry_number", "PST000")
          .limit(1);

        if (existingJE && existingJE.length > 0) {
          result = { message: "PST000 already exists", id: existingJE[0].id };
          break;
        }

        // Create the journal entry header
        const { data: je, error: jeError } = await supabase
          .from("journal_entries")
          .insert({
            tenant_id: TENANT_ID,
            legal_entity_id: LEGAL_ENTITY_ID,
            entry_number: "PST000",
            entry_date: "2025-01-01",
            description: "POČETNO STANJE",
            reference: "PS",
            status: "posted",
            posted_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (jeError) throw new Error(`Journal entry error: ${jeError.message}`);

        // Insert journal lines
        let linesInserted = 0;
        const lineErrors: string[] = [];

        for (let i = 0; i < data.length; i++) {
          const line = data[i];
          const accountId = codeToId[line.account_code];
          if (!accountId) {
            lineErrors.push(`Account ${line.account_code} not found`);
            continue;
          }

          const { error: lineError } = await supabase
            .from("journal_lines")
            .insert({
              journal_entry_id: je.id,
              account_id: accountId,
              debit: line.debit || 0,
              credit: line.credit || 0,
              description: line.description || "POČETNO STANJE",
              sort_order: i + 1,
            });

          if (lineError) lineErrors.push(`Line ${line.account_code}: ${lineError.message}`);
          else linesInserted++;
        }

        result = { journal_entry_id: je.id, linesInserted, lineErrors };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown step: ${step}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, step, ...result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("import-bcility-data error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
