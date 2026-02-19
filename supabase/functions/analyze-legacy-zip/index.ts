import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore — JSZip via esm.sh works at runtime in Deno
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MappingRule {
  pattern: RegExp;
  target: string;
  confidence: "exact" | "high" | "medium";
  dedupField: string;
  label: string; // human-readable reason
}

// ──────────────────────────────────────────────────────────────────────────────
// 50+ mapping rules for Serbian ERP exports (MS SQL Server dbo.* table dumps)
// Order: exact → high confidence → medium confidence
// ──────────────────────────────────────────────────────────────────────────────
const MAPPING_RULES: MappingRule[] = [
  // ── EXACT — known Uniprom export files ─────────────────────────────────────
  { pattern: /^dbo\.A_UnosPodataka\.csv$/i, target: "products", confidence: "exact", dedupField: "sku", label: "Exact match: Uniprom products table" },
  { pattern: /^dbo\.A_UnosPodataka_Partner\.csv$/i, target: "partners", confidence: "exact", dedupField: "pib", label: "Exact match: Uniprom partners table" },
  { pattern: /^dbo\.A_aPodaci\.csv$/i, target: "contacts", confidence: "exact", dedupField: "email", label: "Exact match: Uniprom contacts table" },

  // ── HIGH — Supplier invoices (must come before generic invoice/faktura) ─────
  { pattern: /ulazn[ae]?.*faktur|faktur.*ulaz|supplier.*inv|ulazni.*racun/i, target: "supplier_invoices", confidence: "high", dedupField: "invoice_number", label: "Filename contains supplier invoice pattern" },
  { pattern: /nabavn.*faktur|vendor.*inv|dobavljac.*faktur/i, target: "supplier_invoices", confidence: "high", dedupField: "invoice_number", label: "Filename contains vendor/purchase invoice pattern" },

  // ── HIGH — Purchase orders ──────────────────────────────────────────────────
  { pattern: /narudzbenica|narudžbenica|purchase.?order|narudzb.*dobavljac|po_order/i, target: "purchase_orders", confidence: "high", dedupField: "order_number", label: "Filename contains purchase order pattern" },

  // ── HIGH — Sales orders ─────────────────────────────────────────────────────
  { pattern: /prodajni.*nalog|sales.?order|izlazni.*nalog/i, target: "sales_orders", confidence: "high", dedupField: "order_number", label: "Filename contains sales order pattern" },

  // ── HIGH — Invoices (outgoing) ──────────────────────────────────────────────
  { pattern: /faktur|invoice|racun/i, target: "invoices", confidence: "high", dedupField: "invoice_number", label: "Filename contains invoice/faktura pattern" },

  // ── HIGH — Employees ────────────────────────────────────────────────────────
  { pattern: /zaposleni|employee|radnik|osoblje/i, target: "employees", confidence: "high", dedupField: "email", label: "Filename contains employee pattern" },

  // ── HIGH — Warehouses ───────────────────────────────────────────────────────
  { pattern: /magacin|warehouse|skladiste|skladište/i, target: "warehouses", confidence: "high", dedupField: "name", label: "Filename contains warehouse pattern" },

  // ── HIGH — Chart of accounts ────────────────────────────────────────────────
  { pattern: /kontni.*plan|konto.*plan|chart.*account|account.*chart|kontni/i, target: "chart_of_accounts", confidence: "high", dedupField: "code", label: "Filename contains chart of accounts pattern" },

  // ── HIGH — Bank statements ───────────────────────────────────────────────────
  { pattern: /izvod.*banke|bank.*statement|izvod.*banke|bank.*izvod|izvod$/i, target: "bank_statements", confidence: "high", dedupField: "statement_number", label: "Filename contains bank statement pattern" },

  // ── HIGH — Goods receipts ────────────────────────────────────────────────────
  { pattern: /primka|goods.*receipt|prijem.*robe|ulaz.*robe|dokument.*prijema/i, target: "goods_receipts", confidence: "high", dedupField: "receipt_number", label: "Filename contains goods receipt pattern" },

  // ── HIGH — Journal entries ───────────────────────────────────────────────────
  { pattern: /nalog.*knjizenja|journal.*entr|knjizenje|temeljnica/i, target: "journal_entries", confidence: "high", dedupField: "entry_number", label: "Filename contains journal entry pattern" },

  // ── HIGH — Payments ─────────────────────────────────────────────────────────
  { pattern: /placanje|plaćanje|payment|uplata|isplata/i, target: "payments", confidence: "high", dedupField: "id", label: "Filename contains payment pattern" },

  // ── HIGH — Sales/retail prices ───────────────────────────────────────────────
  { pattern: /cenovnik.*maloprodaj|retail.*price|maloprodajn.*cen|nivelacija/i, target: "retail_prices", confidence: "high", dedupField: "id", label: "Filename contains retail price/nivelacija pattern" },

  // ── HIGH — Kalkulacija ───────────────────────────────────────────────────────
  { pattern: /kalkulacij[ae]/i, target: "products", confidence: "high", dedupField: "sku", label: "Filename contains kalkulacija pattern" },

  // ── HIGH — Partners (explicit buyer/seller variants) ─────────────────────────
  { pattern: /kupac|dobavljac|dobavljač|poslovni.*partner/i, target: "partners", confidence: "high", dedupField: "pib", label: "Filename contains partner (kupac/dobavljac) pattern" },

  // ── MEDIUM — Products ────────────────────────────────────────────────────────
  { pattern: /artikal|proizvod|product|roba/i, target: "products", confidence: "medium", dedupField: "sku", label: "Filename contains product/artikal pattern" },

  // ── MEDIUM — Partners (generic) ──────────────────────────────────────────────
  { pattern: /partner|customer|client|klijent/i, target: "partners", confidence: "medium", dedupField: "pib", label: "Filename contains partner/customer pattern" },

  // ── MEDIUM — Contacts ────────────────────────────────────────────────────────
  { pattern: /contact|kontakt/i, target: "contacts", confidence: "medium", dedupField: "email", label: "Filename contains contact/kontakt pattern" },

  // ── MEDIUM — Orders (generic) ────────────────────────────────────────────────
  { pattern: /nalog|order/i, target: "sales_orders", confidence: "medium", dedupField: "order_number", label: "Filename contains nalog/order pattern" },

  // ── MEDIUM — Payroll ─────────────────────────────────────────────────────────
  { pattern: /plata|platni.*spisak|payroll|obracun.*plat|obračun/i, target: "payroll_runs", confidence: "medium", dedupField: "id", label: "Filename contains payroll/plata pattern" },

  // ── MEDIUM — Contracts ───────────────────────────────────────────────────────
  { pattern: /ugovor|contract/i, target: "employee_contracts", confidence: "medium", dedupField: "id", label: "Filename contains contract/ugovor pattern" },

  // ── MEDIUM — Tax / VAT ────────────────────────────────────────────────────────
  { pattern: /pdv|porez|tax.*rate|vat/i, target: "tax_rates", confidence: "medium", dedupField: "name", label: "Filename contains PDV/tax pattern" },

  // ── MEDIUM — Locations ───────────────────────────────────────────────────────
  { pattern: /lokacija|location/i, target: "locations", confidence: "medium", dedupField: "name", label: "Filename contains location/lokacija pattern" },

  // ── MEDIUM — Fixed assets ─────────────────────────────────────────────────────
  { pattern: /osnovna.*sredstv|fixed.*asset|osnov.*sred/i, target: "fixed_assets", confidence: "medium", dedupField: "id", label: "Filename contains fixed assets pattern" },

  // ── MEDIUM — Cost centers ─────────────────────────────────────────────────────
  { pattern: /troskov.*centar|cost.*center|mjest.*trosk/i, target: "cost_centers", confidence: "medium", dedupField: "code", label: "Filename contains cost center pattern" },

  // ── MEDIUM — Departments ──────────────────────────────────────────────────────
  { pattern: /odeljenje|odjel|department/i, target: "departments", confidence: "medium", dedupField: "name", label: "Filename contains department/odeljenje pattern" },

  // ── MEDIUM — Currencies ────────────────────────────────────────────────────────
  { pattern: /valut[ae]|currency|deviz/i, target: "currencies", confidence: "medium", dedupField: "code", label: "Filename contains currency/valuta pattern" },

  // ── MEDIUM — Leave/absence ─────────────────────────────────────────────────────
  { pattern: /odsustvo|bolovanje|godisnji|godišnji|leave|absence/i, target: "leave_requests", confidence: "medium", dedupField: "id", label: "Filename contains leave/absence pattern" },

  // ── MEDIUM — Inventory movements ───────────────────────────────────────────────
  { pattern: /promet.*robi|inventory.*mov|lagern.*kret|kretanje.*lagera/i, target: "inventory_movements", confidence: "medium", dedupField: "id", label: "Filename contains inventory movement pattern" },

  // ── MEDIUM — Web/online prices ─────────────────────────────────────────────────
  { pattern: /web.*cen|online.*price|e.?shop.*price/i, target: "web_prices", confidence: "medium", dedupField: "id", label: "Filename contains web price pattern" },

  // ── MEDIUM — Leads (CRM) ───────────────────────────────────────────────────────
  { pattern: /lead|potencijalni.*kupac/i, target: "leads", confidence: "medium", dedupField: "id", label: "Filename contains lead/CRM pattern" },
];

// ──────────────────────────────────────────────────────────────────────────────
// Header-based fallback classification — comprehensive for Serbian ERP exports
// ──────────────────────────────────────────────────────────────────────────────
function classifyByHeaders(headers: string[]): { target: string | null; dedupField: string; label: string } {
  const h = headers.map((x) => x.toLowerCase().replace(/[_\s-]+/g, ""));

  const has = (...terms: string[]) => terms.some((t) => h.some((col) => col.includes(t)));

  // Employees — JMBG is a dead giveaway
  if (has("jmbg", "licnakarta", "maticanbroj")) {
    return { target: "employees", dedupField: "email", label: "Header 'JMBG' detected → employees" };
  }

  // Contacts — email + name
  if (has("email") && (has("ime", "prezime", "firstname", "lastname"))) {
    return { target: "contacts", dedupField: "email", label: "Header 'email' + name field detected → contacts" };
  }

  // Partners — PIB or MB is definitive
  if (has("pib", "mb", "maticanbroj", "taxid", "vatin")) {
    return { target: "partners", dedupField: "pib", label: "Header 'pib/mb' detected → partners" };
  }

  // Supplier invoices
  if (has("ulaznibroj", "suppliernumber", "dobavljacfaktura", "ulazniracun")) {
    return { target: "supplier_invoices", dedupField: "invoice_number", label: "Header supplier invoice field detected" };
  }

  // Invoices
  if (has("brojfakture", "invoicenumber", "fakturabr", "racunbr")) {
    return { target: "invoices", dedupField: "invoice_number", label: "Header 'broj fakture' detected → invoices" };
  }

  // Purchase orders
  if (has("narudzbenica", "purchaseorder", "narudzbenicabroj")) {
    return { target: "purchase_orders", dedupField: "order_number", label: "Header 'narudzbenica' detected → purchase_orders" };
  }

  // Products — SKU, barcode, or article code
  if (has("sku", "sifraartikla", "sifra", "barcode", "artiklsifra", "sifraarticle")) {
    return { target: "products", dedupField: "sku", label: "Header 'sku/sifra artikla' detected → products" };
  }

  // Chart of accounts
  if (has("konto", "accountcode", "sifrakonta", "kontobr")) {
    return { target: "chart_of_accounts", dedupField: "code", label: "Header 'konto' detected → chart_of_accounts" };
  }

  // Payroll
  if (has("brutoplatа", "netoплата", "netoplata", "brutoplata", "payroll", "obracunplace")) {
    return { target: "payroll_runs", dedupField: "id", label: "Header payroll/plata detected → payroll_runs" };
  }

  // Bank statement
  if (has("izvodbr", "statementno", "bankstatement", "izvodbanke")) {
    return { target: "bank_statements", dedupField: "statement_number", label: "Header bank statement field detected" };
  }

  // Journal entries
  if (has("nalogknjizenja", "journalentry", "duguje", "potrazuje")) {
    return { target: "journal_entries", dedupField: "entry_number", label: "Header 'duguje/potrazuje' detected → journal_entries" };
  }

  // Cost centers
  if (has("centartroska", "costcenter", "mjestotroska")) {
    return { target: "cost_centers", dedupField: "code", label: "Header cost center detected" };
  }

  // Fallback — contact by email alone
  if (has("email")) {
    return { target: "contacts", dedupField: "email", label: "Header 'email' detected → contacts (fallback)" };
  }

  return { target: null, dedupField: "", label: "" };
}

function classifyFile(filename: string, headers: string[]): {
  target: string | null;
  confidence: "exact" | "high" | "medium" | "none";
  dedupField: string;
  humanLabel: string;
} {
  const basename = filename.split("/").pop() || filename;

  // 1. Try filename pattern matching
  for (const rule of MAPPING_RULES) {
    if (rule.pattern.test(basename)) {
      return {
        target: rule.target,
        confidence: rule.confidence,
        dedupField: rule.dedupField,
        humanLabel: rule.label,
      };
    }
  }

  // 2. Header-based fallback
  const headerMatch = classifyByHeaders(headers);
  if (headerMatch.target) {
    return {
      target: headerMatch.target,
      confidence: "medium",
      dedupField: headerMatch.dedupField,
      humanLabel: headerMatch.label,
    };
  }

  return { target: null, confidence: "none", dedupField: "", humanLabel: "No matching pattern or header signal found" };
}

function parseCSVHeaders(csvSample: string): { headers: string[]; sampleRows: string[][] } {
  const lines = csvSample.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], sampleRows: [] };

  const firstCols = parseCSVLine(lines[0]);
  const looksLikeHeader = firstCols.some((c) => isNaN(Number(c)) && c.length > 0 && c.length < 60);

  let headers: string[];
  let dataLines: string[];

  if (looksLikeHeader) {
    headers = firstCols;
    dataLines = lines.slice(1, 4);
  } else {
    headers = firstCols.map((_, i) => `col_${i + 1}`);
    dataLines = lines.slice(0, 3);
  }

  const sampleRows = dataLines.map((l) => parseCSVLine(l));
  return { headers, sampleRows };
}

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { storagePath, sessionId } = body;

    if (!storagePath) {
      return new Response(JSON.stringify({ error: "storagePath is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download ZIP from storage
    const { data: zipBlob, error: dlError } = await supabase.storage
      .from("legacy-imports")
      .download(storagePath);

    if (dlError || !zipBlob) {
      throw new Error(`Storage download error: ${dlError?.message || "No data"}`);
    }

    const zipBuffer = await zipBlob.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);

    const fileResults: any[] = [];

    const csvEntries = Object.entries(zip.files).filter(
      ([name, file]) => !file.dir && name.toLowerCase().endsWith(".csv")
    );

    for (const [filename, zipFile] of csvEntries) {
      try {
        const fullContent = await zipFile.async("string");
        const sample = fullContent.slice(0, 4000);

        // Count non-empty lines
        const allLines = fullContent.split("\n").filter((l) => l.trim().length > 0);
        const totalLines = allLines.length;
        // A file is empty if it has 0 or 1 lines (header only, no data rows)
        const isEmpty = totalLines <= 1;

        const { headers, sampleRows } = parseCSVHeaders(sample);
        const { target, confidence, dedupField, humanLabel } = classifyFile(filename, headers);

        fileResults.push({
          filename: filename.split("/").pop() || filename,
          fullPath: filename,
          rowCount: Math.max(0, totalLines - 1),
          headers,
          sampleRows,
          suggestedTarget: target,
          confidence,
          dedupField,
          humanLabel,
          isEmpty,
        });
      } catch (fileErr: any) {
        fileResults.push({
          filename: filename.split("/").pop() || filename,
          fullPath: filename,
          rowCount: 0,
          headers: [],
          sampleRows: [],
          suggestedTarget: null,
          confidence: "none",
          dedupField: "",
          humanLabel: `Parse error: ${fileErr.message}`,
          isEmpty: true,
          parseError: fileErr.message,
        });
      }
    }

    // Sort: exact → high → medium → none; within same confidence, non-empty first
    const confidenceOrder = { exact: 0, high: 1, medium: 2, none: 3 };
    fileResults.sort((a, b) => {
      const ao = confidenceOrder[a.confidence as keyof typeof confidenceOrder] ?? 3;
      const bo = confidenceOrder[b.confidence as keyof typeof confidenceOrder] ?? 3;
      if (ao !== bo) return ao - bo;
      // Empty files sink to the bottom
      if (a.isEmpty !== b.isEmpty) return a.isEmpty ? 1 : -1;
      return b.rowCount - a.rowCount;
    });

    if (sessionId) {
      await supabase
        .from("legacy_import_sessions")
        .update({ analysis: fileResults, status: "analyzed" })
        .eq("id", sessionId);
    }

    return new Response(
      JSON.stringify({ success: true, files: fileResults, totalCsvFiles: csvEntries.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("analyze-legacy-zip error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
