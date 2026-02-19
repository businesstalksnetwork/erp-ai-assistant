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

function parseCSV(text: string): { headers: string[]; rows: string[][]; hasHeader: boolean } {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], hasHeader: false };
  const firstCols = parseCSVLine(lines[0]);
  const looksLikeHeader = firstCols.some((c) => isNaN(Number(c)) && c.length > 0 && c.length < 60 && /[a-zA-ZšđčćžŠĐČĆŽ]/.test(c));
  if (looksLikeHeader) {
    return { headers: firstCols, rows: lines.slice(1).map(parseCSVLine), hasHeader: true };
  }
  return { headers: firstCols.map((_, i) => `col_${i + 1}`), rows: lines.map(parseCSVLine), hasHeader: false };
}

// ──────────────────────────────────────────────────────────────────────────────
// Column maps — derived from actual Uniprom CSV inspection:
//
// dbo.A_UnosPodataka.csv (Products, NO header):
//   [0] SKU  [1] Name  [2] Unit  [3] qty_on_hand  [4] purchase_price
//   [5] sale_price  [6] is_active(1/0)  [7] cat1...[11] cat5  [12] brand
//
// dbo.A_UnosPodataka_Partner.csv (Partners, NO header):
//   [0] partner_code(P000001)  [1] name  [2] country  [3] city
//   [4] pib  [5] contact_person
//
// dbo.A_aPodaci.csv (Contacts, NO header):
//   [0] legacy_partner_id  [1] last_name  [2] first_name
//   [3] role  [4] city  [5] email  [6] phone
// ──────────────────────────────────────────────────────────────────────────────

async function importProducts(csvText: string, tenantId: string, supabase: any) {
  const lines = csvText.split("\n").filter((l) => l.trim().length > 0);
  const firstCols = parseCSVLine(lines[0] || "");
  const hasHeader = firstCols.length > 0 && isNaN(Number(firstCols[0])) && firstCols[0].length > 0 && /[a-zA-Z]/.test(firstCols[0]);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const { data: existingSkus } = await supabase.from("products").select("sku").eq("tenant_id", tenantId);
  const skuSet = new Set((existingSkus || []).map((r: any) => r.sku));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    if (cols.length < 2) continue;

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
    const categories = [cols[7], cols[8], cols[9], cols[10], cols[11]].map((c) => c?.trim()).filter(Boolean);
    const brand = cols[12]?.trim() || null;

    batch.push({
      tenant_id: tenantId, sku, name,
      unit_of_measure: unitOfMeasure,
      purchase_price: purchasePrice,
      default_purchase_price: purchasePrice,
      default_sale_price: salePrice,
      default_retail_price: salePrice,
      is_active: isActive,
      description: [brand ? `Brand: ${brand}` : null, categories.length ? categories.join(" > ") : null].filter(Boolean).join(" | ") || null,
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

  // Seed inventory stock for items with qty > 0
  try {
    const { data: whs } = await supabase.from("warehouses").select("id").eq("tenant_id", tenantId).limit(1);
    if (whs && whs.length > 0) {
      const warehouseId = whs[0].id;
      const skuArr = dataLines.map((l) => parseCSVLine(l)[0]?.trim()).filter(Boolean);
      const { data: prods } = await supabase.from("products").select("id, sku").eq("tenant_id", tenantId).in("sku", skuArr.slice(0, 1000));
      if (prods && prods.length > 0) {
        const skuToId = Object.fromEntries(prods.map((p: any) => [p.sku, p.id]));
        const stockBatch: any[] = [];
        for (const line of dataLines) {
          const cols = parseCSVLine(line);
          const sku = cols[0]?.trim();
          const qty = parseFloat(cols[3]) || 0;
          const pid = skuToId[sku];
          if (pid && qty > 0) stockBatch.push({ tenant_id: tenantId, product_id: pid, warehouse_id: warehouseId, quantity_on_hand: qty });
        }
        if (stockBatch.length > 0) await supabase.from("inventory_stock").upsert(stockBatch, { onConflict: "product_id,warehouse_id" });
      }
    }
  } catch (_) { /* best-effort */ }

  return { inserted, skipped, errors };
}

async function importPartners(csvText: string, tenantId: string, supabase: any) {
  const lines = csvText.split("\n").filter((l) => l.trim().length > 0);
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
      tenant_id: tenantId, name, city, country,
      pib: pib || null,
      contact_person: contactPerson,
      type: "customer", is_active: true,
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
  const firstCols = parseCSVLine(lines[0] || "");
  const hasHeader = firstCols.length > 0 && isNaN(Number(firstCols[0]));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const { data: existingContacts } = await supabase.from("contacts").select("email, first_name, last_name").eq("tenant_id", tenantId);
  const emailSet = new Set((existingContacts || []).filter((r: any) => r.email).map((r: any) => r.email?.toLowerCase()));
  const nameSet = new Set((existingContacts || []).map((r: any) => `${r.first_name}|${r.last_name}`.toLowerCase()));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    if (cols.length < 2) continue;
    const legacyPartnerId = cols[0]?.trim() || null;
    const lastName = cols[1]?.trim() || null;
    const firstName = cols[2]?.trim() || null;
    const role = cols[3]?.trim() || null;
    const rawCity = cols[4]?.trim() || null;
    const email = cols[5]?.trim() || null;
    const phone = cols[6]?.trim() || null;

    const effectiveFirst = firstName || lastName || "";
    const effectiveLast = firstName ? lastName : null;
    if (!effectiveFirst) continue;

    if (email && emailSet.has(email.toLowerCase())) { skipped++; continue; }
    const nameKey = `${effectiveFirst}|${effectiveLast}`.toLowerCase();
    if (!email && nameSet.has(nameKey)) { skipped++; continue; }
    if (email) emailSet.add(email.toLowerCase());
    nameSet.add(nameKey);

    const city = (rawCity && rawCity.toUpperCase() !== "SRBIJA") ? rawCity : null;
    const country = (!rawCity || rawCity.toUpperCase() === "SRBIJA") ? "Serbia" : null;

    batch.push({
      tenant_id: tenantId,
      first_name: effectiveFirst, last_name: effectiveLast,
      email: email || null, phone: phone || null,
      city, country,
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
  const h = headers.map((x) => x.toLowerCase());
  const nameIdx = h.findIndex((x) => /name|naziv/i.test(x));
  const codeIdx = h.findIndex((x) => /code|sifra/i.test(x));

  const { data: existing } = await supabase.from("warehouses").select("name").eq("tenant_id", tenantId);
  const nameSet = new Set((existing || []).map((r: any) => r.name?.toLowerCase()));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const row of rows) {
    const name = (nameIdx >= 0 ? row[nameIdx] : row[0])?.trim();
    if (!name) continue;
    if (nameSet.has(name.toLowerCase())) { skipped++; continue; }
    nameSet.add(name.toLowerCase());
    const code = (codeIdx >= 0 ? row[codeIdx] : null) || name.substring(0, 10).toUpperCase();
    batch.push({ tenant_id: tenantId, name, code });
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

async function importChartOfAccounts(csvText: string, tenantId: string, supabase: any) {
  const { headers, rows } = parseCSV(csvText);
  const h = headers.map((x) => x.toLowerCase());

  // Heuristic column detection — Uniprom konto files: SifraKonta, NazivKonta, TipKonta
  const codeIdx = h.findIndex((x) => /sifra|code|konto.*br|br.*konta|^konto$/i.test(x));
  const nameIdx = h.findIndex((x) => /naziv|name|opis|description/i.test(x));
  const typeIdx = h.findIndex((x) => /tip|type|vrsta/i.test(x));

  // Fallback: no-header file — assume [0]=code, [1]=name
  const effectiveCodeIdx = codeIdx >= 0 ? codeIdx : 0;
  const effectiveNameIdx = nameIdx >= 0 ? nameIdx : 1;

  const { data: existing } = await supabase.from("chart_of_accounts").select("code").eq("tenant_id", tenantId);
  const codeSet = new Set((existing || []).map((r: any) => r.code));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const row of rows) {
    const code = row[effectiveCodeIdx]?.trim();
    const name = row[effectiveNameIdx]?.trim();
    if (!code || !name) continue;
    if (codeSet.has(code)) { skipped++; continue; }
    codeSet.add(code);

    // Determine account type from code prefix (Serbian standard chart)
    let accountType = "other";
    const prefix = code.charAt(0);
    if (prefix === "0") accountType = "fixed_asset";
    else if (prefix === "1") accountType = "asset";
    else if (prefix === "2") accountType = "asset"; // receivables/cash
    else if (prefix === "3") accountType = "asset"; // inventory
    else if (prefix === "4") accountType = "liability";
    else if (prefix === "5") accountType = "expense";
    else if (prefix === "6") accountType = "revenue";
    else if (prefix === "7") accountType = "revenue";
    else if (prefix === "8") accountType = "equity";
    else if (prefix === "9") accountType = "other";

    // Override from type column if available
    if (typeIdx >= 0 && row[typeIdx]) {
      const t = row[typeIdx].toLowerCase();
      if (/prih|revenue|income/i.test(t)) accountType = "revenue";
      else if (/rash|expense|cost/i.test(t)) accountType = "expense";
      else if (/aktiv|asset/i.test(t)) accountType = "asset";
      else if (/obav|liab/i.test(t)) accountType = "liability";
      else if (/kapital|equity/i.test(t)) accountType = "equity";
    }

    batch.push({
      tenant_id: tenantId, code, name,
      account_type: accountType,
      level: code.length,
      is_active: true, is_system: false,
    });

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("chart_of_accounts").insert(batch);
      if (error) errors.push(error.message); else inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { error } = await supabase.from("chart_of_accounts").insert(batch);
    if (error) errors.push(error.message); else inserted += batch.length;
  }
  return { inserted, skipped, errors };
}

async function importEmployees(csvText: string, tenantId: string, supabase: any) {
  const { headers, rows } = parseCSV(csvText);
  const h = headers.map((x) => x.toLowerCase().replace(/[\s_]/g, ""));

  // Column detection for Serbian employee files
  const firstNameIdx = h.findIndex((x) => /ime$|firstname|^ime/i.test(x));
  const lastNameIdx  = h.findIndex((x) => /prezime|lastname/i.test(x));
  const emailIdx     = h.findIndex((x) => /email|mail/i.test(x));
  const phoneIdx     = h.findIndex((x) => /tel|phone|mobil/i.test(x));
  const jmbgIdx      = h.findIndex((x) => /jmbg/i.test(x));
  const positionIdx  = h.findIndex((x) => /pozicija|radno.*mesto|position|job/i.test(x));

  // Fallback for no-header files (typical Uniprom: [0]=id [1]=lastName [2]=firstName [3]=email [4]=phone)
  const effFirst    = firstNameIdx >= 0 ? firstNameIdx : 2;
  const effLast     = lastNameIdx  >= 0 ? lastNameIdx  : 1;
  const effEmail    = emailIdx     >= 0 ? emailIdx     : 3;
  const effPhone    = phoneIdx     >= 0 ? phoneIdx     : 4;

  const { data: existing } = await supabase.from("employees").select("email, first_name, last_name").eq("tenant_id", tenantId);
  const emailSet = new Set((existing || []).filter((r: any) => r.email).map((r: any) => r.email?.toLowerCase()));
  const nameSet  = new Set((existing || []).map((r: any) => `${r.first_name}|${r.last_name}`.toLowerCase()));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const row of rows) {
    const firstName = row[effFirst]?.trim() || null;
    const lastName  = row[effLast]?.trim()  || null;
    const email     = row[effEmail]?.trim()  || null;
    const phone     = row[effPhone]?.trim()  || null;
    const jmbg      = jmbgIdx >= 0 ? row[jmbgIdx]?.trim() || null : null;
    const position  = positionIdx >= 0 ? row[positionIdx]?.trim() || null : null;

    if (!firstName && !lastName) continue;

    if (email && emailSet.has(email.toLowerCase())) { skipped++; continue; }
    const nameKey = `${firstName}|${lastName}`.toLowerCase();
    if (!email && nameSet.has(nameKey)) { skipped++; continue; }
    if (email) emailSet.add(email.toLowerCase());
    nameSet.add(nameKey);

    batch.push({
      tenant_id: tenantId,
      first_name: firstName || "",
      last_name:  lastName  || "",
      email:      email  || null,
      phone:      phone  || null,
      position:   position || null,
      status:     "active",
      notes:      jmbg ? `JMBG: ${jmbg}` : null,
    });

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("employees").insert(batch);
      if (error) errors.push(error.message); else inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { error } = await supabase.from("employees").insert(batch);
    if (error) errors.push(error.message); else inserted += batch.length;
  }
  return { inserted, skipped, errors };
}

async function importInventoryStock(csvText: string, tenantId: string, supabase: any) {
  const { headers, rows } = parseCSV(csvText);
  const h = headers.map((x) => x.toLowerCase().replace(/[\s_]/g, ""));

  // Column detection for Lager / stock files
  const skuIdx      = h.findIndex((x) => /sifra|sku|artik/i.test(x));
  const qtyIdx      = h.findIndex((x) => /kolicin|qty|zaliha|stanje|kolicina/i.test(x));
  const warehIdx    = h.findIndex((x) => /magacin|warehouse|skladiste/i.test(x));
  const costIdx     = h.findIndex((x) => /cena|price|cost|nabav/i.test(x));

  // Get first warehouse as default
  const { data: whs } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId).limit(5);
  const defaultWarehouseId = whs && whs.length > 0 ? whs[0].id : null;
  if (!defaultWarehouseId) {
    return { inserted: 0, skipped: rows.length, errors: ["No warehouses found for this tenant — import products & warehouses first"] };
  }

  // Build warehouse name → id map
  const warehouseMap: Record<string, string> = {};
  if (whs) for (const w of whs) warehouseMap[w.name?.toLowerCase()] = w.id;

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const row of rows) {
    const skuRaw = skuIdx >= 0 ? row[skuIdx]?.trim() : row[0]?.trim();
    const qty    = qtyIdx >= 0 ? parseFloat(row[qtyIdx]) || 0 : parseFloat(row[1]) || 0;
    const warehName = warehIdx >= 0 ? row[warehIdx]?.trim()?.toLowerCase() : null;
    const unitCost  = costIdx  >= 0 ? parseFloat(row[costIdx]) || 0 : 0;

    if (!skuRaw || qty <= 0) { skipped++; continue; }

    // Look up product by SKU
    const { data: prod } = await supabase.from("products").select("id").eq("tenant_id", tenantId).eq("sku", skuRaw).maybeSingle();
    if (!prod) { skipped++; continue; }

    const warehouseId = (warehName && warehouseMap[warehName]) || defaultWarehouseId;

    batch.push({
      tenant_id: tenantId,
      product_id: prod.id,
      warehouse_id: warehouseId,
      quantity_on_hand: qty,
      unit_cost: unitCost || null,
    });

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("inventory_stock").upsert(batch, { onConflict: "product_id,warehouse_id" });
      if (error) errors.push(error.message); else inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { error } = await supabase.from("inventory_stock").upsert(batch, { onConflict: "product_id,warehouse_id" });
    if (error) errors.push(error.message); else inserted += batch.length;
  }
  return { inserted, skipped, errors };
}

async function importSupplierInvoices(csvText: string, tenantId: string, supabase: any) {
  const { headers, rows } = parseCSV(csvText);
  const h = headers.map((x) => x.toLowerCase().replace(/[\s_]/g, ""));

  const invNumIdx   = h.findIndex((x) => /broj|number|num|faktura/i.test(x));
  const dateIdx     = h.findIndex((x) => /datum|date/i.test(x));
  const totalIdx    = h.findIndex((x) => /ukupno|total|iznos|vrednost/i.test(x));
  const partnerIdx  = h.findIndex((x) => /dobavljac|supplier|partner|naziv|name/i.test(x));
  const dueDateIdx  = h.findIndex((x) => /rokplacanja|duedate|valuteroki/i.test(x));

  const { data: existing } = await supabase.from("supplier_invoices").select("invoice_number").eq("tenant_id", tenantId);
  const invSet = new Set((existing || []).map((r: any) => r.invoice_number));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const row of rows) {
    const invNum = (invNumIdx >= 0 ? row[invNumIdx] : row[0])?.trim();
    if (!invNum) continue;
    if (invSet.has(invNum)) { skipped++; continue; }
    invSet.add(invNum);

    const rawDate   = dateIdx    >= 0 ? row[dateIdx]    : null;
    const rawDue    = dueDateIdx >= 0 ? row[dueDateIdx] : null;
    const total     = totalIdx   >= 0 ? parseFloat(row[totalIdx])   || 0 : 0;
    const supplierName = (partnerIdx >= 0 ? row[partnerIdx] : null)?.trim() || "Unknown";

    const parseDate = (d: string | null) => {
      if (!d) return new Date().toISOString().split("T")[0];
      const p = new Date(d);
      return isNaN(p.getTime()) ? new Date().toISOString().split("T")[0] : p.toISOString().split("T")[0];
    };

    batch.push({
      tenant_id: tenantId,
      invoice_number: invNum,
      invoice_date: parseDate(rawDate),
      due_date: parseDate(rawDue || rawDate),
      status: "pending",
      supplier_name: supplierName,
      total,
      subtotal: total,
      tax_amount: 0,
      currency: "RSD",
      notes: "Imported from legacy system",
    });

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("supplier_invoices").insert(batch);
      if (error) errors.push(error.message); else inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { error } = await supabase.from("supplier_invoices").insert(batch);
    if (error) errors.push(error.message); else inserted += batch.length;
  }
  return { inserted, skipped, errors };
}

async function importInvoicesHeuristic(csvText: string, tenantId: string, supabase: any) {
  const { headers, rows } = parseCSV(csvText);
  const h = headers.map((x) => x.toLowerCase().replace(/[\s_]/g, ""));

  const invNumIdx  = h.findIndex((x) => /broj.*faktur|faktura.*br|invoicenum|invoice_num|racun.*br/i.test(x));
  const dateIdx    = h.findIndex((x) => /datum|date/i.test(x));
  const totalIdx   = h.findIndex((x) => /ukupno|total|iznos|vrednost/i.test(x));
  const partnerIdx = h.findIndex((x) => /kupac|partner|customer|naziv|name/i.test(x));
  const dueDateIdx = h.findIndex((x) => /rokplacanja|duedate|valuta/i.test(x));

  const { data: existing } = await supabase.from("invoices").select("invoice_number").eq("tenant_id", tenantId);
  const invSet = new Set((existing || []).map((r: any) => r.invoice_number));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const row of rows) {
    const invNum = (invNumIdx >= 0 ? row[invNumIdx] : row[0])?.trim();
    if (!invNum) continue;
    if (invSet.has(invNum)) { skipped++; continue; }
    invSet.add(invNum);

    const rawDate = dateIdx    >= 0 ? row[dateIdx]    : null;
    const rawDue  = dueDateIdx >= 0 ? row[dueDateIdx] : null;
    const total   = totalIdx   >= 0 ? parseFloat(row[totalIdx])   || 0 : 0;
    const partnerName = (partnerIdx >= 0 ? row[partnerIdx] : null)?.trim() || "Unknown";

    const parseDate = (d: string | null) => {
      if (!d) return new Date().toISOString().split("T")[0];
      const p = new Date(d);
      return isNaN(p.getTime()) ? new Date().toISOString().split("T")[0] : p.toISOString().split("T")[0];
    };

    batch.push({
      tenant_id: tenantId,
      invoice_number: invNum,
      invoice_date: parseDate(rawDate),
      due_date: parseDate(rawDue || rawDate),
      status: "draft",
      partner_name: partnerName,
      total, subtotal: total, tax_amount: 0,
      currency: "RSD",
      notes: "Imported from legacy system",
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

async function importDepartments(csvText: string, tenantId: string, supabase: any) {
  const { headers, rows } = parseCSV(csvText);
  const h = headers.map((x) => x.toLowerCase());
  const nameIdx = h.findIndex((x) => /naziv|name/i.test(x));
  const codeIdx = h.findIndex((x) => /sifra|code/i.test(x));

  const { data: existing } = await supabase.from("departments").select("name").eq("tenant_id", tenantId);
  const nameSet = new Set((existing || []).map((r: any) => r.name?.toLowerCase()));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const row of rows) {
    const name = (nameIdx >= 0 ? row[nameIdx] : row[1] || row[0])?.trim();
    const code = (codeIdx >= 0 ? row[codeIdx] : row[0])?.trim();
    if (!name) continue;
    if (nameSet.has(name.toLowerCase())) { skipped++; continue; }
    nameSet.add(name.toLowerCase());
    batch.push({ tenant_id: tenantId, name, code: code || name.substring(0, 10).toUpperCase() });
    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("departments").insert(batch);
      if (error) errors.push(error.message); else inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { error } = await supabase.from("departments").insert(batch);
    if (error) errors.push(error.message); else inserted += batch.length;
  }
  return { inserted, skipped, errors };
}

async function importCurrencies(csvText: string, tenantId: string, supabase: any) {
  const { headers, rows } = parseCSV(csvText);
  const h = headers.map((x) => x.toLowerCase());
  const codeIdx = h.findIndex((x) => /code|sifra|oznak/i.test(x));
  const nameIdx = h.findIndex((x) => /naziv|name/i.test(x));
  const symbolIdx = h.findIndex((x) => /simbol|symbol|znak/i.test(x));

  const { data: existing } = await supabase.from("currencies").select("code").eq("tenant_id", tenantId);
  const codeSet = new Set((existing || []).map((r: any) => r.code));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const row of rows) {
    const code   = (codeIdx >= 0 ? row[codeIdx] : row[0])?.trim()?.toUpperCase();
    const name   = (nameIdx >= 0 ? row[nameIdx] : row[1] || code)?.trim();
    const symbol = (symbolIdx >= 0 ? row[symbolIdx] : null)?.trim() || null;
    if (!code) continue;
    if (codeSet.has(code)) { skipped++; continue; }
    codeSet.add(code);
    batch.push({ tenant_id: tenantId, code, name: name || code, symbol, is_active: true, is_base: code === "RSD" });
    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("currencies").insert(batch);
      if (error) errors.push(error.message); else inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { error } = await supabase.from("currencies").insert(batch);
    if (error) errors.push(error.message); else inserted += batch.length;
  }
  return { inserted, skipped, errors };
}

// Generic fallback — no dedicated importer yet
async function importGeneric(_csvText: string, _tenantId: string, targetTable: string, _supabase: any) {
  const lines = _csvText.split("\n").filter((l) => l.trim().length > 0);
  return {
    inserted: 0,
    skipped: lines.length,
    errors: [`Table "${targetTable}" does not have a dedicated importer — ${lines.length} rows skipped`],
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Dependency-ordered import dispatcher
// ──────────────────────────────────────────────────────────────────────────────
const IMPORT_ORDER = [
  "currencies", "departments", "warehouses", "locations", "tax_rates", "chart_of_accounts",
  "products", "partners", "contacts", "employees",
  "employee_contracts", "inventory_stock",
  "invoices", "supplier_invoices", "purchase_orders", "sales_orders",
  "goods_receipts", "retail_prices", "bank_statements",
  "journal_entries", "payroll_runs", "leave_requests",
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

    if (sessionId) {
      await supabase.from("legacy_import_sessions")
        .update({ status: "importing", confirmed_mapping: confirmedMapping })
        .eq("id", sessionId);
    }

    const { data: zipBlob, error: dlError } = await supabase.storage
      .from("legacy-imports")
      .download(storagePath);
    if (dlError || !zipBlob) throw new Error(`Storage download error: ${dlError?.message || "No data"}`);

    const zipBuffer = await zipBlob.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);

    const sorted = [...confirmedMapping].sort((a: any, b: any) => {
      const ai = IMPORT_ORDER.indexOf(a.targetTable);
      const bi = IMPORT_ORDER.indexOf(b.targetTable);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });

    const results: Record<string, any> = {};

    for (const mapping of sorted) {
      const { filename, fullPath, targetTable } = mapping;
      const zipPath = fullPath || filename;

      let zipFile = zip.files[zipPath];
      if (!zipFile) {
        const found = Object.entries(zip.files).find(
          ([name]) => name.endsWith(filename) || name.endsWith(zipPath)
        );
        zipFile = found ? found[1] as any : null;
      }

      if (!zipFile) {
        results[filename] = { inserted: 0, skipped: 0, errors: [`File "${filename}" not found in ZIP`] };
        continue;
      }

      const csvText = await (zipFile as any).async("string");

      try {
        let result;
        switch (targetTable) {
          case "products":          result = await importProducts(csvText, tenantId, supabase); break;
          case "partners":          result = await importPartners(csvText, tenantId, supabase); break;
          case "contacts":          result = await importContacts(csvText, tenantId, supabase); break;
          case "warehouses":        result = await importWarehouses(csvText, tenantId, supabase); break;
          case "employees":         result = await importEmployees(csvText, tenantId, supabase); break;
          case "chart_of_accounts": result = await importChartOfAccounts(csvText, tenantId, supabase); break;
          case "inventory_stock":   result = await importInventoryStock(csvText, tenantId, supabase); break;
          case "supplier_invoices": result = await importSupplierInvoices(csvText, tenantId, supabase); break;
          case "invoices":          result = await importInvoicesHeuristic(csvText, tenantId, supabase); break;
          case "departments":       result = await importDepartments(csvText, tenantId, supabase); break;
          case "currencies":        result = await importCurrencies(csvText, tenantId, supabase); break;
          default:                  result = await importGeneric(csvText, tenantId, targetTable, supabase); break;
        }
        results[filename] = result;
      } catch (err: any) {
        results[filename] = { inserted: 0, skipped: 0, errors: [err.message] };
      }
    }

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
