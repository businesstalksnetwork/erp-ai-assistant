import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore — JSZip via esm.sh works at runtime in Deno
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ──────────────────────────────────────────────────────────────────────────────
// Mapping registry: legacy CSV filename patterns → system table
// Order matters: exact matches first, then high-confidence, then medium
// ──────────────────────────────────────────────────────────────────────────────
interface MappingRule {
  pattern: RegExp;
  target: string;
  confidence: "exact" | "high" | "medium";
  dedupField: string;
}

const MAPPING_RULES: MappingRule[] = [
  // EXACT — known files from Uniprom export
  { pattern: /^dbo\.A_UnosPodataka\.csv$/i, target: "products", confidence: "exact", dedupField: "sku" },
  { pattern: /^dbo\.A_UnosPodataka_Partner\.csv$/i, target: "partners", confidence: "exact", dedupField: "pib" },
  { pattern: /^dbo\.A_aPodaci\.csv$/i, target: "contacts", confidence: "exact", dedupField: "email" },

  // HIGH — common legacy table name patterns
  { pattern: /faktur/i, target: "invoices", confidence: "high", dedupField: "invoice_number" },
  { pattern: /invoice/i, target: "invoices", confidence: "high", dedupField: "invoice_number" },
  { pattern: /racun/i, target: "invoices", confidence: "high", dedupField: "invoice_number" },
  { pattern: /employee|zaposleni|radnik/i, target: "employees", confidence: "high", dedupField: "email" },
  { pattern: /warehouse|magacin|skladi/i, target: "warehouses", confidence: "high", dedupField: "name" },
  { pattern: /chart.*account|konto|kontni/i, target: "chart_of_accounts", confidence: "high", dedupField: "code" },
  { pattern: /account.*chart/i, target: "chart_of_accounts", confidence: "high", dedupField: "code" },
  { pattern: /supplier.*invoice|ulazn.*faktur/i, target: "supplier_invoices", confidence: "high", dedupField: "invoice_number" },
  { pattern: /purchase.*order|narudzbenic/i, target: "purchase_orders", confidence: "high", dedupField: "order_number" },
  { pattern: /sales.*order|prodajn.*narudz/i, target: "sales_orders", confidence: "high", dedupField: "order_number" },

  // MEDIUM — generic patterns
  { pattern: /product|artikal|roba/i, target: "products", confidence: "medium", dedupField: "sku" },
  { pattern: /partner|customer|kupac|dobavljac/i, target: "partners", confidence: "medium", dedupField: "pib" },
  { pattern: /contact|kontakt/i, target: "contacts", confidence: "medium", dedupField: "email" },
  { pattern: /order/i, target: "sales_orders", confidence: "medium", dedupField: "order_number" },
  { pattern: /journal|nalog|knjizenje/i, target: "journal_entries", confidence: "medium", dedupField: "entry_number" },
  { pattern: /payroll|plata|obracun/i, target: "payroll_runs", confidence: "medium", dedupField: "id" },
  { pattern: /tax|pdv|porez/i, target: "tax_rates", confidence: "medium", dedupField: "name" },
];

function classifyFile(filename: string, headers: string[]): { target: string | null; confidence: "exact" | "high" | "medium" | "none"; dedupField: string } {
  const basename = filename.split("/").pop() || filename;

  // Try filename pattern matching first
  for (const rule of MAPPING_RULES) {
    if (rule.pattern.test(basename)) {
      return { target: rule.target, confidence: rule.confidence, dedupField: rule.dedupField };
    }
  }

  // Fallback: try to match on column headers
  const headerStr = headers.join(",").toLowerCase();
  if (headerStr.includes("pib") || headerStr.includes("vat") || headerStr.includes("tax_id")) {
    return { target: "partners", confidence: "medium", dedupField: "pib" };
  }
  if (headerStr.includes("sku") || headerStr.includes("barcode") || headerStr.includes("artikal")) {
    return { target: "products", confidence: "medium", dedupField: "sku" };
  }
  if (headerStr.includes("email") && (headerStr.includes("first") || headerStr.includes("ime"))) {
    return { target: "contacts", confidence: "medium", dedupField: "email" };
  }
  if (headerStr.includes("invoice_number") || headerStr.includes("broj_fakture")) {
    return { target: "invoices", confidence: "medium", dedupField: "invoice_number" };
  }

  return { target: null, confidence: "none", dedupField: "" };
}

function parseCSVHeaders(csvSample: string): { headers: string[]; sampleRows: string[][] } {
  const lines = csvSample.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], sampleRows: [] };

  // Try to detect if first row is a header (has non-numeric values)
  const firstCols = parseCSVLine(lines[0]);
  const looksLikeHeader = firstCols.some((c) => isNaN(Number(c)) && c.length > 0 && c.length < 60);

  let headers: string[] = [];
  let dataLines: string[] = [];

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

    // Process each CSV file in the ZIP
    const csvEntries = Object.entries(zip.files).filter(
      ([name, file]) => !file.dir && name.toLowerCase().endsWith(".csv")
    );

    for (const [filename, zipFile] of csvEntries) {
      try {
        // Read first 4000 chars for header + sample rows
        const fullContent = await zipFile.async("string");
        const sample = fullContent.slice(0, 4000);

        // Count total lines for row estimate (subtract 1 for header)
        const totalLines = (fullContent.match(/\n/g) || []).length;
        const isEmpty = totalLines <= 1;

        const { headers, sampleRows } = parseCSVHeaders(sample);
        const { target, confidence, dedupField } = classifyFile(filename, headers);

        fileResults.push({
          filename: filename.split("/").pop() || filename,
          fullPath: filename,
          rowCount: Math.max(0, totalLines - 1),
          headers,
          sampleRows,
          suggestedTarget: target,
          confidence,
          dedupField,
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
          isEmpty: true,
          parseError: fileErr.message,
        });
      }
    }

    // Sort: exact → high → medium → none
    const confidenceOrder = { exact: 0, high: 1, medium: 2, none: 3 };
    fileResults.sort((a, b) => {
      const ao = confidenceOrder[a.confidence as keyof typeof confidenceOrder] ?? 3;
      const bo = confidenceOrder[b.confidence as keyof typeof confidenceOrder] ?? 3;
      return ao - bo;
    });

    // Persist analysis to session if sessionId provided
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
