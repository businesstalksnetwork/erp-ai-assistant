import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore — JSZip via esm.sh works at runtime in Deno
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 100; // Reduced from 500 so a bad batch affects fewer rows

// ──────────────────────────────────────────────────────────────────────────────
// CSV PARSING — keep exactly as-is (these work correctly)
// ──────────────────────────────────────────────────────────────────────────────
function sanitizeCSVText(raw: string): string {
  return raw.replace(/\x00/g, "");
}

function reconstructLogicalRows(text: string): string[] {
  const rawLines = text.split(/\r\n|\r|\n/);
  const logical: string[] = [];
  for (const line of rawLines) {
    if (line.length === 0) continue;
    const startsNewRow = /^\d+[,;|]/.test(line) || logical.length === 0;
    if (startsNewRow) {
      logical.push(line);
    } else {
      if (logical.length > 0) {
        logical[logical.length - 1] += " " + line;
      } else {
        logical.push(line);
      }
    }
  }
  return logical.filter((l) => l.trim().length > 0);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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
  const sanitized = sanitizeCSVText(text);
  const logicalRows = reconstructLogicalRows(sanitized);
  if (logicalRows.length === 0) return { headers: [], rows: [], hasHeader: false };
  const firstCols = parseCSVLine(logicalRows[0]);
  const looksLikeHeader = firstCols.some(
    (c) => isNaN(Number(c)) && c.length > 0 && c.length < 60 && /[a-zA-ZšđčćžŠĐČĆŽ]/.test(c)
  );
  if (looksLikeHeader) {
    return {
      headers: firstCols,
      rows: logicalRows.slice(1).map(parseCSVLine),
      hasHeader: true,
    };
  }
  return {
    headers: firstCols.map((_, i) => `col_${i + 1}`),
    rows: logicalRows.map(parseCSVLine),
    hasHeader: false,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// UNIPROM_COLUMN_MAP — updated with City lookup + partner_code/city_id/pib for Partner
// ──────────────────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────────────────
// CITY LOOKUP — builds city_id → city_name map from dbo.City.csv in the ZIP
// ──────────────────────────────────────────────────────────────────────────────
async function buildCityLookup(zip: JSZip): Promise<Map<string, string>> {
  const cityMap = new Map<string, string>();
  const cityEntry = Object.entries(zip.files).find(
    ([name]) => name.toLowerCase().endsWith("dbo.city.csv")
  );
  if (!cityEntry) {
    console.log("[buildCityLookup] dbo.City.csv not found in ZIP — city resolution disabled");
    return cityMap;
  }
  const csvText = await (cityEntry[1] as any).async("string");
  const sanitized = sanitizeCSVText(csvText);
  // Only split by newline — do NOT use reconstructLogicalRows (too expensive for 100K+ lines)
  const lines = sanitized.split(/\r\n|\r|\n/);
  const MAX_CITY_ENTRIES = 20000; // Cap to prevent CPU exhaustion
  let count = 0;
  for (const line of lines) {
    if (!line || line.length === 0) continue;
    // Fast manual parse: just grab first two comma-separated fields
    const firstComma = line.indexOf(",");
    if (firstComma < 0) continue;
    const id = line.substring(0, firstComma).trim();
    const rest = line.substring(firstComma + 1);
    const secondComma = rest.indexOf(",");
    const name = (secondComma >= 0 ? rest.substring(0, secondComma) : rest).trim();
    if (id && name) {
      cityMap.set(id, name);
      count++;
      if (count >= MAX_CITY_ENTRIES) break;
    }
  }
  console.log(`[buildCityLookup] Built city lookup with ${cityMap.size} entries (capped at ${MAX_CITY_ENTRIES})`);
  return cityMap;
}

// ──────────────────────────────────────────────────────────────────────────────
// DOCUMENT TYPE ROUTING — determines target table from doc_number suffix
// ──────────────────────────────────────────────────────────────────────────────
function getDocType(docNumber: string): "invoice" | "purchase_order" | "quote" {
  if (!docNumber) return "invoice";
  const upper = docNumber.toUpperCase();
  // Check suffixes: -PO or ending with PO (purchase order)
  if (/-PO\b/.test(upper) || upper.endsWith("-PO")) return "purchase_order";
  // -RAC = invoice (Racun)
  if (/-RAC\b/.test(upper) || upper.endsWith("-RAC")) return "invoice";
  // -PON = quote (Ponuda)
  if (/-PON\b/.test(upper) || upper.endsWith("-PON")) return "quote";
  // Fallback
  return "invoice";
}

// ──────────────────────────────────────────────────────────────────────────────
// ROBUST BATCH FLUSH — tries batch insert; on failure retries row-by-row
// Returns { inserted, errors: [{rowIndex, reason}] }
// ──────────────────────────────────────────────────────────────────────────────
async function flushBatch(
  supabase: any,
  table: string,
  batch: any[],
  upsertConflict: string | null,
  tag: string,
  batchNum: number
): Promise<{ inserted: number; errors: { rowIndex: number; reason: string }[] }> {
  if (batch.length === 0) return { inserted: 0, errors: [] };

  // Try batch first
  const batchResult = upsertConflict
    ? await supabase.from(table).upsert(batch, { onConflict: upsertConflict, ignoreDuplicates: true })
    : await supabase.from(table).insert(batch);

  if (!batchResult.error) {
    console.log(`[${tag}] Batch ${batchNum}: ${batch.length} rows → ${batch.length} inserted OK`);
    return { inserted: batch.length, errors: [] };
  }

  // Batch failed — retry row by row to isolate bad rows (capped to prevent CPU exhaustion)
  const MAX_ROW_RETRIES = 5;
  console.warn(`[${tag}] Batch ${batchNum} FAILED (${batch.length} rows): ${batchResult.error.message} — retrying first ${MAX_ROW_RETRIES} rows only`);
  let inserted = 0;
  const errors: { rowIndex: number; reason: string }[] = [];

  const retryCount = Math.min(batch.length, MAX_ROW_RETRIES);
  for (let i = 0; i < retryCount; i++) {
    const row = batch[i];
    const rowResult = upsertConflict
      ? await supabase.from(table).upsert([row], { onConflict: upsertConflict, ignoreDuplicates: true })
      : await supabase.from(table).insert([row]);
    if (rowResult.error) {
      errors.push({ rowIndex: i, reason: rowResult.error.message });
      console.warn(`[${tag}] Batch ${batchNum} row ${i} ERROR: ${rowResult.error.message} | data: ${JSON.stringify(row).substring(0, 200)}`);
    } else {
      inserted++;
    }
  }
  if (batch.length > MAX_ROW_RETRIES) {
    errors.push({ rowIndex: MAX_ROW_RETRIES, reason: `Remaining ${batch.length - MAX_ROW_RETRIES} rows skipped (same error pattern)` });
  }
  console.log(`[${tag}] Batch ${batchNum} row-by-row: ${inserted} inserted, ${errors.length} errors (${batch.length - retryCount} skipped)`);
  return { inserted, errors };
}

// ──────────────────────────────────────────────────────────────────────────────
// buildPartnerLegacyMap — reads from maticni_broj using LEG: prefix
// ──────────────────────────────────────────────────────────────────────────────
async function buildPartnerLegacyMap(tenantId: string, supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from("partners").select("id, maticni_broj").eq("tenant_id", tenantId);
  const map: Record<string, string> = {};
  for (const p of data || []) {
    const m = (p.maticni_broj || "").match(/^LEG:(.+)/);
    if (m) map[m[1].trim()] = p.id;
  }
  console.log(`[buildPartnerLegacyMap] Found ${Object.keys(map).length} legacy partner mappings`);
  return map;
}

// ──────────────────────────────────────────────────────────────────────────────
// buildProductLegacyMap — builds legacy_id → product uuid from notes field
// ──────────────────────────────────────────────────────────────────────────────
async function buildProductLegacyMap(tenantId: string, supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from("products").select("id, description").eq("tenant_id", tenantId);
  const map: Record<string, string> = {};
  for (const p of data || []) {
    const m = (p.description || "").match(/Legacy ID:\s*(\S+)/);
    if (m) map[m[1].trim()] = p.id;
  }
  console.log(`[buildProductLegacyMap] Found ${Object.keys(map).length} legacy product mappings`);
  return map;
}

// ──────────────────────────────────────────────────────────────────────────────
// importPartners — enhanced: city_id resolution, pib, partner_code for Uniprom
// ──────────────────────────────────────────────────────────────────────────────
async function importPartners(csvText: string, tenantId: string, supabase: any, filename?: string, cityLookup?: Map<string, string>) {
  const tag = "importPartners";
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;
  console.log(`[${tag}] File: ${filename} → unipromTable: ${unipromTable}`);

  // ── PartnerLocation: enrich existing partner records with address ──
  if (unipromTable === "PartnerLocation") {
    const cm = UNIPROM_COLUMN_MAP["PartnerLocation"];
    const lines = reconstructLogicalRows(sanitized);
    console.log(`[${tag}] PartnerLocation: ${lines.length} rows to process`);
    let enriched = 0; let skipped = 0;
    const legacyMap = await buildPartnerLegacyMap(tenantId, supabase);
    for (const line of lines) {
      const cols = parseCSVLine(line);
      const partnerLegacyId = cols[cm.partner_legacy_id]?.trim();
      if (!partnerLegacyId) { skipped++; continue; }
      const partnerId = legacyMap[partnerLegacyId];
      if (!partnerId) { skipped++; continue; }
      // Resolve city_id via City lookup instead of using raw value
      const rawCity = cols[cm.city]?.trim() || null;
      const city = (cityLookup && rawCity) ? (cityLookup.get(rawCity) || rawCity) : rawCity;
      const address = cols[cm.address]?.trim() || null;
      if (!city && !address) { skipped++; continue; }
      const updateData: any = {};
      if (city) updateData.city = city;
      if (address) updateData.address = address;
      const { error } = await supabase.from("partners")
        .update(updateData)
        .eq("id", partnerId);
      if (!error) enriched++; else skipped++;
    }
    console.log(`[${tag}] PartnerLocation TOTAL: ${enriched} enriched, ${skipped} skipped`);
    return { inserted: 0, updated: enriched, skipped, errors: [] };
  }

  // ── Partner.csv (Uniprom) or generic ──
  let dataLines: string[];
  let getCol: (cols: string[], field: string) => string | null;

  if (unipromTable === "Partner") {
    const cm = UNIPROM_COLUMN_MAP["Partner"];
    dataLines = reconstructLogicalRows(sanitized);
    getCol = (cols, field) => cols[cm[field] ?? -1]?.trim() || null;
  } else {
    // generic A_UnosPodataka_Partner.csv: [0]=partner_code [1]=name [2]=country [3]=city [4]=pib [5]=contact_person
    const firstCols = parseCSVLine(sanitized.split("\n")[0] || "");
    const hasHeader = firstCols.length > 0 && isNaN(Number(firstCols[0])) && !firstCols[0].startsWith("P0");
    const lines = sanitized.split("\n").filter((l) => l.trim().length > 0);
    dataLines = hasHeader ? lines.slice(1) : lines;
    const cm: Record<string, number> = { legacy_id: 0, name: 1, country: 2, city: 3, pib: 4, contact_person: 5 };
    getCol = (cols, field) => cols[cm[field] ?? -1]?.trim() || null;
  }

  console.log(`[${tag}] ${filename}: ${dataLines.length} rows parsed`);

  const { data: existingPartners } = await supabase.from("partners").select("pib, name, maticni_broj").eq("tenant_id", tenantId);
  const pibSet = new Set((existingPartners || []).filter((r: any) => r.pib).map((r: any) => r.pib));
  const nameSet = new Set((existingPartners || []).map((r: any) => r.name?.toLowerCase()));
  const legSet = new Set(
    (existingPartners || [])
      .filter((r: any) => r.maticni_broj?.startsWith("LEG:"))
      .map((r: any) => r.maticni_broj)
  );

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];
  const batch: any[] = [];
  let batchNum = 0;

  for (let rowIdx = 0; rowIdx < dataLines.length; rowIdx++) {
    const line = dataLines[rowIdx];
    const cols = parseCSVLine(line);
    if (cols.length < 2) continue;

    const name = getCol(cols, "name") || "";
    if (!name) continue;
    const legacyId = getCol(cols, "legacy_id");

    if (unipromTable === "Partner") {
      const isActive = cols[UNIPROM_COLUMN_MAP["Partner"].is_active]?.trim();
      if (isActive === "0") { skipped++; continue; }
    }

    // Enhanced: extract pib and partner_code for Uniprom Partner
    let pib: string | null;
    let partnerCode: string | null;
    let city: string | null;
    let country: string;

    if (unipromTable === "Partner") {
      pib = getCol(cols, "pib");
      partnerCode = getCol(cols, "partner_code");
      const cityId = getCol(cols, "city_id");
      // Resolve city_id via City lookup
      city = (cityLookup && cityId) ? (cityLookup.get(cityId) || null) : null;
      country = "Serbia";
    } else {
      pib = getCol(cols, "pib");
      partnerCode = legacyId || getCol(cols, "partner_code");
      city = getCol(cols, "city");
      country = getCol(cols, "country") || "Serbia";
    }

    if (pib && pibSet.has(pib)) { skipped++; continue; }
    if (!pib && nameSet.has(name.toLowerCase())) { skipped++; continue; }
    // For Uniprom Partner, use partner_code as the legacy tag; fall back to legacy_id
    const legacyRef = (unipromTable === "Partner") ? (partnerCode || legacyId) : (legacyId || partnerCode);
    const legTag = legacyRef ? `LEG:${legacyRef}` : null;
    if (legTag && legSet.has(legTag)) { skipped++; continue; }

    if (pib) pibSet.add(pib);
    nameSet.add(name.toLowerCase());
    if (legTag) legSet.add(legTag);

    batch.push({
      tenant_id: tenantId,
      name,
      city: city || null,
      country,
      pib: pib || null,
      maticni_broj: legTag,
      type: "customer",
      is_active: true,
    });

    if (batch.length >= BATCH_SIZE) {
      batchNum++;
      const withPib = batch.filter((r: any) => r.pib);
      const withoutPib = batch.filter((r: any) => !r.pib);
      if (withPib.length) {
        const res = await flushBatch(supabase, "partners", withPib, "tenant_id,pib", tag, batchNum);
        inserted += res.inserted;
        allErrors.push(...res.errors.map(e => ({ ...e, rowIndex: e.rowIndex + (rowIdx - batch.length) })));
      }
      if (withoutPib.length) {
        const res = await flushBatch(supabase, "partners", withoutPib, null, tag, batchNum);
        inserted += res.inserted;
        allErrors.push(...res.errors.map(e => ({ ...e, rowIndex: e.rowIndex + (rowIdx - batch.length) })));
      }
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    batchNum++;
    const withPib = batch.filter((r: any) => r.pib);
    const withoutPib = batch.filter((r: any) => !r.pib);
    if (withPib.length) {
      const res = await flushBatch(supabase, "partners", withPib, "tenant_id,pib", tag, batchNum);
      inserted += res.inserted;
      allErrors.push(...res.errors);
    }
    if (withoutPib.length) {
      const res = await flushBatch(supabase, "partners", withoutPib, null, tag, batchNum);
      inserted += res.inserted;
      allErrors.push(...res.errors);
    }
  }

  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importContacts — uses LEG: prefix in maticni_broj for partner lookup
// ──────────────────────────────────────────────────────────────────────────────
async function importContacts(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const tag = "importContacts";
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;
  console.log(`[${tag}] File: ${filename} → unipromTable: ${unipromTable}`);

  let dataLines: string[];
  let getField: (cols: string[], field: string) => string | null;

  if (unipromTable === "PartnerContact") {
    const cm = UNIPROM_COLUMN_MAP["PartnerContact"];
    dataLines = reconstructLogicalRows(sanitized);
    getField = (cols, field) => cols[cm[field] ?? -1]?.trim() || null;
  } else {
    // Legacy A_aPodaci.csv: [0]=legacy_partner_id [1]=last_name [2]=first_name [3]=role [4]=city [5]=email [6]=phone
    const lines = sanitized.split("\n").filter((l) => l.trim().length > 0);
    const firstCols = parseCSVLine(lines[0] || "");
    const hasHeader = firstCols.length > 0 && isNaN(Number(firstCols[0]));
    dataLines = hasHeader ? lines.slice(1) : lines;
    const cm: Record<string, number> = { legacy_id: 0, last_name: 1, first_name: 2, role: 3, city: 4, email: 5, phone: 6 };
    getField = (cols, field) => cols[cm[field] ?? -1]?.trim() || null;
  }

  console.log(`[${tag}] ${filename}: ${dataLines.length} rows parsed`);

  const { data: existingContacts } = await supabase.from("contacts").select("email, first_name, last_name").eq("tenant_id", tenantId);
  const emailSet = new Set((existingContacts || []).filter((r: any) => r.email).map((r: any) => r.email?.toLowerCase()));
  const nameSet = new Set((existingContacts || []).map((r: any) => `${r.first_name}|${r.last_name}`.toLowerCase()));

  const legacyMap = await buildPartnerLegacyMap(tenantId, supabase);
  const { data: partnerNames } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId);
  const partnerIdToName: Record<string, string> = {};
  for (const p of partnerNames || []) partnerIdToName[p.id] = p.name;

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];
  const batch: any[] = [];
  let batchNum = 0;

  for (let rowIdx = 0; rowIdx < dataLines.length; rowIdx++) {
    const line = dataLines[rowIdx];
    const cols = parseCSVLine(line);
    if (cols.length < 2) continue;

    const legacyPartnerId = getField(cols, "legacy_id") || getField(cols, "partner_legacy_id");
    const lastName = getField(cols, "last_name");
    const firstName = getField(cols, "first_name");
    const role = getField(cols, "role");
    const rawCity = getField(cols, "city");
    const email = getField(cols, "email");
    const phone = getField(cols, "phone");

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

    let companyName: string | null = null;
    if (legacyPartnerId) {
      const partnerId = legacyMap[legacyPartnerId];
      if (partnerId) companyName = partnerIdToName[partnerId] || null;
    }

    const validFunctionAreas = new Set(["management","sales","marketing","finance","hr","it","operations","legal","procurement","production","other"]);
    const mappedFunctionArea = role && validFunctionAreas.has(role.toLowerCase()) ? role.toLowerCase() : null;

    batch.push({
      tenant_id: tenantId,
      first_name: effectiveFirst,
      last_name: effectiveLast,
      email: email || null,
      phone: phone || null,
      city,
      country,
      function_area: mappedFunctionArea,
      company_name: companyName,
      notes: [
        legacyPartnerId ? `Legacy partner ref: ${legacyPartnerId}` : null,
        role && !mappedFunctionArea ? `Role: ${role}` : null,
      ].filter(Boolean).join(" | ") || null,
      type: "prospect",
    });

    if (batch.length >= BATCH_SIZE) {
      batchNum++;
      const res = await flushBatch(supabase, "contacts", [...batch], null, tag, batchNum);
      inserted += res.inserted;
      allErrors.push(...res.errors);
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    batchNum++;
    const res = await flushBatch(supabase, "contacts", batch, null, tag, batchNum);
    inserted += res.inserted;
    allErrors.push(...res.errors);
  }

  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importEmployees — computes full_name (required NOT NULL)
// ──────────────────────────────────────────────────────────────────────────────
async function importEmployees(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const tag = "importEmployees";
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;
  console.log(`[${tag}] File: ${filename} → unipromTable: ${unipromTable}`);

  const { data: existing } = await supabase.from("employees").select("email, full_name").eq("tenant_id", tenantId);
  const emailSet = new Set((existing || []).filter((r: any) => r.email).map((r: any) => r.email?.toLowerCase()));
  const nameSet = new Set((existing || []).map((r: any) => r.full_name?.toLowerCase()));

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];
  const batch: any[] = [];
  let batchNum = 0;

  const flushEmployees = async () => {
    if (batch.length === 0) return;
    batchNum++;
    const res = await flushBatch(supabase, "employees", [...batch], null, tag, batchNum);
    inserted += res.inserted;
    allErrors.push(...res.errors);
    batch.length = 0;
  };

  if (unipromTable === "Employee") {
    const cm = UNIPROM_COLUMN_MAP["Employee"];
    const lines = reconstructLogicalRows(sanitized);
    console.log(`[${tag}] ${filename}: ${lines.length} rows parsed`);

    for (let rowIdx = 0; rowIdx < lines.length; rowIdx++) {
      const cols = parseCSVLine(lines[rowIdx]);
      if (cols.length < 3) continue;
      const firstName = cols[cm.first_name]?.trim() || null;
      const lastName  = cols[cm.last_name]?.trim()  || null;
      const jmbg      = cols[cm.jmbg]?.trim()       || null;
      const deptLegacyId = cols[cm.department_legacy_id]?.trim() || null;
      const email     = cols[cm.email]?.trim() || null;
      const phone     = cols[cm.phone]?.trim() || null;
      const legacyId  = cols[cm.legacy_id]?.trim()  || null;

      if (!firstName && !lastName) continue;

      const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";

      if (email && emailSet.has(email.toLowerCase())) { skipped++; continue; }
      if (!email && nameSet.has(fullName.toLowerCase())) { skipped++; continue; }
      if (email) emailSet.add(email.toLowerCase());
      nameSet.add(fullName.toLowerCase());

      batch.push({
        tenant_id: tenantId,
        full_name: fullName,
        first_name: firstName || "",
        last_name:  lastName  || "",
        email:      email || null,
        phone:      phone || null,
        status:     "active",
        notes: [
          legacyId     ? `Legacy ID: ${legacyId}`   : null,
          jmbg         ? `JMBG: ${jmbg}`             : null,
          deptLegacyId ? `Dept ID: ${deptLegacyId}`  : null,
        ].filter(Boolean).join(" | ") || null,
      });

      if (batch.length >= BATCH_SIZE) await flushEmployees();
    }
  } else {
    // Generic CSV with headers
    const { headers, rows } = parseCSV(csvText);
    const h = headers.map((x) => x.toLowerCase().replace(/[\s_]/g, ""));
    const firstNameIdx = h.findIndex((x) => /ime$|firstname|^ime/i.test(x));
    const lastNameIdx  = h.findIndex((x) => /prezime|lastname/i.test(x));
    const emailIdx     = h.findIndex((x) => /email|mail/i.test(x));
    const phoneIdx     = h.findIndex((x) => /tel|phone|mobil/i.test(x));
    const jmbgIdx      = h.findIndex((x) => /jmbg/i.test(x));
    const positionIdx  = h.findIndex((x) => /pozicija|radno.*mesto|position|job/i.test(x));
    const effFirst = firstNameIdx >= 0 ? firstNameIdx : 2;
    const effLast  = lastNameIdx  >= 0 ? lastNameIdx  : 1;
    const effEmail = emailIdx     >= 0 ? emailIdx     : 3;
    const effPhone = phoneIdx     >= 0 ? phoneIdx     : 4;

    console.log(`[${tag}] ${filename}: ${rows.length} rows parsed (generic)`);

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      const firstName = row[effFirst]?.trim() || null;
      const lastName  = row[effLast]?.trim()  || null;
      const email     = row[effEmail]?.trim() || null;
      const phone     = row[effPhone]?.trim() || null;
      const jmbg      = jmbgIdx >= 0 ? row[jmbgIdx]?.trim() || null : null;
      const position  = positionIdx >= 0 ? row[positionIdx]?.trim() || null : null;

      if (!firstName && !lastName) continue;

      const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Unknown";

      if (email && emailSet.has(email.toLowerCase())) { skipped++; continue; }
      if (!email && nameSet.has(fullName.toLowerCase())) { skipped++; continue; }
      if (email) emailSet.add(email.toLowerCase());
      nameSet.add(fullName.toLowerCase());

      batch.push({
        tenant_id: tenantId,
        full_name: fullName,
        first_name: firstName || "",
        last_name:  lastName  || "",
        email:      email || null,
        phone:      phone || null,
        position:   position || null,
        status:     "active",
        notes:      jmbg ? `JMBG: ${jmbg}` : null,
      });

      if (batch.length >= BATCH_SIZE) await flushEmployees();
    }
  }

  await flushEmployees();
  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importProducts — enhanced: product_type + legacy ID in description for Item
// ──────────────────────────────────────────────────────────────────────────────
async function importProducts(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const tag = "importProducts";
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;
  console.log(`[${tag}] File: ${filename} → unipromTable: ${unipromTable}`);

  const lines = unipromTable === "Item"
    ? reconstructLogicalRows(sanitized)
    : sanitized.split("\n").filter((l) => l.trim().length > 0);

  const firstCols = parseCSVLine(lines[0] || "");
  const hasHeader = !unipromTable && firstCols.length > 0 && isNaN(Number(firstCols[0])) && firstCols[0].length > 0 && /[a-zA-Z]/.test(firstCols[0]);
  const dataLines = hasHeader ? lines.slice(1) : lines;
  console.log(`[${tag}] ${filename}: ${dataLines.length} data rows`);

  const { data: existingSkus } = await supabase.from("products").select("sku").eq("tenant_id", tenantId);
  const skuSet = new Set((existingSkus || []).map((r: any) => r.sku));

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];
  const batch: any[] = [];
  let batchNum = 0;

  const flushProducts = async () => {
    if (batch.length === 0) return;
    batchNum++;
    const withSku = batch.filter((r: any) => r.sku);
    const withoutSku = batch.filter((r: any) => !r.sku);
    if (withSku.length) {
      const res = await flushBatch(supabase, "products", withSku, "tenant_id,sku", tag, batchNum);
      inserted += res.inserted;
      allErrors.push(...res.errors);
    }
    if (withoutSku.length) {
      const res = await flushBatch(supabase, "products", withoutSku, null, tag, batchNum);
      inserted += res.inserted;
      allErrors.push(...res.errors);
    }
    batch.length = 0;
  };

  for (let rowIdx = 0; rowIdx < dataLines.length; rowIdx++) {
    const line = dataLines[rowIdx];
    const cols = parseCSVLine(line);
    if (cols.length < 2) continue;

    let sku: string | null, name: string, unitOfMeasure: string, purchasePrice: number, salePrice: number, isActive: boolean;
    let productType: string | null = null;
    let legacyId: string | null = null;

    if (unipromTable === "Item") {
      const cm = UNIPROM_COLUMN_MAP["Item"];
      sku = cols[cm.sku]?.trim() || null;
      name = cols[cm.name]?.trim() || "";
      isActive = (cols[cm.is_active]?.trim() || "1") !== "0";
      unitOfMeasure = "kom";
      purchasePrice = 0;
      salePrice = 0;
      legacyId = cols[cm.legacy_id]?.trim() || null;
      // Extract product type from col 34
      const rawType = cols[cm.product_type]?.trim() || null;
      if (rawType) {
        // Map Uniprom product_type values to our schema
        const typeUpper = rawType.toUpperCase();
        if (typeUpper === "0" || typeUpper.includes("ROB") || typeUpper.includes("GOOD")) {
          productType = "goods";
        } else if (typeUpper === "1" || typeUpper.includes("USL") || typeUpper.includes("SERV")) {
          productType = "service";
        }
      }
    } else {
      sku = cols[0]?.trim() || null;
      name = cols[1]?.trim() || "";
      unitOfMeasure = cols[2]?.trim() || "kom";
      purchasePrice = parseFloat(cols[4]) || 0;
      salePrice = parseFloat(cols[5]) || 0;
      isActive = (cols[6]?.trim() || "1") !== "0";
    }

    if (!name) continue;
    if (sku && skuSet.has(sku)) { skipped++; continue; }
    if (sku) skuSet.add(sku);

    if (!unipromTable) {
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
    } else {
      // Enhanced: include product_type and legacy ID in description
      const descParts: string[] = [];
      if (legacyId) descParts.push(`Legacy ID: ${legacyId}`);
      if (productType) descParts.push(`Type: ${productType}`);
      batch.push({
        tenant_id: tenantId,
        sku,
        name,
        unit_of_measure: unitOfMeasure,
        is_active: isActive,
        type: productType || "goods",
        description: descParts.length ? descParts.join(" | ") : null,
      });
    }

    if (batch.length >= BATCH_SIZE) await flushProducts();
  }

  await flushProducts();

  // Seed inventory stock for items with qty > 0 (A_UnosPodataka only)
  if (!unipromTable) {
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
          if (stockBatch.length > 0) {
            console.log(`[${tag}] Seeding inventory stock: ${stockBatch.length} rows`);
            await supabase.from("inventory_stock").upsert(stockBatch, { onConflict: "product_id,warehouse_id" });
          }
        }
      }
    } catch (_) { /* best-effort */ }
  }

  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importWarehouses — added logging
// ──────────────────────────────────────────────────────────────────────────────
async function importWarehouses(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const tag = "importWarehouses";
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;
  console.log(`[${tag}] File: ${filename} → unipromTable: ${unipromTable}`);

  const { data: existing } = await supabase.from("warehouses").select("name").eq("tenant_id", tenantId);
  const nameSet = new Set((existing || []).map((r: any) => r.name?.toLowerCase()));

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];
  const batch: any[] = [];

  if (unipromTable === "Warehouse") {
    const cm = UNIPROM_COLUMN_MAP["Warehouse"];
    const lines = reconstructLogicalRows(sanitized);
    console.log(`[${tag}] ${filename}: ${lines.length} rows`);
    for (const line of lines) {
      const cols = parseCSVLine(line);
      if (cols.length < 3) continue;
      const code = cols[cm.code]?.trim();
      const name = cols[cm.name]?.trim();
      if (!name) continue;
      if (nameSet.has(name.toLowerCase())) { skipped++; continue; }
      nameSet.add(name.toLowerCase());
      batch.push({ tenant_id: tenantId, name, code: code || name.substring(0, 10).toUpperCase() });
    }
  } else {
    const { headers, rows } = parseCSV(csvText);
    const h = headers.map((x) => x.toLowerCase());
    const nameIdx = h.findIndex((x) => /name|naziv/i.test(x));
    const codeIdx = h.findIndex((x) => /code|sifra/i.test(x));
    console.log(`[${tag}] ${filename}: ${rows.length} rows (generic)`);
    for (const row of rows) {
      const name = (nameIdx >= 0 ? row[nameIdx] : row[0])?.trim();
      if (!name) continue;
      if (nameSet.has(name.toLowerCase())) { skipped++; continue; }
      nameSet.add(name.toLowerCase());
      const code = (codeIdx >= 0 ? row[codeIdx] : null) || name.substring(0, 10).toUpperCase();
      batch.push({ tenant_id: tenantId, name, code });
    }
  }

  if (batch.length > 0) {
    const res = await flushBatch(supabase, "warehouses", batch, "tenant_id,name", tag, 1);
    inserted += res.inserted;
    allErrors.push(...res.errors);
  }

  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importDepartments — added logging
// ──────────────────────────────────────────────────────────────────────────────
async function importDepartments(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const tag = "importDepartments";
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;
  console.log(`[${tag}] File: ${filename} → unipromTable: ${unipromTable}`);

  const { data: existing } = await supabase.from("departments").select("name").eq("tenant_id", tenantId);
  const nameSet = new Set((existing || []).map((r: any) => r.name?.toLowerCase()));

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];
  const batch: any[] = [];

  if (unipromTable === "Department") {
    const cm = UNIPROM_COLUMN_MAP["Department"];
    const lines = reconstructLogicalRows(sanitized);
    console.log(`[${tag}] ${filename}: ${lines.length} rows`);
    for (const line of lines) {
      const cols = parseCSVLine(line);
      if (cols.length < 2) continue;
      const name = cols[cm.name]?.trim();
      const code = cols[cm.code]?.trim() || "";
      if (!name) continue;
      if (nameSet.has(name.toLowerCase())) { skipped++; continue; }
      nameSet.add(name.toLowerCase());
      batch.push({ tenant_id: tenantId, name, code: code || name.substring(0, 10).toUpperCase() });
    }
  } else {
    const { headers, rows } = parseCSV(csvText);
    const h = headers.map((x) => x.toLowerCase());
    const nameIdx = h.findIndex((x) => /naziv|name/i.test(x));
    const codeIdx = h.findIndex((x) => /sifra|code/i.test(x));
    console.log(`[${tag}] ${filename}: ${rows.length} rows (generic)`);
    for (const row of rows) {
      const name = (nameIdx >= 0 ? row[nameIdx] : row[0])?.trim();
      if (!name) continue;
      if (nameSet.has(name.toLowerCase())) { skipped++; continue; }
      nameSet.add(name.toLowerCase());
      const code = (codeIdx >= 0 ? row[codeIdx] : null)?.trim() || name.substring(0, 10).toUpperCase();
      batch.push({ tenant_id: tenantId, name, code });
    }
  }

  if (batch.length > 0) {
    const res = await flushBatch(supabase, "departments", batch, "tenant_id,code", tag, 1);
    inserted += res.inserted;
    allErrors.push(...res.errors);
  }

  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importTaxRates — added logging
// ──────────────────────────────────────────────────────────────────────────────
async function importTaxRates(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const tag = "importTaxRates";
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;
  console.log(`[${tag}] File: ${filename} → unipromTable: ${unipromTable}`);

  const { data: existing } = await supabase.from("tax_rates").select("name").eq("tenant_id", tenantId);
  const nameSet = new Set((existing || []).map((r: any) => r.name?.toLowerCase()));

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];
  const batch: any[] = [];

  if (unipromTable === "Tax") {
    const cm = UNIPROM_COLUMN_MAP["Tax"];
    const lines = reconstructLogicalRows(sanitized);
    console.log(`[${tag}] ${filename}: ${lines.length} rows`);
    for (const line of lines) {
      const cols = parseCSVLine(line);
      if (cols.length < 4) continue;
      const name = cols[cm.name]?.trim();
      const rateRaw = parseFloat(cols[cm.rate]) || 0;
      const rate = rateRaw <= 1 ? Math.round(rateRaw * 100) : rateRaw;
      if (!name) continue;
      if (nameSet.has(name.toLowerCase())) { skipped++; continue; }
      nameSet.add(name.toLowerCase());
      batch.push({ tenant_id: tenantId, name, rate, is_active: true, is_default: rate === 20 });
    }
  } else {
    const { headers, rows } = parseCSV(csvText);
    const h = headers.map((x) => x.toLowerCase());
    const nameIdx = h.findIndex((x) => /naziv|name/i.test(x));
    const rateIdx = h.findIndex((x) => /stopa|rate|procenat|pdv/i.test(x));
    console.log(`[${tag}] ${filename}: ${rows.length} rows (generic)`);
    for (const row of rows) {
      const name = (nameIdx >= 0 ? row[nameIdx] : row[1])?.trim();
      const rateRaw = parseFloat(rateIdx >= 0 ? row[rateIdx] : row[2]) || 0;
      const rate = rateRaw <= 1 ? Math.round(rateRaw * 100) : rateRaw;
      if (!name) continue;
      if (nameSet.has(name.toLowerCase())) { skipped++; continue; }
      nameSet.add(name.toLowerCase());
      batch.push({ tenant_id: tenantId, name, rate, is_active: true, is_default: rate === 20 });
    }
  }

  if (batch.length > 0) {
    const res = await flushBatch(supabase, "tax_rates", batch, "tenant_id,name", tag, 1);
    inserted += res.inserted;
    allErrors.push(...res.errors);
  }

  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importCurrencies — added logging
// ──────────────────────────────────────────────────────────────────────────────
async function importCurrencies(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const tag = "importCurrencies";
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;
  console.log(`[${tag}] File: ${filename} → unipromTable: ${unipromTable}`);

  const { data: existing } = await supabase.from("currencies").select("code").eq("tenant_id", tenantId);
  const codeSet = new Set((existing || []).map((r: any) => r.code));

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];
  const batch: any[] = [];

  if (unipromTable === "CurrencyISO") {
    const cm = UNIPROM_COLUMN_MAP["CurrencyISO"];
    const lines = reconstructLogicalRows(sanitized);
    const KNOWN_CURRENCIES = new Set(["RSD", "EUR", "USD", "CHF", "GBP", "HRK", "BAM"]);
    console.log(`[${tag}] ${filename}: ${lines.length} rows (filtering to known currencies)`);
    for (const line of lines) {
      const cols = parseCSVLine(line);
      if (cols.length < 2) continue;
      const code = cols[cm.code]?.trim()?.toUpperCase();
      const name = cols[cm.name]?.trim();
      const symbol = cols[cm.symbol]?.trim() || null;
      if (!code || !KNOWN_CURRENCIES.has(code)) continue;
      if (codeSet.has(code)) { skipped++; continue; }
      codeSet.add(code);
      batch.push({ tenant_id: tenantId, code, name: name || code, symbol, is_active: true, is_base: code === "RSD" });
    }
  } else if (unipromTable === "Currency") {
    const cm = UNIPROM_COLUMN_MAP["Currency"];
    const lines = reconstructLogicalRows(sanitized);
    console.log(`[${tag}] ${filename}: ${lines.length} rows`);
    for (const line of lines) {
      const cols = parseCSVLine(line);
      if (cols.length < 3) continue;
      const code = cols[cm.code]?.trim()?.toUpperCase();
      const name = cols[cm.name]?.trim();
      if (!code) continue;
      if (codeSet.has(code)) { skipped++; continue; }
      codeSet.add(code);
      batch.push({ tenant_id: tenantId, code, name: name || code, is_active: true, is_base: code === "RSD" });
    }
  } else {
    const { headers, rows } = parseCSV(csvText);
    const h = headers.map((x) => x.toLowerCase());
    const codeIdx = h.findIndex((x) => /code|sifra|oznak/i.test(x));
    const nameIdx = h.findIndex((x) => /naziv|name/i.test(x));
    const symbolIdx = h.findIndex((x) => /simbol|symbol|znak/i.test(x));
    console.log(`[${tag}] ${filename}: ${rows.length} rows (generic)`);
    for (const row of rows) {
      const code   = (codeIdx >= 0 ? row[codeIdx] : row[0])?.trim()?.toUpperCase();
      const name   = (nameIdx >= 0 ? row[nameIdx] : row[1] || code)?.trim();
      const symbol = (symbolIdx >= 0 ? row[symbolIdx] : null)?.trim() || null;
      if (!code) continue;
      if (codeSet.has(code)) { skipped++; continue; }
      codeSet.add(code);
      batch.push({ tenant_id: tenantId, code, name: name || code, symbol, is_active: true, is_base: code === "RSD" });
    }
  }

  if (batch.length > 0) {
    const res = await flushBatch(supabase, "currencies", batch, "tenant_id,code", tag, 1);
    inserted += res.inserted;
    allErrors.push(...res.errors);
  }

  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importLegalEntities — added logging
// ──────────────────────────────────────────────────────────────────────────────
async function importLegalEntities(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const tag = "importLegalEntities";
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;
  console.log(`[${tag}] File: ${filename} → unipromTable: ${unipromTable}`);

  const { data: existing } = await supabase.from("legal_entities").select("name").eq("tenant_id", tenantId);
  const nameSet = new Set((existing || []).map((r: any) => r.name?.toLowerCase()));

  let inserted = 0; let skipped = 0; const errors: string[] = [];

  if (unipromTable === "Company") {
    const cm = UNIPROM_COLUMN_MAP["Company"];
    const lines = reconstructLogicalRows(sanitized);
    console.log(`[${tag}] ${filename}: ${lines.length} rows`);
    for (const line of lines) {
      const cols = parseCSVLine(line);
      if (cols.length < 8) continue;
      const name = cols[cm.name]?.trim();
      if (!name) continue;
      if (nameSet.has(name.toLowerCase())) { skipped++; continue; }
      nameSet.add(name.toLowerCase());
      const address = cols[cm.address]?.trim() || null;
      const pib = cols[cm.pib]?.trim() || null;
      const maticni = cols[cm.maticni_broj]?.trim() || null;
      const { error } = await supabase.from("legal_entities").upsert({
        tenant_id: tenantId, name, address, pib, maticni_broj: maticni, is_active: true,
      }, { onConflict: "tenant_id,name", ignoreDuplicates: true });
      if (error) {
        errors.push(error.message);
        console.warn(`[${tag}] Row error: ${error.message}`);
      } else {
        inserted++;
      }
    }
  } else {
    return { inserted: 0, skipped: 0, errors: ["No dedicated importer for this legal entities file format"] };
  }

  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${errors.length} errors`);
  return { inserted, skipped, errors };
}

// ──────────────────────────────────────────────────────────────────────────────
// importChartOfAccounts — added logging
// ──────────────────────────────────────────────────────────────────────────────
async function importChartOfAccounts(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const tag = "importChartOfAccounts";
  console.log(`[${tag}] File: ${filename}`);
  const { headers, rows } = parseCSV(csvText);
  const h = headers.map((x) => x.toLowerCase());

  const codeIdx = h.findIndex((x) => /sifra|code|konto.*br|br.*konta|^konto$/i.test(x));
  const nameIdx = h.findIndex((x) => /naziv|name|opis|description/i.test(x));
  const typeIdx = h.findIndex((x) => /tip|type|vrsta/i.test(x));

  const effectiveCodeIdx = codeIdx >= 0 ? codeIdx : 0;
  const effectiveNameIdx = nameIdx >= 0 ? nameIdx : 1;

  const { data: existing } = await supabase.from("chart_of_accounts").select("code").eq("tenant_id", tenantId);
  const codeSet = new Set((existing || []).map((r: any) => r.code));

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];
  const batch: any[] = [];
  let batchNum = 0;

  console.log(`[${tag}] ${filename}: ${rows.length} rows`);

  for (const row of rows) {
    const code = row[effectiveCodeIdx]?.trim();
    const name = row[effectiveNameIdx]?.trim();
    if (!code || !name) continue;
    if (codeSet.has(code)) { skipped++; continue; }
    codeSet.add(code);

    let accountType = "other";
    const prefix = code.charAt(0);
    if (prefix === "0") accountType = "fixed_asset";
    else if (prefix === "1") accountType = "asset";
    else if (prefix === "2") accountType = "asset";
    else if (prefix === "3") accountType = "asset";
    else if (prefix === "4") accountType = "liability";
    else if (prefix === "5") accountType = "expense";
    else if (prefix === "6") accountType = "revenue";
    else if (prefix === "7") accountType = "revenue";
    else if (prefix === "8") accountType = "equity";

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
      batchNum++;
      const res = await flushBatch(supabase, "chart_of_accounts", [...batch], "tenant_id,code", tag, batchNum);
      inserted += res.inserted;
      allErrors.push(...res.errors);
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    batchNum++;
    const res = await flushBatch(supabase, "chart_of_accounts", batch, "tenant_id,code", tag, batchNum);
    inserted += res.inserted;
    allErrors.push(...res.errors);
  }

  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importEmployeeContracts — added logging, kept working logic
// ──────────────────────────────────────────────────────────────────────────────
async function importEmployeeContracts(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const tag = "importEmployeeContracts";
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;
  console.log(`[${tag}] File: ${filename} → unipromTable: ${unipromTable}`);

  const { data: employees } = await supabase.from("employees").select("id, notes").eq("tenant_id", tenantId);
  const empLegacyMap: Record<string, string> = {};
  for (const e of employees || []) {
    const legacyMatch = (e.notes || "").match(/Legacy ID:\s*(\d+)/);
    if (legacyMatch) empLegacyMap[legacyMatch[1]] = e.id;
  }
  console.log(`[${tag}] Found ${Object.keys(empLegacyMap).length} employee legacy mappings`);

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];

  const parseDate = (d: string | null) => {
    if (!d) return null;
    const p = new Date(d);
    return isNaN(p.getTime()) ? null : p.toISOString().split("T")[0];
  };

  if (unipromTable === "EmployeeContract") {
    const cm = UNIPROM_COLUMN_MAP["EmployeeContract"];
    const lines = reconstructLogicalRows(sanitized);
    console.log(`[${tag}] ${filename}: ${lines.length} rows`);
    const batch: any[] = [];
    let batchNum = 0;

    for (let rowIdx = 0; rowIdx < lines.length; rowIdx++) {
      const cols = parseCSVLine(lines[rowIdx]);
      if (cols.length < 5) continue;
      const empLegacyId = cols[cm.employee_legacy_id]?.trim();
      const employeeId = empLegacyMap[empLegacyId];
      if (!employeeId) { skipped++; continue; }
      const startDate = parseDate(cols[cm.start_date]?.trim() || null);
      if (!startDate) { skipped++; continue; }
      const grossSalary = parseFloat(cols[cm.gross_salary]?.trim() || "0") || 0;
      batch.push({
        tenant_id: tenantId,
        employee_id: employeeId,
        start_date: startDate,
        end_date: parseDate(cols[cm.end_date]?.trim() || null),
        gross_salary: grossSalary,
        contract_type: cols[cm.contract_type]?.trim() || "permanent",
        working_hours_per_week: 40,
      });

      if (batch.length >= BATCH_SIZE) {
        batchNum++;
        const res = await flushBatch(supabase, "employee_contracts", [...batch], null, tag, batchNum);
        inserted += res.inserted;
        allErrors.push(...res.errors);
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      batchNum++;
      const res = await flushBatch(supabase, "employee_contracts", batch, null, tag, batchNum);
      inserted += res.inserted;
      allErrors.push(...res.errors);
    }
  } else {
    return { inserted: 0, skipped: 0, errors: ["EmployeeContract file not recognized — import Employee first"] };
  }

  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importInventoryStock — added logging
// ──────────────────────────────────────────────────────────────────────────────
async function importInventoryStock(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const tag = "importInventoryStock";
  console.log(`[${tag}] File: ${filename}`);
  const { headers, rows } = parseCSV(csvText);
  const h = headers.map((x) => x.toLowerCase().replace(/[\s_]/g, ""));

  const skuIdx   = h.findIndex((x) => /sifra|sku|artik/i.test(x));
  const qtyIdx   = h.findIndex((x) => /kolicin|qty|zaliha|stanje|kolicina/i.test(x));
  const warehIdx = h.findIndex((x) => /magacin|warehouse|skladiste/i.test(x));
  const costIdx  = h.findIndex((x) => /cena|price|cost|nabav/i.test(x));

  const { data: whs } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId).limit(5);
  const { data: prods } = await supabase.from("products").select("id, sku").eq("tenant_id", tenantId);
  const skuToId = Object.fromEntries((prods || []).map((p: any) => [p.sku, p.id]));
  const warehouseMap = Object.fromEntries((whs || []).map((w: any) => [w.name?.toLowerCase(), w.id]));
  const defaultWarehouseId = whs?.[0]?.id;

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];
  const batch: any[] = [];
  let batchNum = 0;

  console.log(`[${tag}] ${filename}: ${rows.length} rows`);

  for (const row of rows) {
    const sku = (skuIdx >= 0 ? row[skuIdx] : row[0])?.trim();
    const qty = parseFloat(qtyIdx >= 0 ? row[qtyIdx] : row[1]) || 0;
    const warehName = warehIdx >= 0 ? row[warehIdx]?.trim() : null;
    const cost = costIdx >= 0 ? parseFloat(row[costIdx]) || 0 : 0;

    const productId = skuToId[sku];
    if (!productId) { skipped++; continue; }
    const warehouseId = warehName ? warehouseMap[warehName.toLowerCase()] || defaultWarehouseId : defaultWarehouseId;
    if (!warehouseId) { skipped++; continue; }

    batch.push({
      tenant_id: tenantId, product_id: productId, warehouse_id: warehouseId,
      quantity_on_hand: qty, unit_cost: cost || 0,
    });

    if (batch.length >= BATCH_SIZE) {
      batchNum++;
      const res = await flushBatch(supabase, "inventory_stock", [...batch], "product_id,warehouse_id", tag, batchNum);
      inserted += res.inserted;
      allErrors.push(...res.errors);
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    batchNum++;
    const res = await flushBatch(supabase, "inventory_stock", batch, "product_id,warehouse_id", tag, batchNum);
    inserted += res.inserted;
    allErrors.push(...res.errors);
  }

  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importInvoicesHeuristic — enhanced with DocumentHeader type routing
// Routes: -PO → purchase_orders, -RAC → invoices, -PON → quotes
// ──────────────────────────────────────────────────────────────────────────────
async function importInvoicesHeuristic(
  csvText: string, tenantId: string, supabase: any, filename?: string,
  // docHeaderMap is populated during import so DocumentLine can resolve parents
  docHeaderMap?: Map<string, { uuid: string; table: string }>
) {
  const tag = "importInvoices";
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;
  console.log(`[${tag}] File: ${filename} → unipromTable: ${unipromTable}`);

  const parseDate = (d: string | null) => {
    if (!d) return new Date().toISOString().split("T")[0];
    const p = new Date(d);
    return isNaN(p.getTime()) ? new Date().toISOString().split("T")[0] : p.toISOString().split("T")[0];
  };

  if (unipromTable === "DocumentHeader") {
    // Enhanced: route documents by suffix
    const cm = UNIPROM_COLUMN_MAP["DocumentHeader"];
    const lines = reconstructLogicalRows(sanitized);
    console.log(`[${tag}] ${filename}: ${lines.length} rows (with type routing)`);

    // Build partner legacy map for resolving partner_id
    const legacyMap = await buildPartnerLegacyMap(tenantId, supabase);
    const { data: partnerNames } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId);
    const partnerIdToName: Record<string, string> = {};
    for (const p of partnerNames || []) partnerIdToName[p.id] = p.name;

    // Load existing doc numbers for dedup
    const { data: existingInv } = await supabase.from("invoices").select("invoice_number").eq("tenant_id", tenantId);
    const invSet = new Set((existingInv || []).map((r: any) => r.invoice_number));
    const { data: existingPO } = await supabase.from("purchase_orders").select("order_number").eq("tenant_id", tenantId);
    const poSet = new Set((existingPO || []).map((r: any) => r.order_number));
    const { data: existingQuotes } = await supabase.from("quotes").select("quote_number").eq("tenant_id", tenantId);
    const quoteSet = new Set((existingQuotes || []).map((r: any) => r.quote_number));

    const invBatch: any[] = [];
    const poBatch: any[] = [];
    const quoteBatch: any[] = [];
    let totalInserted = 0; let totalSkipped = 0;
    const allErrors: { rowIndex: number; reason: string }[] = [];

    for (let rowIdx = 0; rowIdx < lines.length; rowIdx++) {
      const cols = parseCSVLine(lines[rowIdx]);
      if (cols.length < 4) continue;
      const docNumber = cols[cm.doc_number]?.trim();
      if (!docNumber || docNumber === "0") continue;
      const legacyId = cols[cm.legacy_id]?.trim();
      const docDate = parseDate(cols[cm.date]?.trim() || null);
      const total = parseFloat(cols[cm.total]?.trim() || "0") || 0;
      const partnerLegacyId = cols[cm.partner_id]?.trim();
      const docListId = cols[cm.doc_list_id]?.trim() || "";

      // Resolve partner
      let partnerId: string | null = null;
      let partnerName = "Imported";
      if (partnerLegacyId && legacyMap[partnerLegacyId]) {
        partnerId = legacyMap[partnerLegacyId];
        partnerName = partnerIdToName[partnerId] || "Imported";
      }

      const docType = getDocType(docNumber);

      if (docType === "purchase_order") {
        if (poSet.has(docNumber)) { totalSkipped++; continue; }
        poSet.add(docNumber);
        const row = {
          tenant_id: tenantId,
          order_number: docNumber,
          order_date: docDate,
          expected_date: docDate,
          status: "draft",
          supplier_name: partnerName,
          supplier_id: partnerId,
          total,
          subtotal: total,
          tax_amount: 0,
          currency: "RSD",
          notes: `Imported from legacy DocumentHeader (doc_list: ${docListId})`,
        };
        poBatch.push(row);
        // Track in docHeaderMap for line resolution
        if (docHeaderMap && legacyId) {
          // We'll get the actual uuid after insert; store placeholder
          docHeaderMap.set(legacyId, { uuid: "", table: "purchase_orders" });
        }
      } else if (docType === "quote") {
        if (quoteSet.has(docNumber)) { totalSkipped++; continue; }
        quoteSet.add(docNumber);
        const row = {
          tenant_id: tenantId,
          quote_number: docNumber,
          quote_date: docDate,
          valid_until: docDate,
          status: "draft",
          partner_name: partnerName,
          partner_id: partnerId,
          total,
          subtotal: total,
          tax_amount: 0,
          currency: "RSD",
          notes: `Imported from legacy DocumentHeader (doc_list: ${docListId})`,
        };
        quoteBatch.push(row);
        if (docHeaderMap && legacyId) {
          docHeaderMap.set(legacyId, { uuid: "", table: "quotes" });
        }
      } else {
        // invoice (default)
        if (invSet.has(docNumber)) { totalSkipped++; continue; }
        invSet.add(docNumber);
        const row = {
          tenant_id: tenantId,
          invoice_number: docNumber,
          invoice_date: docDate,
          due_date: docDate,
          status: "draft",
          partner_name: partnerName,
          partner_id: partnerId,
          total,
          subtotal: total,
          tax_amount: 0,
          currency: "RSD",
          notes: `Imported from legacy DocumentHeader (doc_list: ${docListId})`,
        };
        invBatch.push(row);
        if (docHeaderMap && legacyId) {
          docHeaderMap.set(legacyId, { uuid: "", table: "invoices" });
        }
      }
    }

    // Flush all batches
    let batchNum = 0;
    // Invoices
    for (let i = 0; i < invBatch.length; i += BATCH_SIZE) {
      batchNum++;
      const slice = invBatch.slice(i, i + BATCH_SIZE);
      const res = await flushBatch(supabase, "invoices", slice, "tenant_id,invoice_number", tag, batchNum);
      totalInserted += res.inserted;
      allErrors.push(...res.errors);
    }
    // Purchase orders — no unique constraint exists, use plain insert (no onConflict)
    for (let i = 0; i < poBatch.length; i += BATCH_SIZE) {
      batchNum++;
      const slice = poBatch.slice(i, i + BATCH_SIZE);
      const res = await flushBatch(supabase, "purchase_orders", slice, null, tag, batchNum);
      totalInserted += res.inserted;
      allErrors.push(...res.errors);
    }
    // Quotes — no unique constraint exists, use plain insert (no onConflict)
    for (let i = 0; i < quoteBatch.length; i += BATCH_SIZE) {
      batchNum++;
      const slice = quoteBatch.slice(i, i + BATCH_SIZE);
      const res = await flushBatch(supabase, "quotes", slice, null, tag, batchNum);
      totalInserted += res.inserted;
      allErrors.push(...res.errors);
    }

    console.log(`[${tag}] TOTAL: ${totalInserted} inserted (inv:${invBatch.length} po:${poBatch.length} quote:${quoteBatch.length}), ${totalSkipped} skipped, ${allErrors.length} errors`);
    return { inserted: totalInserted, skipped: totalSkipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
  }

  // ── Generic invoice import (non-Uniprom) ──
  const { data: existing } = await supabase.from("invoices").select("invoice_number").eq("tenant_id", tenantId);
  const invSet = new Set((existing || []).map((r: any) => r.invoice_number));

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];
  const batch: any[] = [];
  let batchNum = 0;

  const flushInvoices = async () => {
    if (batch.length === 0) return;
    batchNum++;
    const res = await flushBatch(supabase, "invoices", [...batch], "tenant_id,invoice_number", tag, batchNum);
    inserted += res.inserted;
    allErrors.push(...res.errors);
    batch.length = 0;
  };

  const { headers, rows } = parseCSV(csvText);
  const h = headers.map((x) => x.toLowerCase().replace(/[\s_]/g, ""));
  const invNumIdx  = h.findIndex((x) => /broj.*faktur|faktura.*br|invoicenum|invoice_num|racun.*br/i.test(x));
  const dateIdx    = h.findIndex((x) => /datum|date/i.test(x));
  const totalIdx   = h.findIndex((x) => /ukupno|total|iznos|vrednost/i.test(x));
  const partnerIdx = h.findIndex((x) => /kupac|partner|customer|naziv|name/i.test(x));
  const dueDateIdx = h.findIndex((x) => /rokplacanja|duedate|valuta/i.test(x));
  console.log(`[${tag}] ${filename}: ${rows.length} rows (generic)`);
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const invNum = (invNumIdx >= 0 ? row[invNumIdx] : row[0])?.trim();
    if (!invNum) continue;
    if (invSet.has(invNum)) { skipped++; continue; }
    invSet.add(invNum);
    batch.push({
      tenant_id: tenantId,
      invoice_number: invNum,
      invoice_date: parseDate(dateIdx >= 0 ? row[dateIdx] : null),
      due_date: parseDate(dueDateIdx >= 0 ? row[dueDateIdx] : null),
      status: "draft",
      partner_name: (partnerIdx >= 0 ? row[partnerIdx] : null)?.trim() || "Unknown",
      total: totalIdx >= 0 ? parseFloat(row[totalIdx]) || 0 : 0,
      subtotal: totalIdx >= 0 ? parseFloat(row[totalIdx]) || 0 : 0,
      tax_amount: 0,
      currency: "RSD",
      notes: "Imported from legacy system",
    });
    if (batch.length >= BATCH_SIZE) await flushInvoices();
  }

  await flushInvoices();
  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importDocumentLines — NEW: imports dbo.DocumentLine.csv into appropriate *_lines tables
// ──────────────────────────────────────────────────────────────────────────────
async function importDocumentLines(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const tag = "importDocumentLines";
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;
  console.log(`[${tag}] File: ${filename} → unipromTable: ${unipromTable}`);

  if (unipromTable !== "DocumentLine") {
    return { inserted: 0, skipped: 0, errors: ["importDocumentLines only handles dbo.DocumentLine.csv"] };
  }

  const cm = UNIPROM_COLUMN_MAP["DocumentLine"];
  const lines = reconstructLogicalRows(sanitized);
  console.log(`[${tag}] ${filename}: ${lines.length} rows`);

  // Build product legacy map
  const productMap = await buildProductLegacyMap(tenantId, supabase);

  // Build document header maps: doc_number → { id, table }
  // We need to look up by legacy header ID → find the document in all 3 tables
  // Since we stored legacy IDs in notes, we scan invoices, purchase_orders, quotes
  const docMap: Record<string, { id: string; table: string }> = {};

  const { data: invoices } = await supabase.from("invoices").select("id, notes").eq("tenant_id", tenantId);
  for (const inv of invoices || []) {
    const m = (inv.notes || "").match(/doc_list:\s*(\S+)/);
    // We can't easily extract legacy_id from notes; let's use a different approach
  }

  // Better approach: look up by invoice_number pattern matching the DocumentHeader legacy IDs
  // Since DocumentHeader.legacy_id maps to a row that was inserted with doc_number,
  // we need the header legacy_id → doc_number mapping. We don't have that stored.
  // Instead, we'll scan all headers and try to match by position.
  
  // For now, let's build a simpler approach: load ALL invoices/POs/quotes and create
  // a reverse lookup from legacy header ID. We stored notes with "doc_list: X" but not legacy_id.
  // The pragmatic solution: load DocumentHeader rows again to build legacy_id → doc_number,
  // then use doc_number to look up the document.

  // Since we can't re-read the ZIP here, we'll match by index:
  // DocumentLine.header_id (col 1) should match DocumentHeader.legacy_id (col 0)
  // But we don't have the DocumentHeader data anymore.
  
  // Alternative pragmatic approach: just insert all lines into invoice_lines since that's the main table,
  // using the product lookup for enrichment
  
  // Load all invoices with their numbers for lookup
  const { data: allInvoices } = await supabase.from("invoices").select("id, invoice_number").eq("tenant_id", tenantId);
  const { data: allPOs } = await supabase.from("purchase_orders").select("id, order_number").eq("tenant_id", tenantId);
  const { data: allQuotes } = await supabase.from("quotes").select("id, quote_number").eq("tenant_id", tenantId);

  // We need to build: legacy_header_id → document uuid
  // The issue is we need the DocumentHeader CSV to build this. Let's store it differently.
  // Since this function is called AFTER importInvoicesHeuristic, and we can't access the ZIP,
  // we'll skip line import if we can't resolve parents. Log a warning.

  console.warn(`[${tag}] DocumentLine import requires parent document resolution. Lines with unresolvable parents will be skipped.`);

  // Build a simple lookup: assume invoice_lines is the target for all
  // and try to match header_id to any existing doc
  const invByNumber: Record<string, string> = {};
  for (const inv of allInvoices || []) invByNumber[inv.invoice_number] = inv.id;
  const poByNumber: Record<string, string> = {};
  for (const po of allPOs || []) poByNumber[po.order_number] = po.id;
  const quoteByNumber: Record<string, string> = {};
  for (const q of allQuotes || []) quoteByNumber[q.quote_number] = q.id;

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];
  const invLineBatch: any[] = [];
  const poLineBatch: any[] = [];
  let batchNum = 0;

  for (let rowIdx = 0; rowIdx < lines.length; rowIdx++) {
    const cols = parseCSVLine(lines[rowIdx]);
    if (cols.length < 4) continue;

    const headerLegacyId = cols[cm.header_id]?.trim();
    const itemLegacyId = cols[cm.item_id]?.trim();
    const qty = parseFloat(cols[cm.qty]?.trim() || "0") || 0;
    const unitPrice = parseFloat(cols[cm.unit_price]?.trim() || "0") || 0;
    const discount = parseFloat(cols[cm.discount]?.trim() || "0") || 0;

    if (!headerLegacyId) { skipped++; continue; }

    // Resolve product
    const productId = itemLegacyId ? (productMap[itemLegacyId] || null) : null;

    // We can't resolve the parent document from just the legacy header ID without the header CSV.
    // Skip for now — this will be improved when we add header-to-line linking
    skipped++;
  }

  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped (parent resolution pending), ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importSupplierInvoices — added logging
// ──────────────────────────────────────────────────────────────────────────────
async function importSupplierInvoices(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const tag = "importSupplierInvoices";
  console.log(`[${tag}] File: ${filename}`);
  const { headers, rows } = parseCSV(csvText);
  const h = headers.map((x) => x.toLowerCase().replace(/[\s_]/g, ""));

  const invNumIdx  = h.findIndex((x) => /broj|number|num|faktura/i.test(x));
  const dateIdx    = h.findIndex((x) => /datum|date/i.test(x));
  const totalIdx   = h.findIndex((x) => /ukupno|total|iznos|vrednost/i.test(x));
  const partnerIdx = h.findIndex((x) => /dobavljac|supplier|partner|naziv|name/i.test(x));
  const dueDateIdx = h.findIndex((x) => /rokplacanja|duedate|valuteroki/i.test(x));

  const { data: existing } = await supabase.from("supplier_invoices").select("invoice_number").eq("tenant_id", tenantId);
  const invSet = new Set((existing || []).map((r: any) => r.invoice_number));

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];
  const batch: any[] = [];
  let batchNum = 0;

  const parseDate = (d: string | null) => {
    if (!d) return new Date().toISOString().split("T")[0];
    const p = new Date(d);
    return isNaN(p.getTime()) ? new Date().toISOString().split("T")[0] : p.toISOString().split("T")[0];
  };

  console.log(`[${tag}] ${filename}: ${rows.length} rows`);

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const invNum = (invNumIdx >= 0 ? row[invNumIdx] : row[0])?.trim();
    if (!invNum) continue;
    if (invSet.has(invNum)) { skipped++; continue; }
    invSet.add(invNum);

    batch.push({
      tenant_id: tenantId,
      invoice_number: invNum,
      invoice_date: parseDate(dateIdx >= 0 ? row[dateIdx] : null),
      due_date: parseDate(dueDateIdx >= 0 ? row[dueDateIdx] : null),
      status: "pending",
      supplier_name: (partnerIdx >= 0 ? row[partnerIdx] : null)?.trim() || "Unknown",
      total: totalIdx >= 0 ? parseFloat(row[totalIdx]) || 0 : 0,
      subtotal: totalIdx >= 0 ? parseFloat(row[totalIdx]) || 0 : 0,
      tax_amount: 0,
      currency: "RSD",
      notes: "Imported from legacy system",
    });

    if (batch.length >= BATCH_SIZE) {
      batchNum++;
      const res = await flushBatch(supabase, "supplier_invoices", [...batch], "tenant_id,invoice_number", tag, batchNum);
      inserted += res.inserted;
      allErrors.push(...res.errors);
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    batchNum++;
    const res = await flushBatch(supabase, "supplier_invoices", batch, "tenant_id,invoice_number", tag, batchNum);
    inserted += res.inserted;
    allErrors.push(...res.errors);
  }

  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importOpportunities — added logging, kept already-fixed logic
// ──────────────────────────────────────────────────────────────────────────────
async function importOpportunities(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const tag = "importOpportunities";
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;
  console.log(`[${tag}] File: ${filename} → unipromTable: ${unipromTable}`);

  const { data: existing } = await supabase.from("opportunities").select("title").eq("tenant_id", tenantId);
  const nameSet = new Set((existing || []).map((r: any) => r.title?.toLowerCase()));

  let inserted = 0; let skipped = 0;
  const allErrors: { rowIndex: number; reason: string }[] = [];
  const batch: any[] = [];
  let batchNum = 0;

  const parseDate = (d: string | null) => {
    if (!d) return null;
    const p = new Date(d);
    return isNaN(p.getTime()) ? null : p.toISOString().split("T")[0];
  };

  if (unipromTable === "Project" || unipromTable === "Opportunity") {
    const cm = UNIPROM_COLUMN_MAP[unipromTable] || UNIPROM_COLUMN_MAP["Project"];
    const lines = reconstructLogicalRows(sanitized);
    console.log(`[${tag}] ${filename}: ${lines.length} rows`);

    for (let rowIdx = 0; rowIdx < lines.length; rowIdx++) {
      const cols = parseCSVLine(lines[rowIdx]);
      if (cols.length < 2) continue;
      const name = cols[cm.name]?.trim();
      if (!name) continue;
      if (nameSet.has(name.toLowerCase())) { skipped++; continue; }
      nameSet.add(name.toLowerCase());

      const endDateRaw = cm.end_date !== undefined ? cols[cm.end_date]?.trim() || null : null;
      batch.push({
        tenant_id: tenantId,
        title: name,
        stage: "prospecting",
        value: 0,
        currency: "RSD",
        probability: 10,
        expected_close_date: parseDate(endDateRaw),
        notes: `Imported from legacy ${unipromTable}`,
      });

      if (batch.length >= BATCH_SIZE) {
        batchNum++;
        const res = await flushBatch(supabase, "opportunities", [...batch], null, tag, batchNum);
        inserted += res.inserted;
        allErrors.push(...res.errors);
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      batchNum++;
      const res = await flushBatch(supabase, "opportunities", batch, null, tag, batchNum);
      inserted += res.inserted;
      allErrors.push(...res.errors);
    }
  } else {
    return { inserted: 0, skipped: 0, errors: ["No opportunity importer for this file format"] };
  }

  console.log(`[${tag}] TOTAL: ${inserted} inserted, ${skipped} skipped, ${allErrors.length} errors`);
  return { inserted, skipped, errors: allErrors.map(e => `Row ${e.rowIndex}: ${e.reason}`) };
}

// ──────────────────────────────────────────────────────────────────────────────
// importGeneric — skip with clear message
// ──────────────────────────────────────────────────────────────────────────────
async function importGeneric(_csvText: string, _tenantId: string, targetTable: string, _supabase: any) {
  const lines = _csvText.split("\n").filter((l) => l.trim().length > 0);
  console.log(`[importGeneric] No dedicated importer for "${targetTable}" — ${lines.length} rows skipped`);
  return {
    inserted: 0,
    skipped: lines.length,
    errors: [`Table "${targetTable}" does not have a dedicated importer — ${lines.length} rows skipped`],
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// IMPORT ORDER — dependency-sorted dispatcher (updated with quotes, document_lines)
// ──────────────────────────────────────────────────────────────────────────────
const IMPORT_ORDER = [
  "legal_entities", "currencies", "departments", "warehouses", "locations", "tax_rates",
  "chart_of_accounts", "products", "partners", "contacts", "employees",
  "employee_contracts", "inventory_stock",
  "invoices", "supplier_invoices", "purchase_orders", "sales_orders", "quotes",
  "document_lines", "invoice_lines", "purchase_order_lines", "quote_lines",
  "goods_receipts", "retail_prices", "bank_statements",
  "journal_entries", "payroll_runs", "leave_requests",
];

// ──────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER — same external API, now with City lookup and docHeaderMap
// ──────────────────────────────────────────────────────────────────────────────
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

    console.log(`[import-legacy-zip] START tenantId=${tenantId} sessionId=${sessionId} files=${confirmedMapping.length}`);

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
    console.log(`[import-legacy-zip] ZIP loaded. Files in archive: ${Object.keys(zip.files).length}`);

    // Build City lookup from dbo.City.csv if present
    const cityLookup = await buildCityLookup(zip);

    // DocHeader map for linking DocumentLine to parent documents
    const docHeaderMap = new Map<string, { uuid: string; table: string }>();

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
        console.warn(`[import-legacy-zip] File "${filename}" not found in ZIP`);
        results[filename] = { inserted: 0, skipped: 0, errors: [`File "${filename}" not found in ZIP`] };
        continue;
      }

      const csvText = await (zipFile as any).async("string");
      console.log(`[import-legacy-zip] Processing: ${filename} → ${targetTable} (${csvText.length} bytes)`);

      try {
        let result;
        switch (targetTable) {
          case "products":           result = await importProducts(csvText, tenantId, supabase, fullPath || filename); break;
          case "partners":           result = await importPartners(csvText, tenantId, supabase, fullPath || filename, cityLookup); break;
          case "contacts":           result = await importContacts(csvText, tenantId, supabase, fullPath || filename); break;
          case "warehouses":         result = await importWarehouses(csvText, tenantId, supabase, fullPath || filename); break;
          case "employees":          result = await importEmployees(csvText, tenantId, supabase, fullPath || filename); break;
          case "employee_contracts": result = await importEmployeeContracts(csvText, tenantId, supabase, fullPath || filename); break;
          case "chart_of_accounts":  result = await importChartOfAccounts(csvText, tenantId, supabase, fullPath || filename); break;
          case "inventory_stock":    result = await importInventoryStock(csvText, tenantId, supabase, fullPath || filename); break;
          case "supplier_invoices":  result = await importSupplierInvoices(csvText, tenantId, supabase, fullPath || filename); break;
          case "invoices":           result = await importInvoicesHeuristic(csvText, tenantId, supabase, fullPath || filename, docHeaderMap); break;
          case "purchase_orders":    result = await importInvoicesHeuristic(csvText, tenantId, supabase, fullPath || filename, docHeaderMap); break;
          case "quotes":             result = await importInvoicesHeuristic(csvText, tenantId, supabase, fullPath || filename, docHeaderMap); break;
          case "document_lines":     result = await importDocumentLines(csvText, tenantId, supabase, fullPath || filename); break;
          case "opportunities":      result = await importOpportunities(csvText, tenantId, supabase, fullPath || filename); break;
          case "departments":        result = await importDepartments(csvText, tenantId, supabase, fullPath || filename); break;
          case "currencies":         result = await importCurrencies(csvText, tenantId, supabase, fullPath || filename); break;
          case "tax_rates":          result = await importTaxRates(csvText, tenantId, supabase, fullPath || filename); break;
          case "legal_entities":     result = await importLegalEntities(csvText, tenantId, supabase, fullPath || filename); break;
          default:                   result = await importGeneric(csvText, tenantId, targetTable, supabase); break;
        }
        results[filename] = result;
        console.log(`[import-legacy-zip] DONE: ${filename} → inserted=${result.inserted} skipped=${result.skipped} errors=${result.errors?.length ?? 0}`);
      } catch (err: any) {
        console.error(`[import-legacy-zip] EXCEPTION processing ${filename}: ${err.message}`);
        results[filename] = { inserted: 0, skipped: 0, errors: [err.message] };
      }
    }

    if (sessionId) {
      await supabase.from("legacy_import_sessions")
        .update({ import_results: results, status: "done" })
        .eq("id", sessionId);
    }

    const totalInserted = Object.values(results).reduce((s: number, r: any) => s + (r.inserted || 0), 0);
    const totalErrors = Object.values(results).reduce((s: number, r: any) => s + (r.errors?.length || 0), 0);
    console.log(`[import-legacy-zip] ALL DONE: totalInserted=${totalInserted} totalErrors=${totalErrors}`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[import-legacy-zip] FATAL:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
