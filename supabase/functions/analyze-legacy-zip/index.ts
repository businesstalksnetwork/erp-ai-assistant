import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore — JSZip via esm.sh works at runtime in Deno
import JSZip from "https://esm.sh/jszip@3.10.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

const BATCH_SIZE = 100;

function sanitizeCSVText(raw: string): string { return raw.replace(/\x00/g, ""); }
function reconstructLogicalRows(text: string): string[] {
  const rawLines = text.split(/\r\n|\r|\n/);
  const logical: string[] = [];
  for (const line of rawLines) {
    if (line.length === 0) continue;
    const startsNewRow = /^\d+[,;|]/.test(line) || logical.length === 0;
    if (startsNewRow) { logical.push(line); } else { if (logical.length > 0) { logical[logical.length - 1] += " " + line; } else { logical.push(line); } }
  }
  return logical.filter((l) => l.trim().length > 0);
}
function parseCSVLine(line: string): string[] {
  const result: string[] = []; let current = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } } else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; } else { current += ch; }
  }
  result.push(current.trim()); return result;
}
function parseCSV(text: string): { headers: string[]; rows: string[][]; hasHeader: boolean } {
  const sanitized = sanitizeCSVText(text); const logicalRows = reconstructLogicalRows(sanitized);
  if (logicalRows.length === 0) return { headers: [], rows: [], hasHeader: false };
  const firstCols = parseCSVLine(logicalRows[0]);
  const looksLikeHeader = firstCols.some((c) => isNaN(Number(c)) && c.length > 0 && c.length < 60 && /[a-zA-ZšđčćžŠĐČĆŽ]/.test(c));
  if (looksLikeHeader) { return { headers: firstCols, rows: logicalRows.slice(1).map(parseCSVLine), hasHeader: true }; }
  return { headers: firstCols.map((_, i) => `col_${i + 1}`), rows: logicalRows.map(parseCSVLine), hasHeader: false };
}

const UNIPROM_COLUMN_MAP: Record<string, Record<string, number>> = {
  "Partner": { legacy_id: 0, name: 1, city_id: 4, partner_code: 5, pib: 10, is_active: 17 },
  "PartnerLocation": { legacy_id: 0, full_name: 1, partner_code: 7, city: 9, address: 10, partner_legacy_id: 22 },
  "PartnerContact": { legacy_id: 0, last_name: 1, first_name: 2, phone: 6, email: 10, partner_legacy_id: 12 },
  "Item": { legacy_id: 0, name: 1, sku: 2, is_active: 33, product_type: 34 },
  "ItemUnitOfMeasure": { legacy_id: 0, code: 1, name: 2 },
  "Employee": { legacy_id: 0, first_name: 1, last_name: 2, jmbg: 4, department_legacy_id: 9, email: 6, phone: 7 },
  "EmployeeContract": { legacy_id: 0, employee_legacy_id: 1, start_date: 3, end_date: 4, gross_salary: 5, contract_type: 6 },
  "EmployeeOvertime": { legacy_id: 0, employee_legacy_id: 1, year: 2, month: 3, hours: 4 },
  "Department": { legacy_id: 0, name: 1, code: 3 },
  "Currency": { legacy_id: 0, name: 1, code: 2 },
  "CurrencyISO": { legacy_id: 0, code: 1, name: 2, symbol: 3 },
  "Tax": { legacy_id: 0, name: 1, pdv_code: 2, rate: 3 },
  "City": { legacy_id: 0, name: 1, display_name: 2, country_id: 4 },
  "Company": { legacy_id: 0, name: 1, address: 3, pib: 6, maticni_broj: 7 },
  "CompanyOffice": { legacy_id: 0, name: 1, address: 3 },
  "Warehouse": { legacy_id: 0, code: 1, name: 2 },
  "DocumentType": { legacy_id: 0, code: 1, name: 2 },
  "DocumentList": { legacy_id: 0, document_type_id: 1, code: 2, name: 3 },
  "DocumentHeader": { legacy_id: 0, doc_number: 1, date: 2, doc_list_id: 3, status_id: 4, partner_id: 6, warehouse_id: 7, total: 11 },
  "DocumentLine": { legacy_id: 0, header_id: 1, item_id: 2, qty: 3, unit_price: 4, discount: 5, tax_id: 6 },
  "Project": { legacy_id: 0, name: 1, start_date: 3, end_date: 4, status_id: 9, partner_id: 7 },
  "Opportunity": { legacy_id: 0, name: 1, partner_id: 2, value: 5, status_id: 9 },
};

function getUnipromTableName(filename: string): string | null {
  const basename = filename.split("/").pop() || filename;
  const m = basename.match(/^dbo\.(.+?)\.csv$/i);
  return m ? m[1] : null;
}

async function buildCityLookup(zip: JSZip): Promise<Map<string, string>> {
  const cityMap = new Map<string, string>();
  const cityEntry = Object.entries(zip.files).find(([name]) => name.toLowerCase().endsWith("dbo.city.csv"));
  if (!cityEntry) return cityMap;
  const csvText = await (cityEntry[1] as any).async("string");
  const sanitized = sanitizeCSVText(csvText);
  const lines = sanitized.split(/\r\n|\r|\n/);
  const MAX_CITY_ENTRIES = 20000; let count = 0;
  for (const line of lines) {
    if (!line || line.length === 0) continue;
    const firstComma = line.indexOf(","); if (firstComma < 0) continue;
    const id = line.substring(0, firstComma).trim();
    const rest = line.substring(firstComma + 1);
    const secondComma = rest.indexOf(",");
    const name = (secondComma >= 0 ? rest.substring(0, secondComma) : rest).trim();
    if (id && name) { cityMap.set(id, name); count++; if (count >= MAX_CITY_ENTRIES) break; }
  }
  return cityMap;
}

function getDocType(docNumber: string): "invoice" | "purchase_order" | "quote" {
  if (!docNumber) return "invoice";
  const upper = docNumber.toUpperCase();
  if (/-PO\b/.test(upper) || upper.endsWith("-PO")) return "purchase_order";
  if (/-RAC\b/.test(upper) || upper.endsWith("-RAC")) return "invoice";
  if (/-PON\b/.test(upper) || upper.endsWith("-PON")) return "quote";
  return "invoice";
}

async function flushBatch(supabase: any, table: string, batch: any[], upsertConflict: string | null, tag: string, batchNum: number) {
  if (batch.length === 0) return { inserted: 0, errors: [] };
  const batchResult = upsertConflict
    ? await supabase.from(table).upsert(batch, { onConflict: upsertConflict, ignoreDuplicates: true })
    : await supabase.from(table).insert(batch);
  if (!batchResult.error) return { inserted: batch.length, errors: [] };
  const MAX_ROW_RETRIES = 5; let inserted = 0; const errors: { rowIndex: number; reason: string }[] = [];
  const retryCount = Math.min(batch.length, MAX_ROW_RETRIES);
  for (let i = 0; i < retryCount; i++) {
    const row = batch[i];
    const rowResult = upsertConflict
      ? await supabase.from(table).upsert([row], { onConflict: upsertConflict, ignoreDuplicates: true })
      : await supabase.from(table).insert([row]);
    if (rowResult.error) errors.push({ rowIndex: i, reason: rowResult.error.message }); else inserted++;
  }
  if (batch.length > MAX_ROW_RETRIES) errors.push({ rowIndex: MAX_ROW_RETRIES, reason: `Remaining ${batch.length - MAX_ROW_RETRIES} rows skipped` });
  return { inserted, errors };
}

async function buildPartnerLegacyMap(tenantId: string, supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from("partners").select("id, maticni_broj").eq("tenant_id", tenantId);
  const map: Record<string, string> = {};
  for (const p of data || []) { const m = (p.maticni_broj || "").match(/^LEG:(.+)/); if (m) map[m[1].trim()] = p.id; }
  return map;
}

async function buildProductLegacyMap(tenantId: string, supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from("products").select("id, description").eq("tenant_id", tenantId);
  const map: Record<string, string> = {};
  for (const p of data || []) { const m = (p.description || "").match(/Legacy ID:\s*(\S+)/); if (m) map[m[1].trim()] = p.id; }
  return map;
}

async function importPartners(csvText: string, tenantId: string, supabase: any, filename?: string, cityLookup?: Map<string, string>) {
  const { rows } = parseCSV(csvText);
  const colMap = UNIPROM_COLUMN_MAP["Partner"];
  const { data: existing } = await supabase.from("partners").select("pib, name").eq("tenant_id", tenantId);
  const pibSet = new Set((existing || []).filter((r: any) => r.pib).map((r: any) => r.pib));
  const nameSet = new Set((existing || []).map((r: any) => r.name?.toLowerCase()));
  let inserted = 0, updated = 0, skipped = 0; const errors: any[] = []; const batch: any[] = [];
  for (const cols of rows) {
    const legacyId = cols[colMap.legacy_id] || null;
    const name = cols[colMap.name]?.trim();
    if (!name) continue;
    const cityId = cols[colMap.city_id] || null;
    const city = cityId && cityLookup ? cityLookup.get(cityId) : null;
    const partnerCode = cols[colMap.partner_code] || null;
    const pib = cols[colMap.pib] || null;
    const isActive = cols[colMap.is_active] === "1";
    if (pib && pibSet.has(pib)) { skipped++; continue; }
    if (!pib && nameSet.has(name.toLowerCase())) { skipped++; continue; }
    if (pib) pibSet.add(pib); nameSet.add(name.toLowerCase());
    batch.push({
      tenant_id: tenantId, name, city, pib: pib || null, maticni_broj: legacyId ? `LEG:${legacyId}` : null,
      type: "customer", is_active: isActive, notes: partnerCode ? `Code: ${partnerCode}` : null,
    });
    if (batch.length >= BATCH_SIZE) {
      const res = await flushBatch(supabase, "partners", batch, null, "partners", inserted);
      inserted += res.inserted; errors.push(...res.errors); batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const res = await flushBatch(supabase, "partners", batch, null, "partners", inserted);
    inserted += res.inserted; errors.push(...res.errors);
  }
  return { inserted, updated, skipped, errors };
}

async function importProducts(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const { rows } = parseCSV(csvText);
  const colMap = UNIPROM_COLUMN_MAP["Item"];
  const { data: existing } = await supabase.from("products").select("sku").eq("tenant_id", tenantId);
  const skuSet = new Set((existing || []).map((r: any) => r.sku));
  let inserted = 0, skipped = 0; const errors: any[] = []; const batch: any[] = [];
  for (const cols of rows) {
    const legacyId = cols[colMap.legacy_id] || null;
    const name = cols[colMap.name]?.trim();
    const sku = cols[colMap.sku]?.trim() || null;
    if (!name) continue;
    if (sku && skuSet.has(sku)) { skipped++; continue; }
    if (sku) skuSet.add(sku);
    const isActive = cols[colMap.is_active] === "1";
    const productType = cols[colMap.product_type] || null;
    batch.push({
      tenant_id: tenantId, sku, name, is_active: isActive, unit_of_measure: "kom",
      description: legacyId ? `Legacy ID: ${legacyId}` : null,
      default_sale_price: 0, default_retail_price: 0, default_purchase_price: 0,
    });
    if (batch.length >= BATCH_SIZE) {
      const res = await flushBatch(supabase, "products", batch, null, "products", inserted);
      inserted += res.inserted; errors.push(...res.errors); batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const res = await flushBatch(supabase, "products", batch, null, "products", inserted);
    inserted += res.inserted; errors.push(...res.errors);
  }
  return { inserted, skipped, errors };
}

async function importContacts(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const { rows } = parseCSV(csvText);
  const colMap = UNIPROM_COLUMN_MAP["PartnerContact"];
  const { data: existing } = await supabase.from("contacts").select("email").eq("tenant_id", tenantId).not("email", "is", null);
  const emailSet = new Set((existing || []).map((r: any) => r.email?.toLowerCase()));
  let inserted = 0, skipped = 0; const errors: any[] = []; const batch: any[] = [];
  for (const cols of rows) {
    const firstName = cols[colMap.first_name]?.trim();
    const lastName = cols[colMap.last_name]?.trim();
    const phone = cols[colMap.phone] || null;
    const email = cols[colMap.email] || null;
    if (!firstName && !lastName) continue;
    if (email && emailSet.has(email.toLowerCase())) { skipped++; continue; }
    if (email) emailSet.add(email.toLowerCase());
    batch.push({
      tenant_id: tenantId, first_name: firstName, last_name: lastName, phone, email: email || null, type: "contact",
    });
    if (batch.length >= BATCH_SIZE) {
      const res = await flushBatch(supabase, "contacts", batch, null, "contacts", inserted);
      inserted += res.inserted; errors.push(...res.errors); batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const res = await flushBatch(supabase, "contacts", batch, null, "contacts", inserted);
    inserted += res.inserted; errors.push(...res.errors);
  }
  return { inserted, skipped, errors };
}

async function importDocuments(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const { rows } = parseCSV(csvText);
  const colMap = UNIPROM_COLUMN_MAP["DocumentHeader"];
  const partnerMap = await buildPartnerLegacyMap(tenantId, supabase);
  let inserted = 0, skipped = 0; const errors: any[] = []; const batch: any[] = [];
  for (const cols of rows) {
    const legacyId = cols[colMap.legacy_id] || null;
    const docNumber = cols[colMap.doc_number]?.trim();
    const date = cols[colMap.date] || null;
    const partnerLegacyId = cols[colMap.partner_id] || null;
    const total = parseFloat(cols[colMap.total]) || 0;
    if (!docNumber) continue;
    const partnerId = partnerLegacyId ? partnerMap[partnerLegacyId] : null;
    const docType = getDocType(docNumber);
    batch.push({
      tenant_id: tenantId, invoice_number: docNumber, invoice_date: date, partner_id: partnerId,
      total_amount: total, status: "draft", notes: legacyId ? `Legacy ID: ${legacyId}` : null,
    });
    if (batch.length >= BATCH_SIZE) {
      const res = await flushBatch(supabase, "invoices", batch, null, "invoices", inserted);
      inserted += res.inserted; errors.push(...res.errors); batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const res = await flushBatch(supabase, "invoices", batch, null, "invoices", inserted);
    inserted += res.inserted; errors.push(...res.errors);
  }
  return { inserted, skipped, errors };
}

async function importDocumentLines(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const { rows } = parseCSV(csvText);
  const colMap = UNIPROM_COLUMN_MAP["DocumentLine"];
  const productMap = await buildProductLegacyMap(tenantId, supabase);
  let inserted = 0, skipped = 0; const errors: any[] = []; const batch: any[] = [];
  for (const cols of rows) {
    const itemLegacyId = cols[colMap.item_id] || null;
    const qty = parseFloat(cols[colMap.qty]) || 0;
    const unitPrice = parseFloat(cols[colMap.unit_price]) || 0;
    const discount = parseFloat(cols[colMap.discount]) || 0;
    if (!itemLegacyId) continue;
    const productId = productMap[itemLegacyId];
    if (!productId) { skipped++; continue; }
    batch.push({
      tenant_id: tenantId, product_id: productId, quantity: qty, unit_price: unitPrice, discount_percent: discount,
    });
    if (batch.length >= BATCH_SIZE) {
      const res = await flushBatch(supabase, "invoice_lines", batch, null, "invoice_lines", inserted);
      inserted += res.inserted; errors.push(...res.errors); batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const res = await flushBatch(supabase, "invoice_lines", batch, null, "invoice_lines", inserted);
    inserted += res.inserted; errors.push(...res.errors);
  }
  return { inserted, skipped, errors };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { tenant_id, file_path } = await req.json();
    if (!tenant_id || !file_path) {
      return new Response(JSON.stringify({ error: "Missing tenant_id or file_path" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const { data: fileData, error: dlError } = await supabase.storage.from("legacy-imports").download(file_path);
    if (dlError) throw new Error(`Storage download error: ${dlError.message}`);

    const zip = await JSZip.loadAsync(await fileData.arrayBuffer());
    const cityLookup = await buildCityLookup(zip);
    const results: any[] = [];

    const priority = ["partner", "product", "item", "contact", "documentheader", "documentline"];
    const files = Object.keys(zip.files).sort((a, b) => {
      const aLower = a.toLowerCase(); const bLower = b.toLowerCase();
      const aIdx = priority.findIndex(p => aLower.includes(p));
      const bIdx = priority.findIndex(p => bLower.includes(p));
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.localeCompare(b);
    });

    for (const filename of files) {
      if (filename.startsWith("__MACOSX") || filename.includes(".DS_Store")) continue;
      const content = await zip.file(filename)?.async("string");
      if (!content) continue;

      const unipromTable = getUnipromTableName(filename);
      let res;
      if (unipromTable === "Partner" || unipromTable === "PartnerLocation") {
        res = await importPartners(content, tenant_id, supabase, filename, cityLookup);
      } else if (unipromTable === "Item" || unipromTable?.includes("Artikal")) {
        res = await importProducts(content, tenant_id, supabase, filename);
      } else if (unipromTable === "PartnerContact" || unipromTable?.includes("Kontakt")) {
        res = await importContacts(content, tenant_id, supabase, filename);
      } else if (unipromTable === "DocumentHeader" || unipromTable?.includes("Faktura") || unipromTable?.includes("Narudzbenica")) {
        res = await importDocuments(content, tenant_id, supabase, filename);
      } else if (unipromTable === "DocumentLine" || unipromTable?.includes("Stavka")) {
        res = await importDocumentLines(content, tenant_id, supabase, filename);
      } else {
        res = { skipped: 1, message: "Skipped (unknown type)" };
      }
      results.push({ filename, ...res });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
    });
  } catch (err: any) {
    return createErrorResponse(err, req, { logPrefix: "analyze-legacy-zip" });
  }
});
