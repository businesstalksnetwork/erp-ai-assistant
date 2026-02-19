import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore — JSZip via esm.sh works at runtime in Deno
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map((l) => parseCSVLine(l));
  return { headers, rows };
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-table importers — each receives the CSV text and tenant_id, returns stats
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// Column map — derived from actual Uniprom CSV files:
//
// dbo.A_UnosPodataka.csv (Products, NO header row):
//   [0] SKU/sifra  [1] Name  [2] Unit  [3] qty_on_hand  [4] purchase_price
//   [5] sale_price  [6] is_active(1/0)  [7] cat1  [8] cat2  [9] cat3
//   [10] cat4  [11] cat5  [12] brand/supplier
//
// dbo.A_UnosPodataka_Partner.csv (Partners, NO header row):
//   [0] partner_code(P000001)  [1] name  [2] country  [3] city
//   [4] pib(may be empty)  [5] contact_person
//
// dbo.A_aPodaci.csv (Contacts, NO header row):
//   [0] legacy_partner_id  [1] last_name_or_company  [2] first_name
//   [3] role/empty  [4] city  [5] email  [6] phone
// ──────────────────────────────────────────────────────────────────────────────

async function importProducts(csvText: string, tenantId: string, supabase: any) {
  const lines = csvText.split("\n").filter((l) => l.trim().length > 0);

  // Detect if first line looks like a header (non-numeric first column)
  const firstCols = parseCSVLine(lines[0] || "");
  const hasHeader = firstCols.length > 0 && isNaN(Number(firstCols[0])) && firstCols[0].length > 0;
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const { data: existingSkus } = await supabase
    .from("products").select("sku").eq("tenant_id", tenantId);
  const skuSet = new Set((existingSkus || []).map((r: any) => r.sku));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    if (cols.length < 2) continue;

    // col[0] = SKU, col[1] = Name, col[2] = Unit
    // col[3] = qty_on_hand, col[4] = purchase_price, col[5] = sale_price
    // col[6] = is_active, col[7..11] = category hierarchy, col[12] = brand
    const sku = cols[0]?.trim() || null;
    const name = cols[1]?.trim() || "";
    if (!name) continue;
    if (sku && skuSet.has(sku)) { skipped++; continue; }
    if (sku) skuSet.add(sku);

    const unitOfMeasure = cols[2]?.trim() || "kom";
    const qtyOnHand = parseFloat(cols[3]) || 0;
    const purchasePrice = parseFloat(cols[4]) || 0;
    const salePrice = parseFloat(cols[5]) || 0;
    const isActive = (cols[6]?.trim() || "1") !== "0";
    const categories = [cols[7], cols[8], cols[9], cols[10], cols[11]]
      .map((c) => c?.trim()).filter(Boolean);
    const brand = cols[12]?.trim() || null;

    batch.push({
      tenant_id: tenantId,
      sku,
      name,
      unit_of_measure: unitOfMeasure,
      purchase_price: purchasePrice,
      default_purchase_price: purchasePrice,
      default_sale_price: salePrice,
      default_retail_price: salePrice,
      is_active: isActive,
      description: [brand ? `Brand: ${brand}` : null, categories.length ? categories.join(" > ") : null]
        .filter(Boolean).join(" | ") || null,
    });

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("products").insert(batch);
      if (error) errors.push(error.message); else inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { error } = await supabase.from("products").insert(batch);
    if (error) errors.push(error.message); else inserted += batch.length;
  }

  // Also seed inventory stock records for items with qty > 0
  // (best-effort: use first warehouse for this tenant)
  try {
    const { data: whs } = await supabase.from("warehouses").select("id").eq("tenant_id", tenantId).limit(1);
    if (whs && whs.length > 0) {
      const warehouseId = whs[0].id;
      // fetch freshly inserted products with qty > 0
      const skuArr = dataLines.map((l) => parseCSVLine(l)[0]?.trim()).filter(Boolean);
      const { data: prods } = await supabase.from("products")
        .select("id, sku").eq("tenant_id", tenantId).in("sku", skuArr.slice(0, 1000));
      if (prods && prods.length > 0) {
        const skuToId = Object.fromEntries(prods.map((p: any) => [p.sku, p.id]));
        const stockBatch: any[] = [];
        for (const line of dataLines) {
          const cols = parseCSVLine(line);
          const sku = cols[0]?.trim();
          const qty = parseFloat(cols[3]) || 0;
          const pid = skuToId[sku];
          if (pid && qty > 0) {
            stockBatch.push({ tenant_id: tenantId, product_id: pid, warehouse_id: warehouseId, quantity_on_hand: qty });
          }
        }
        if (stockBatch.length > 0) {
          await supabase.from("inventory_stock").upsert(stockBatch, { onConflict: "product_id,warehouse_id" });
        }
      }
    }
  } catch (_) { /* stock seeding is best-effort */ }

  return { inserted, skipped, errors };
}

async function importPartners(csvText: string, tenantId: string, supabase: any) {
  const lines = csvText.split("\n").filter((l) => l.trim().length > 0);

  // Detect header: first column of A_UnosPodataka_Partner.csv starts with "P000001" (numeric-ish)
  // If first col is "partner_code" or "kod" or similar text — skip it
  const firstCols = parseCSVLine(lines[0] || "");
  const hasHeader = firstCols.length > 0 && isNaN(Number(firstCols[0])) && !firstCols[0].startsWith("P0");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const { data: existingPartners } = await supabase.from("partners").select("pib, name").eq("tenant_id", tenantId);
  const pibSet = new Set((existingPartners || []).filter((r: any) => r.pib).map((r: any) => r.pib));
  const nameSet = new Set((existingPartners || []).map((r: any) => r.name?.toLowerCase()));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    if (cols.length < 2) continue;

    // col[0] = partner_code (P000001)
    // col[1] = name
    // col[2] = country
    // col[3] = city
    // col[4] = pib (tax ID, may be empty)
    // col[5] = contact_person
    const partnerCode = cols[0]?.trim() || null;
    const name = cols[1]?.trim() || "";
    if (!name) continue;
    const country = cols[2]?.trim() || "Serbia";
    const city = cols[3]?.trim() || null;
    const pib = cols[4]?.trim() || null;
    const contactPerson = cols[5]?.trim() || null;

    if (pib && pibSet.has(pib)) { skipped++; continue; }
    if (!pib && nameSet.has(name.toLowerCase())) { skipped++; continue; }
    if (pib) pibSet.add(pib);
    nameSet.add(name.toLowerCase());

    batch.push({
      tenant_id: tenantId,
      name,
      city,
      country,
      pib: pib || null,
      contact_person: contactPerson,
      type: "customer",
      is_active: true,
      notes: partnerCode ? `Legacy code: ${partnerCode}` : null,
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
  return { inserted, skipped, errors };
}

async function importContacts(csvText: string, tenantId: string, supabase: any) {
  const lines = csvText.split("\n").filter((l) => l.trim().length > 0);

  // dbo.A_aPodaci.csv — NO header row
  // col[0] = legacy_partner_id (numeric, links to partner)
  // col[1] = last_name (or company name if person has no last name)
  // col[2] = first_name (may be empty for company contacts)
  // col[3] = role/function (often empty)
  // col[4] = city
  // col[5] = email
  // col[6] = phone
  const firstCols = parseCSVLine(lines[0] || "");
  const hasHeader = firstCols.length > 0 && isNaN(Number(firstCols[0]));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const { data: existingContacts } = await supabase.from("contacts").select("email, first_name, last_name").eq("tenant_id", tenantId);
  const emailSet = new Set((existingContacts || []).filter((r: any) => r.email).map((r: any) => r.email?.toLowerCase()));
  // Dedup by name combination too (for contacts without email)
  const nameSet = new Set((existingContacts || []).map((r: any) => `${r.first_name}|${r.last_name}`.toLowerCase()));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    if (cols.length < 2) continue;

    const legacyPartnerId = cols[0]?.trim() || null;
    const lastName = cols[1]?.trim() || null;    // col[1] = last name
    const firstName = cols[2]?.trim() || null;   // col[2] = first name
    const role = cols[3]?.trim() || null;         // col[3] = role (often empty)
    const rawCity = cols[4]?.trim() || null;
    const email = cols[5]?.trim() || null;
    const phone = cols[6]?.trim() || null;

    // Contacts file sometimes has company name in col[1] with no first name
    // In that case treat col[1] as first_name (company name as contact)
    const effectiveFirst = firstName || lastName || "";
    const effectiveLast = firstName ? lastName : null;

    if (!effectiveFirst) continue;

    if (email && emailSet.has(email.toLowerCase())) { skipped++; continue; }
    const nameKey = `${effectiveFirst}|${effectiveLast}`.toLowerCase();
    if (!email && nameSet.has(nameKey)) { skipped++; continue; }
    if (email) emailSet.add(email.toLowerCase());
    nameSet.add(nameKey);

    // City cleanup: SRBIJA means Serbia (no city), or real city name
    const city = (rawCity && rawCity.toUpperCase() !== "SRBIJA") ? rawCity : null;
    const country = (!rawCity || rawCity.toUpperCase() === "SRBIJA") ? "Serbia" : null;

    batch.push({
      tenant_id: tenantId,
      first_name: effectiveFirst,
      last_name: effectiveLast,
      email: email || null,
      phone: phone || null,
      city,
      country,
      function_area: role || null,
      notes: legacyPartnerId ? `Legacy partner ref: ${legacyPartnerId}` : null,
      type: "contact",
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
  return { inserted, skipped, errors };
}

async function importWarehouses(csvText: string, tenantId: string, supabase: any) {
  const { headers, rows } = parseCSV(csvText);
  const nameIdx = headers.findIndex((h) => /name|naziv/i.test(h));
  const codeIdx = headers.findIndex((h) => /code|sifra/i.test(h));

  const { data: existing } = await supabase.from("warehouses").select("name").eq("tenant_id", tenantId);
  const nameSet = new Set((existing || []).map((r: any) => r.name?.toLowerCase()));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const row of rows) {
    const name = nameIdx >= 0 ? row[nameIdx] : row[0];
    if (!name) continue;
    if (nameSet.has(name.toLowerCase())) { skipped++; continue; }
    nameSet.add(name.toLowerCase());
    const code = codeIdx >= 0 ? row[codeIdx] : null;
    batch.push({ tenant_id: tenantId, name, code: code || name.substring(0, 10).toUpperCase() });

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("warehouses").insert(batch);
      if (error) errors.push(error.message); else inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { error } = await supabase.from("warehouses").insert(batch);
    if (error) errors.push(error.message); else inserted += batch.length;
  }
  return { inserted, skipped, errors };
}

async function importInvoicesHeuristic(csvText: string, tenantId: string, supabase: any) {
  const { headers, rows } = parseCSV(csvText);
  const h = headers.map((x) => x.toLowerCase());

  // Heuristic column detection
  const invNumIdx = h.findIndex((x) => /invoice.*num|broj.*faktur|faktura.*br/i.test(x)) >= 0
    ? h.findIndex((x) => /invoice.*num|broj.*faktur|faktura.*br/i.test(x))
    : h.findIndex((x) => /number|broj|num/i.test(x));
  const dateIdx = h.findIndex((x) => /date|datum/i.test(x));
  const totalIdx = h.findIndex((x) => /total|ukupno|iznos/i.test(x));
  const partnerIdx = h.findIndex((x) => /partner|customer|kupac|name|naziv/i.test(x));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  const { data: existing } = await supabase.from("invoices").select("invoice_number").eq("tenant_id", tenantId);
  const invSet = new Set((existing || []).map((r: any) => r.invoice_number));

  for (const row of rows) {
    const invNum = invNumIdx >= 0 ? row[invNumIdx] : null;
    if (!invNum) continue;
    if (invSet.has(invNum)) { skipped++; continue; }
    invSet.add(invNum);

    const rawDate = dateIdx >= 0 ? row[dateIdx] : null;
    let invoiceDate = new Date().toISOString().split("T")[0];
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) invoiceDate = parsed.toISOString().split("T")[0];
    }

    const total = totalIdx >= 0 ? parseFloat(row[totalIdx]) || 0 : 0;
    const partnerName = partnerIdx >= 0 ? row[partnerIdx] : "Unknown";

    batch.push({
      tenant_id: tenantId,
      invoice_number: invNum,
      invoice_date: invoiceDate,
      due_date: invoiceDate,
      status: "draft",
      partner_name: partnerName || "Unknown",
      total,
      subtotal: total,
      tax_amount: 0,
      currency: "RSD",
      notes: `Imported from legacy system`,
    });

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("invoices").insert(batch);
      if (error) errors.push(error.message); else inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { error } = await supabase.from("invoices").insert(batch);
    if (error) errors.push(error.message); else inserted += batch.length;
  }
  return { inserted, skipped, errors };
}

// Generic "store as-is" fallback for unmapped tables
async function importGeneric(csvText: string, _tenantId: string, _targetTable: string, _supabase: any) {
  const { rows } = parseCSV(csvText);
  return {
    inserted: 0,
    skipped: rows.length,
    errors: [`Table "${_targetTable}" does not have a dedicated importer yet — ${rows.length} rows skipped`],
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Dependency-ordered import dispatcher
// ──────────────────────────────────────────────────────────────────────────────
const IMPORT_ORDER = [
  "products", "partners", "contacts", "warehouses", "employees",
  "invoices", "supplier_invoices", "purchase_orders", "sales_orders",
  "journal_entries", "chart_of_accounts",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { storagePath, tenantId, confirmedMapping, sessionId } = body;

    if (!storagePath || !tenantId || !confirmedMapping) {
      return new Response(JSON.stringify({ error: "storagePath, tenantId, confirmedMapping are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update session status
    if (sessionId) {
      await supabase.from("legacy_import_sessions")
        .update({ status: "importing", confirmed_mapping: confirmedMapping })
        .eq("id", sessionId);
    }

    // Download ZIP
    const { data: zipBlob, error: dlError } = await supabase.storage
      .from("legacy-imports")
      .download(storagePath);

    if (dlError || !zipBlob) throw new Error(`Storage download error: ${dlError?.message || "No data"}`);

    const zipBuffer = await zipBlob.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);

    // Sort confirmed mapping by dependency order
    const sorted = [...confirmedMapping].sort((a: any, b: any) => {
      const ai = IMPORT_ORDER.indexOf(a.targetTable);
      const bi = IMPORT_ORDER.indexOf(b.targetTable);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });

    const results: Record<string, any> = {};

    for (const mapping of sorted) {
      const { filename, fullPath, targetTable } = mapping;
      const zipPath = fullPath || filename;

      // Find the file in the ZIP (try full path first, then basename match)
      let zipFile = zip.files[zipPath];
      if (!zipFile) {
        const found = Object.entries(zip.files).find(
          ([name]) => name.endsWith(filename) || name.endsWith(zipPath)
        );
        zipFile = found ? found[1] : null;
      }

      if (!zipFile) {
        results[filename] = { inserted: 0, skipped: 0, errors: [`File "${filename}" not found in ZIP`] };
        continue;
      }

      const csvText = await zipFile.async("string");

      try {
        let result;
        switch (targetTable) {
          case "products": result = await importProducts(csvText, tenantId, supabase); break;
          case "partners": result = await importPartners(csvText, tenantId, supabase); break;
          case "contacts": result = await importContacts(csvText, tenantId, supabase); break;
          case "warehouses": result = await importWarehouses(csvText, tenantId, supabase); break;
          case "invoices": result = await importInvoicesHeuristic(csvText, tenantId, supabase); break;
          default: result = await importGeneric(csvText, tenantId, targetTable, supabase); break;
        }
        results[filename] = result;
      } catch (err: any) {
        results[filename] = { inserted: 0, skipped: 0, errors: [err.message] };
      }
    }

    // Update session with results
    if (sessionId) {
      await supabase.from("legacy_import_sessions")
        .update({ import_results: results, status: "done" })
        .eq("id", sessionId);
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("import-legacy-zip error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
