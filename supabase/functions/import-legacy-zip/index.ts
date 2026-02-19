import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore — JSZip via esm.sh works at runtime in Deno
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 500;

// ──────────────────────────────────────────────────────────────────────────────
// RFC 4180-aware CSV parsing with:
//   1. NUL byte removal (PostgreSQL chokes on \x00)
//   2. Logical row reconstruction for embedded CR/LF
//      (a line that doesn't start with a number+comma is a continuation)
// ──────────────────────────────────────────────────────────────────────────────
function sanitizeCSVText(raw: string): string {
  // Remove NUL bytes
  return raw.replace(/\x00/g, "");
}

function reconstructLogicalRows(text: string): string[] {
  const rawLines = text.split(/\r\n|\r|\n/);
  const logical: string[] = [];
  for (const line of rawLines) {
    if (line.length === 0) continue;
    // A new logical row starts with an integer ID followed by a delimiter
    // OR is the first row ever (empty logical array)
    const startsNewRow = /^\d+[,;|]/.test(line) || logical.length === 0;
    if (startsNewRow) {
      logical.push(line);
    } else {
      // Continuation of previous row — append with a space (replaces embedded CR/LF)
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
        // Escaped quote inside quoted field
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
// UNIPROM_COLUMN_MAP — exact column positions per CSV_to_ERP_AI_Mapping.docx
// Key = dbo.TableName (without dbo. prefix and .csv suffix)
// All files have NO HEADER ROW — first row is data.
// ──────────────────────────────────────────────────────────────────────────────
const UNIPROM_COLUMN_MAP: Record<string, Record<string, number>> = {
  // Partners: dbo.Partner.csv
  "Partner": { legacy_id: 0, name: 1, is_active: 17 },
  // Partner address enrichment: dbo.PartnerLocation.csv
  "PartnerLocation": { legacy_id: 0, full_name: 1, partner_code: 7, city: 9, address: 10, partner_legacy_id: 22 },
  // Contacts: dbo.PartnerContact.csv
  "PartnerContact": { legacy_id: 0, last_name: 1, first_name: 2, phone: 6, email: 10, partner_legacy_id: 12 },
  // Products: dbo.Item.csv
  "Item": { legacy_id: 0, name: 1, sku: 2, is_active: 33, product_type: 34 },
  // Unit of measure: dbo.ItemUnitOfMeasure.csv
  "ItemUnitOfMeasure": { legacy_id: 0, code: 1, name: 2 },
  // Employees: dbo.Employee.csv
  "Employee": { legacy_id: 0, first_name: 1, last_name: 2, jmbg: 4, department_legacy_id: 9, email: 6, phone: 7 },
  // Employee contracts: dbo.EmployeeContract.csv
  "EmployeeContract": { legacy_id: 0, employee_legacy_id: 1, start_date: 3, end_date: 4, gross_salary: 5, contract_type: 6 },
  // Employee overtime: dbo.EmployeeOvertime.csv
  "EmployeeOvertime": { legacy_id: 0, employee_legacy_id: 1, year: 2, month: 3, hours: 4 },
  // Departments: dbo.Department.csv
  "Department": { legacy_id: 0, name: 1, code: 3 },
  // Currencies: dbo.Currency.csv (internal ID-to-name)
  "Currency": { legacy_id: 0, name: 1, code: 2 },
  // Currency ISO: dbo.CurrencyISO.csv (authoritative ISO codes)
  "CurrencyISO": { legacy_id: 0, code: 1, name: 2, symbol: 3 },
  // Tax rates: dbo.Tax.csv (rate field is decimal 0.20 = 20%, multiply ×100)
  "Tax": { legacy_id: 0, name: 1, pdv_code: 2, rate: 3 },
  // Legal entities: dbo.Company.csv (1 row)
  "Company": { legacy_id: 0, name: 1, address: 3, pib: 6, maticni_broj: 7 },
  // Locations: dbo.CompanyOffice.csv (1 row)
  "CompanyOffice": { legacy_id: 0, name: 1, address: 3 },
  // Warehouses: dbo.Warehouse.csv
  "Warehouse": { legacy_id: 0, code: 1, name: 2 },
  // Documents
  "DocumentType": { legacy_id: 0, code: 1, name: 2 },
  "DocumentList": { legacy_id: 0, document_type_id: 1, code: 2, name: 3 },
  "DocumentHeader": { legacy_id: 0, document_list_id: 1, status_id: 2, doc_number: 3, date: 4, partner_id: 5, warehouse_id: 6, total: 7, currency_id: 8 },
  "DocumentLine": { legacy_id: 0, header_id: 1, item_id: 2, qty: 3, unit_price: 4, discount: 5, tax_id: 6 },
};

// Detect which Uniprom table name a filename maps to (strips dbo. prefix and .csv suffix)
function getUnipromTableName(filename: string): string | null {
  const basename = filename.split("/").pop() || filename;
  const m = basename.match(/^dbo\.(.+?)\.csv$/i);
  if (!m) return null;
  return UNIPROM_COLUMN_MAP[m[1]] ? m[1] : null;
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

async function importProducts(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;

  const lines = unipromTable === "Item"
    ? reconstructLogicalRows(sanitized)
    : sanitized.split("\n").filter((l) => l.trim().length > 0);

  const firstCols = parseCSVLine(lines[0] || "");
  const hasHeader = !unipromTable && firstCols.length > 0 && isNaN(Number(firstCols[0])) && firstCols[0].length > 0 && /[a-zA-Z]/.test(firstCols[0]);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const { data: existingSkus } = await supabase.from("products").select("sku").eq("tenant_id", tenantId);
  const skuSet = new Set((existingSkus || []).map((r: any) => r.sku));

  let inserted = 0; let updated = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    if (cols.length < 2) continue;

    let sku: string | null, name: string, unitOfMeasure: string, purchasePrice: number, salePrice: number, isActive: boolean;

    if (unipromTable === "Item") {
      const cm = UNIPROM_COLUMN_MAP["Item"];
      sku = cols[cm.sku]?.trim() || null;
      name = cols[cm.name]?.trim() || "";
      isActive = (cols[cm.is_active]?.trim() || "1") !== "0";
      unitOfMeasure = "kom";
      purchasePrice = 0;
      salePrice = 0;
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
      batch.push({ tenant_id: tenantId, sku, name, unit_of_measure: unitOfMeasure, is_active: isActive });
    }

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("products")
        .upsert(batch, { onConflict: sku ? "tenant_id,sku" : undefined, ignoreDuplicates: !sku });
      if (error) errors.push(error.message); else inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { error } = await supabase.from("products")
      .upsert(batch, { onConflict: "tenant_id,sku", ignoreDuplicates: true });
    if (error) errors.push(error.message); else inserted += batch.length;
  }

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
          if (stockBatch.length > 0) await supabase.from("inventory_stock").upsert(stockBatch, { onConflict: "product_id,warehouse_id" });
        }
      }
    } catch (_) { /* best-effort */ }
  }

  return { inserted, updated, skipped, errors };
}

// Build a legacy_id → partner.id map for later FK joins
async function buildPartnerLegacyMap(tenantId: string, supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from("partners").select("id, notes").eq("tenant_id", tenantId);
  const map: Record<string, string> = {};
  for (const p of data || []) {
    const m = (p.notes || "").match(/Legacy code:\s*(\S+)/);
    if (m) map[m[1]] = p.id;
  }
  return map;
}

async function importPartners(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;

  let dataLines: string[];
  let getCol: (cols: string[], field: string) => string | null;

  if (unipromTable === "Partner") {
    const cm = UNIPROM_COLUMN_MAP["Partner"];
    dataLines = reconstructLogicalRows(sanitized);
    getCol = (cols, field) => cols[cm[field] ?? -1]?.trim() || null;
  } else if (unipromTable === "PartnerLocation") {
    // PartnerLocation enriches existing partners with address data
    const cm = UNIPROM_COLUMN_MAP["PartnerLocation"];
    const lines = reconstructLogicalRows(sanitized);
    let enriched = 0;
    const legacyMap = await buildPartnerLegacyMap(tenantId, supabase);
    for (const line of lines) {
      const cols = parseCSVLine(line);
      const partnerLegacyId = cols[cm.partner_legacy_id]?.trim();
      if (!partnerLegacyId) continue;
      const partnerId = legacyMap[partnerLegacyId];
      if (!partnerId) continue;
      const city = cols[cm.city]?.trim() || null;
      const address = cols[cm.address]?.trim() || null;
      if (!city && !address) continue;
      const { error } = await supabase.from("partners")
        .update({ city: city || undefined, address: address || undefined })
        .eq("id", partnerId);
      if (!error) enriched++;
    }
    return { inserted: 0, updated: enriched, skipped: lines.length - enriched, errors: [] };
  } else {
    const firstCols = parseCSVLine(sanitized.split("\n")[0] || "");
    const hasHeader = firstCols.length > 0 && isNaN(Number(firstCols[0])) && !firstCols[0].startsWith("P0");
    const lines = sanitized.split("\n").filter((l) => l.trim().length > 0);
    dataLines = hasHeader ? lines.slice(1) : lines;
    // generic: [0]=partner_code [1]=name [2]=country [3]=city [4]=pib [5]=contact_person
    const cm: Record<string, number> = { legacy_id: 0, name: 1, country: 2, city: 3, pib: 4, contact_person: 5 };
    getCol = (cols, field) => cols[cm[field] ?? -1]?.trim() || null;
  }

  const { data: existingPartners } = await supabase.from("partners").select("pib, name").eq("tenant_id", tenantId);
  const pibSet = new Set((existingPartners || []).filter((r: any) => r.pib).map((r: any) => r.pib));
  const nameSet = new Set((existingPartners || []).map((r: any) => r.name?.toLowerCase()));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const line of dataLines!) {
    const cols = parseCSVLine(line);
    if (cols.length < 2) continue;

    const name = getCol!(cols, "name") || "";
    if (!name) continue;
    const pib = getCol!(cols, "pib");
    const legacyId = getCol!(cols, "legacy_id");

    // For Partner.csv: is_active col[17] — skip inactive (0)
    if (unipromTable === "Partner") {
      const isActive = cols[UNIPROM_COLUMN_MAP["Partner"].is_active]?.trim();
      if (isActive === "0") { skipped++; continue; }
    }

    if (pib && pibSet.has(pib)) { skipped++; continue; }
    if (!pib && nameSet.has(name.toLowerCase())) { skipped++; continue; }
    if (pib) pibSet.add(pib);
    nameSet.add(name.toLowerCase());

    const country = getCol!(cols, "country") || "Serbia";
    const city = getCol!(cols, "city");
    const contactPerson = getCol!(cols, "contact_person");
    const partnerCode = legacyId || getCol!(cols, "partner_code");

    batch.push({
      tenant_id: tenantId, name, city: city || null, country,
      pib: pib || null,
      contact_person: contactPerson || null,
      type: "customer", is_active: true,
      notes: partnerCode ? `Legacy code: ${partnerCode}` : null,
    });

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("partners").upsert(batch, { onConflict: "tenant_id,pib", ignoreDuplicates: true });
      if (error) errors.push(error.message); else inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { error } = await supabase.from("partners").upsert(batch, { onConflict: "tenant_id,pib", ignoreDuplicates: true });
    if (error) errors.push(error.message); else inserted += batch.length;
  }
  return { inserted, skipped, errors };
}

async function importContacts(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;

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

  const { data: existingContacts } = await supabase.from("contacts").select("email, first_name, last_name").eq("tenant_id", tenantId);
  const emailSet = new Set((existingContacts || []).filter((r: any) => r.email).map((r: any) => r.email?.toLowerCase()));
  const nameSet = new Set((existingContacts || []).map((r: any) => `${r.first_name}|${r.last_name}`.toLowerCase()));

  // Build partner legacy map for company_name enrichment
  const legacyMap = await buildPartnerLegacyMap(tenantId, supabase);
  const { data: partnerNames } = await supabase.from("partners").select("id, name").eq("tenant_id", tenantId);
  const partnerIdToName: Record<string, string> = {};
  for (const p of partnerNames || []) partnerIdToName[p.id] = p.name;

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  for (const line of dataLines) {
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

    // Resolve company_name from partner legacy map
    let companyName: string | null = null;
    if (legacyPartnerId) {
      const partnerId = legacyMap[legacyPartnerId];
      if (partnerId) companyName = partnerIdToName[partnerId] || null;
    }

    batch.push({
      tenant_id: tenantId,
      first_name: effectiveFirst, last_name: effectiveLast,
      email: email || null, phone: phone || null,
      city, country,
      function_area: role || null,
      company_name: companyName,
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

async function importWarehouses(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;

  const { data: existing } = await supabase.from("warehouses").select("name").eq("tenant_id", tenantId);
  const nameSet = new Set((existing || []).map((r: any) => r.name?.toLowerCase()));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  if (unipromTable === "Warehouse") {
    const cm = UNIPROM_COLUMN_MAP["Warehouse"];
    const lines = reconstructLogicalRows(sanitized);
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
    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      const { error } = await supabase.from("warehouses").upsert(batch.slice(i, i + BATCH_SIZE), { onConflict: "tenant_id,name", ignoreDuplicates: true });
      if (error) errors.push(error.message); else inserted += Math.min(BATCH_SIZE, batch.length - i);
    }
  }
  return { inserted, skipped, errors };
}

async function importChartOfAccounts(csvText: string, tenantId: string, supabase: any) {
  const { headers, rows } = parseCSV(csvText);
  const h = headers.map((x) => x.toLowerCase());

  const codeIdx = h.findIndex((x) => /sifra|code|konto.*br|br.*konta|^konto$/i.test(x));
  const nameIdx = h.findIndex((x) => /naziv|name|opis|description/i.test(x));
  const typeIdx = h.findIndex((x) => /tip|type|vrsta/i.test(x));

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
    else if (prefix === "9") accountType = "other";

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
      const { error } = await supabase.from("chart_of_accounts").upsert(batch, { onConflict: "tenant_id,code", ignoreDuplicates: true });
      if (error) errors.push(error.message); else inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { error } = await supabase.from("chart_of_accounts").upsert(batch, { onConflict: "tenant_id,code", ignoreDuplicates: true });
    if (error) errors.push(error.message); else inserted += batch.length;
  }
  return { inserted, skipped, errors };
}

async function importEmployees(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;

  const { data: existing } = await supabase.from("employees").select("email, first_name, last_name").eq("tenant_id", tenantId);
  const emailSet = new Set((existing || []).filter((r: any) => r.email).map((r: any) => r.email?.toLowerCase()));
  const nameSet  = new Set((existing || []).map((r: any) => `${r.first_name}|${r.last_name}`.toLowerCase()));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  if (unipromTable === "Employee") {
    const cm = UNIPROM_COLUMN_MAP["Employee"];
    const lines = reconstructLogicalRows(sanitized);
    for (const line of lines) {
      const cols = parseCSVLine(line);
      if (cols.length < 3) continue;
      const firstName = cols[cm.first_name]?.trim() || null;
      const lastName  = cols[cm.last_name]?.trim()  || null;
      const jmbg      = cols[cm.jmbg]?.trim()       || null;
      const deptLegacyId = cols[cm.department_legacy_id]?.trim() || null;
      const email     = cols[cm.email]?.trim() || null;
      const phone     = cols[cm.phone]?.trim() || null;
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
        email:      email || null,
        phone:      phone || null,
        status:     "active",
        notes:      [jmbg ? `JMBG: ${jmbg}` : null, deptLegacyId ? `Dept legacy ID: ${deptLegacyId}` : null].filter(Boolean).join(" | ") || null,
      });
    }
  } else {
    const { headers, rows } = parseCSV(csvText);
    const h = headers.map((x) => x.toLowerCase().replace(/[\s_]/g, ""));
    const firstNameIdx = h.findIndex((x) => /ime$|firstname|^ime/i.test(x));
    const lastNameIdx  = h.findIndex((x) => /prezime|lastname/i.test(x));
    const emailIdx     = h.findIndex((x) => /email|mail/i.test(x));
    const phoneIdx     = h.findIndex((x) => /tel|phone|mobil/i.test(x));
    const jmbgIdx      = h.findIndex((x) => /jmbg/i.test(x));
    const positionIdx  = h.findIndex((x) => /pozicija|radno.*mesto|position|job/i.test(x));
    const effFirst    = firstNameIdx >= 0 ? firstNameIdx : 2;
    const effLast     = lastNameIdx  >= 0 ? lastNameIdx  : 1;
    const effEmail    = emailIdx     >= 0 ? emailIdx     : 3;
    const effPhone    = phoneIdx     >= 0 ? phoneIdx     : 4;
    for (const row of rows) {
      const firstName = row[effFirst]?.trim() || null;
      const lastName  = row[effLast]?.trim()  || null;
      const email     = row[effEmail]?.trim() || null;
      const phone     = row[effPhone]?.trim() || null;
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
        first_name: firstName || "", last_name: lastName || "",
        email: email || null, phone: phone || null,
        position: position || null, status: "active",
        notes: jmbg ? `JMBG: ${jmbg}` : null,
      });
    }
  }

  if (batch.length > 0) {
    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      const { error } = await supabase.from("employees").insert(batch.slice(i, i + BATCH_SIZE));
      if (error) errors.push(error.message); else inserted += Math.min(BATCH_SIZE, batch.length - i);
    }
  }
  return { inserted, skipped, errors };
}

async function importInventoryStock(csvText: string, tenantId: string, supabase: any) {
  const { headers, rows } = parseCSV(csvText);
  const h = headers.map((x) => x.toLowerCase().replace(/[\s_]/g, ""));

  const skuIdx      = h.findIndex((x) => /sifra|sku|artik/i.test(x));
  const qtyIdx      = h.findIndex((x) => /kolicin|qty|zaliha|stanje|kolicina/i.test(x));
  const warehIdx    = h.findIndex((x) => /magacin|warehouse|skladiste/i.test(x));
  const costIdx     = h.findIndex((x) => /cena|price|cost|nabav/i.test(x));

  const { data: whs } = await supabase.from("warehouses").select("id, name").eq("tenant_id", tenantId).limit(5);
  const defaultWarehouseId = whs && whs.length > 0 ? whs[0].id : null;
  if (!defaultWarehouseId) {
    return { inserted: 0, skipped: rows.length, errors: ["No warehouses found for this tenant — import products & warehouses first"] };
  }

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

  const parseDate = (d: string | null) => {
    if (!d) return new Date().toISOString().split("T")[0];
    const p = new Date(d);
    return isNaN(p.getTime()) ? new Date().toISOString().split("T")[0] : p.toISOString().split("T")[0];
  };

  for (const row of rows) {
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
      const { error } = await supabase.from("supplier_invoices").upsert(batch, { onConflict: "tenant_id,invoice_number", ignoreDuplicates: true });
      if (error) errors.push(error.message); else inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { error } = await supabase.from("supplier_invoices").upsert(batch, { onConflict: "tenant_id,invoice_number", ignoreDuplicates: true });
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

  const parseDate = (d: string | null) => {
    if (!d) return new Date().toISOString().split("T")[0];
    const p = new Date(d);
    return isNaN(p.getTime()) ? new Date().toISOString().split("T")[0] : p.toISOString().split("T")[0];
  };

  for (const row of rows) {
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

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from("invoices").upsert(batch, { onConflict: "tenant_id,invoice_number", ignoreDuplicates: true });
      if (error) errors.push(error.message); else inserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const { error } = await supabase.from("invoices").upsert(batch, { onConflict: "tenant_id,invoice_number", ignoreDuplicates: true });
    if (error) errors.push(error.message); else inserted += batch.length;
  }
  return { inserted, skipped, errors };
}

async function importDepartments(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;

  const { data: existing } = await supabase.from("departments").select("name").eq("tenant_id", tenantId);
  const nameSet = new Set((existing || []).map((r: any) => r.name?.toLowerCase()));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  if (unipromTable === "Department") {
    const cm = UNIPROM_COLUMN_MAP["Department"];
    const lines = reconstructLogicalRows(sanitized);
    for (const line of lines) {
      const cols = parseCSVLine(line);
      if (cols.length < 2) continue;
      const name = cols[cm.name]?.trim();
      const code = cols[cm.code]?.trim();
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
    for (const row of rows) {
      const name = (nameIdx >= 0 ? row[nameIdx] : row[1] || row[0])?.trim();
      const code = (codeIdx >= 0 ? row[codeIdx] : row[0])?.trim();
      if (!name) continue;
      if (nameSet.has(name.toLowerCase())) { skipped++; continue; }
      nameSet.add(name.toLowerCase());
      batch.push({ tenant_id: tenantId, name, code: code || name.substring(0, 10).toUpperCase() });
    }
  }

  if (batch.length > 0) {
    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      const { error } = await supabase.from("departments").upsert(batch.slice(i, i + BATCH_SIZE), { onConflict: "tenant_id,name", ignoreDuplicates: true });
      if (error) errors.push(error.message); else inserted += Math.min(BATCH_SIZE, batch.length - i);
    }
  }
  return { inserted, skipped, errors };
}

async function importCurrencies(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;

  const { data: existing } = await supabase.from("currencies").select("code").eq("tenant_id", tenantId);
  const codeSet = new Set((existing || []).map((r: any) => r.code));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  if (unipromTable === "CurrencyISO") {
    // CurrencyISO.csv is authoritative — col[1]=code, col[2]=name, col[3]=symbol
    const cm = UNIPROM_COLUMN_MAP["CurrencyISO"];
    const lines = reconstructLogicalRows(sanitized);
    // Only import commonly used currencies to avoid importing all 250+
    const KNOWN_CURRENCIES = new Set(["RSD", "EUR", "USD", "CHF", "GBP", "HRK", "BAM"]);
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
    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      const { error } = await supabase.from("currencies").upsert(batch.slice(i, i + BATCH_SIZE), { onConflict: "tenant_id,code", ignoreDuplicates: true });
      if (error) errors.push(error.message); else inserted += Math.min(BATCH_SIZE, batch.length - i);
    }
  }
  return { inserted, skipped, errors };
}

async function importTaxRates(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;

  const { data: existing } = await supabase.from("tax_rates").select("name").eq("tenant_id", tenantId);
  const nameSet = new Set((existing || []).map((r: any) => r.name?.toLowerCase()));

  let inserted = 0; let skipped = 0; const errors: string[] = [];
  const batch: any[] = [];

  if (unipromTable === "Tax") {
    const cm = UNIPROM_COLUMN_MAP["Tax"];
    const lines = reconstructLogicalRows(sanitized);
    for (const line of lines) {
      const cols = parseCSVLine(line);
      if (cols.length < 4) continue;
      const name = cols[cm.name]?.trim();
      const rateRaw = parseFloat(cols[cm.rate]) || 0;
      // Convert decimal to percentage: 0.20 → 20
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
    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      const { error } = await supabase.from("tax_rates").upsert(batch.slice(i, i + BATCH_SIZE), { onConflict: "tenant_id,name", ignoreDuplicates: true });
      if (error) errors.push(error.message); else inserted += Math.min(BATCH_SIZE, batch.length - i);
    }
  }
  return { inserted, skipped, errors };
}

async function importLegalEntities(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;

  const { data: existing } = await supabase.from("legal_entities").select("name").eq("tenant_id", tenantId);
  const nameSet = new Set((existing || []).map((r: any) => r.name?.toLowerCase()));

  let inserted = 0; let skipped = 0; const errors: string[] = [];

  if (unipromTable === "Company") {
    const cm = UNIPROM_COLUMN_MAP["Company"];
    const lines = reconstructLogicalRows(sanitized);
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
      if (error) errors.push(error.message); else inserted++;
    }
  } else {
    return { inserted: 0, skipped: 0, errors: ["No dedicated importer for this legal entities file format"] };
  }

  return { inserted, skipped, errors };
}

async function importEmployeeContracts(csvText: string, tenantId: string, supabase: any, filename?: string) {
  const sanitized = sanitizeCSVText(csvText);
  const unipromTable = filename ? getUnipromTableName(filename) : null;

  // Build employee legacy_id → employee.id map
  const { data: employees } = await supabase.from("employees").select("id, notes").eq("tenant_id", tenantId);
  const empLegacyMap: Record<string, string> = {};
  for (const e of employees || []) {
    const m = (e.notes || "").match(/Dept legacy ID:\s*(\S+)/);
    // Store by notes pattern — we use legacy_id from notes
    const legacyMatch = (e.notes || "").match(/Legacy ID:\s*(\d+)/);
    if (legacyMatch) empLegacyMap[legacyMatch[1]] = e.id;
  }

  let inserted = 0; let skipped = 0; const errors: string[] = [];

  const parseDate = (d: string | null) => {
    if (!d) return null;
    const p = new Date(d);
    return isNaN(p.getTime()) ? null : p.toISOString().split("T")[0];
  };

  if (unipromTable === "EmployeeContract") {
    const cm = UNIPROM_COLUMN_MAP["EmployeeContract"];
    const lines = reconstructLogicalRows(sanitized);
    const batch: any[] = [];
    for (const line of lines) {
      const cols = parseCSVLine(line);
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
    }
    if (batch.length > 0) {
      for (let i = 0; i < batch.length; i += BATCH_SIZE) {
        const { error } = await supabase.from("employee_contracts").insert(batch.slice(i, i + BATCH_SIZE));
        if (error) errors.push(error.message); else inserted += Math.min(BATCH_SIZE, batch.length - i);
      }
    }
  } else {
    return { inserted: 0, skipped: 0, errors: ["EmployeeContract file not recognized — import Employee first"] };
  }

  return { inserted, skipped, errors };
}

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
  "legal_entities", "currencies", "departments", "warehouses", "locations", "tax_rates",
  "chart_of_accounts", "products", "partners", "contacts", "employees",
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
          case "products":            result = await importProducts(csvText, tenantId, supabase, fullPath || filename); break;
          case "partners":            result = await importPartners(csvText, tenantId, supabase, fullPath || filename); break;
          case "contacts":            result = await importContacts(csvText, tenantId, supabase, fullPath || filename); break;
          case "warehouses":          result = await importWarehouses(csvText, tenantId, supabase, fullPath || filename); break;
          case "employees":           result = await importEmployees(csvText, tenantId, supabase, fullPath || filename); break;
          case "employee_contracts":  result = await importEmployeeContracts(csvText, tenantId, supabase, fullPath || filename); break;
          case "chart_of_accounts":   result = await importChartOfAccounts(csvText, tenantId, supabase); break;
          case "inventory_stock":     result = await importInventoryStock(csvText, tenantId, supabase); break;
          case "supplier_invoices":   result = await importSupplierInvoices(csvText, tenantId, supabase); break;
          case "invoices":            result = await importInvoicesHeuristic(csvText, tenantId, supabase); break;
          case "departments":         result = await importDepartments(csvText, tenantId, supabase, fullPath || filename); break;
          case "currencies":          result = await importCurrencies(csvText, tenantId, supabase, fullPath || filename); break;
          case "tax_rates":           result = await importTaxRates(csvText, tenantId, supabase, fullPath || filename); break;
          case "legal_entities":      result = await importLegalEntities(csvText, tenantId, supabase, fullPath || filename); break;
          default:                    result = await importGeneric(csvText, tenantId, targetTable, supabase); break;
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
