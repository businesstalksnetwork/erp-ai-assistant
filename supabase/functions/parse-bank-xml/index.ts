import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedTransaction {
  line_date: string;
  value_date?: string;
  amount: number;
  direction: string;
  description?: string;
  partner_name?: string;
  partner_account?: string;
  counterparty_iban?: string;
  counterparty_bank?: string;
  payment_reference?: string;
  payment_purpose?: string;
  transaction_type?: string;
}

interface ParseResult {
  format: string;
  iban?: string;
  statement_number?: string;
  opening_balance?: number;
  closing_balance?: number;
  period_start?: string;
  period_end?: string;
  transactions: ParsedTransaction[];
}

// Simple XML tag extractor (no DOMParser in Deno edge)
function getTagContent(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function getAllTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const results: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) results.push(match[1].trim());
  return results;
}

function getAttr(xml: string, attr: string): string | null {
  const regex = new RegExp(`${attr}="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match ? match[1] : null;
}

// Detect format
function detectFormat(xml: string): string {
  if (xml.includes("camt.053.001")) return "CAMT053";
  if (xml.includes(":20:") && xml.includes(":60F:")) return "MT940";
  if (xml.includes("<DnevniIzvod") || xml.includes("<Izvod") || xml.includes("<NalogZaPrenos")) return "NBS_XML";
  if (xml.includes("<BkToCstmrStmt") || xml.includes("<Stmt>")) return "CAMT053";
  return "UNKNOWN";
}

// Parse camt.053
function parseCamt053(xml: string): ParseResult {
  const result: ParseResult = { format: "CAMT053", transactions: [] };

  result.iban = getTagContent(xml, "IBAN") || undefined;
  result.statement_number = getTagContent(xml, "ElctrncSeqNb") || getTagContent(xml, "LglSeqNb") || undefined;

  // Balances
  const balBlocks = getAllTags(xml, "Bal");
  for (const bal of balBlocks) {
    const tp = getTagContent(bal, "Cd");
    const amt = getTagContent(bal, "Amt");
    if (tp === "OPBD" && amt) result.opening_balance = parseFloat(amt);
    if (tp === "CLBD" && amt) result.closing_balance = parseFloat(amt);
  }

  // Period
  const frDt = getTagContent(xml, "FrDtTm") || getTagContent(xml, "FrDt");
  const toDt = getTagContent(xml, "ToDtTm") || getTagContent(xml, "ToDt");
  if (frDt) result.period_start = frDt.substring(0, 10);
  if (toDt) result.period_end = toDt.substring(0, 10);

  // Entries
  const entries = getAllTags(xml, "Ntry");
  for (const entry of entries) {
    const amt = getTagContent(entry, "Amt");
    const cdtDbt = getTagContent(entry, "CdtDbtInd");
    const bookgDt = getTagContent(entry, "BookgDt");
    const valDt = getTagContent(entry, "ValDt");
    const dt = getTagContent(bookgDt || "", "Dt") || getTagContent(bookgDt || "", "DtTm")?.substring(0, 10) || "";
    const vd = getTagContent(valDt || "", "Dt") || getTagContent(valDt || "", "DtTm")?.substring(0, 10) || undefined;

    const txDtls = getTagContent(entry, "NtryDtls");
    const rmtInf = getTagContent(txDtls || entry, "RmtInf");
    const ustrd = getTagContent(rmtInf || "", "Ustrd") || getTagContent(rmtInf || "", "Strd") || "";

    // Counterparty
    const rltdPties = getTagContent(txDtls || entry, "RltdPties");
    let cpName = "";
    let cpIban = "";
    if (cdtDbt === "DBIT") {
      const cdtr = getTagContent(rltdPties || "", "Cdtr");
      cpName = getTagContent(cdtr || "", "Nm") || "";
      const cdtrAcct = getTagContent(rltdPties || "", "CdtrAcct");
      cpIban = getTagContent(cdtrAcct || "", "IBAN") || "";
    } else {
      const dbtr = getTagContent(rltdPties || "", "Dbtr");
      cpName = getTagContent(dbtr || "", "Nm") || "";
      const dbtrAcct = getTagContent(rltdPties || "", "DbtrAcct");
      cpIban = getTagContent(dbtrAcct || "", "IBAN") || "";
    }

    // Transaction type
    const domn = getTagContent(txDtls || entry, "Domn");
    const prtry = getTagContent(txDtls || entry, "Prtry");
    let txType = "WIRE";
    const code = getTagContent(domn || "", "Cd") || getTagContent(prtry || "", "Cd") || "";
    if (code.includes("FEE") || code.includes("CHRG")) txType = "FEE";
    else if (code.includes("SALA") || code.includes("BONU")) txType = "SALARY";
    else if (code.includes("TAXS")) txType = "TAX";
    else if (code.includes("CARD") || code.includes("POSD")) txType = "CARD";
    else if (code.includes("DMCT") || code.includes("ESCT")) txType = "WIRE";

    const ref = getTagContent(txDtls || entry, "EndToEndId") ||
                getTagContent(txDtls || entry, "InstrId") || "";

    if (amt && dt) {
      result.transactions.push({
        line_date: dt,
        value_date: vd,
        amount: parseFloat(amt),
        direction: cdtDbt === "CRDT" ? "credit" : "debit",
        description: ustrd.substring(0, 500),
        partner_name: cpName || undefined,
        counterparty_iban: cpIban || undefined,
        payment_reference: ref || undefined,
        transaction_type: txType,
      });
    }
  }

  return result;
}

// Parse NBS XML (Serbian national format)
function parseNbsXml(xml: string): ParseResult {
  const result: ParseResult = { format: "NBS_XML", transactions: [] };

  result.statement_number = getTagContent(xml, "BrojIzvoda") || getTagContent(xml, "RedniBroj") || undefined;
  result.iban = getTagContent(xml, "BrojRacuna") || getTagContent(xml, "Racun") || undefined;
  result.opening_balance = parseFloat(getTagContent(xml, "PrethodnoStanje") || "0");
  result.closing_balance = parseFloat(getTagContent(xml, "NovoStanje") || "0");

  const items = getAllTags(xml, "Stavka").length > 0 ? getAllTags(xml, "Stavka") : getAllTags(xml, "Transakcija");
  for (const item of items) {
    const datum = getTagContent(item, "Datum") || getTagContent(item, "DatumValute") || "";
    const valDate = getTagContent(item, "DatumValute") || undefined;
    const iznos = getTagContent(item, "Iznos") || "0";
    const smer = getTagContent(item, "Smer") || getTagContent(item, "Tip") || "";
    const opis = getTagContent(item, "Opis") || getTagContent(item, "Svrha") || "";
    const nalogodavac = getTagContent(item, "Nalogodavac") || getTagContent(item, "Naziv") || "";
    const racun = getTagContent(item, "RacunNalogodavca") || getTagContent(item, "Racun") || "";
    const poziv = getTagContent(item, "PozivNaBroj") || "";

    const direction = smer.includes("2") || smer.toLowerCase().includes("rashod") || smer.toLowerCase().includes("out") ? "debit" : "credit";

    result.transactions.push({
      line_date: datum.substring(0, 10),
      value_date: valDate?.substring(0, 10),
      amount: Math.abs(parseFloat(iznos.replace(",", "."))),
      direction,
      description: opis || undefined,
      partner_name: nalogodavac || undefined,
      partner_account: racun || undefined,
      payment_reference: poziv || undefined,
      transaction_type: "WIRE",
    });
  }

  return result;
}

// Parse MT940 (SWIFT text format)
function parseMT940(text: string): ParseResult {
  const result: ParseResult = { format: "MT940", transactions: [] };

  // :25: Account
  const acctMatch = text.match(/:25:(.+)/);
  if (acctMatch) result.iban = acctMatch[1].trim();

  // :28C: Statement number
  const stmtMatch = text.match(/:28C:(.+)/);
  if (stmtMatch) result.statement_number = stmtMatch[1].trim();

  // :60F: Opening balance
  const openMatch = text.match(/:60F:([CD])(\d{6})([A-Z]{3})([\d,]+)/);
  if (openMatch) {
    result.opening_balance = parseFloat(openMatch[4].replace(",", "."));
    if (openMatch[1] === "D") result.opening_balance = -result.opening_balance;
  }

  // :62F: Closing balance
  const closeMatch = text.match(/:62F:([CD])(\d{6})([A-Z]{3})([\d,]+)/);
  if (closeMatch) {
    result.closing_balance = parseFloat(closeMatch[4].replace(",", "."));
    if (closeMatch[1] === "D") result.closing_balance = -result.closing_balance;
  }

  // :61: Transaction lines
  const txRegex = /:61:(\d{6})(\d{4})?([CD])([\d,]+)/g;
  let txMatch;
  const txPositions: number[] = [];
  while ((txMatch = txRegex.exec(text)) !== null) {
    const dateStr = txMatch[1];
    const year = parseInt("20" + dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4)) - 1;
    const day = parseInt(dateStr.substring(4, 6));
    const dt = new Date(year, month, day).toISOString().substring(0, 10);

    const amount = parseFloat(txMatch[4].replace(",", "."));
    const direction = txMatch[3] === "C" ? "credit" : "debit";

    result.transactions.push({
      line_date: dt,
      amount,
      direction,
      transaction_type: "WIRE",
    });
    txPositions.push(txMatch.index);
  }

  // :86: descriptions
  const descRegex = /:86:(.+?)(?=\n:|\n-\}|\n$)/gs;
  let descMatch;
  let descIdx = 0;
  while ((descMatch = descRegex.exec(text)) !== null && descIdx < result.transactions.length) {
    result.transactions[descIdx].description = descMatch[1].replace(/\n/g, " ").trim().substring(0, 500);
    descIdx++;
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { xml, importId, tenantId } = await req.json();
    if (!xml || !importId || !tenantId) {
      return new Response(JSON.stringify({ error: "Missing xml, importId, or tenantId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Update status to processing
    await supabase.from("document_imports").update({ status: "PROCESSING" }).eq("id", importId);

    const format = detectFormat(xml);
    let result: ParseResult;

    switch (format) {
      case "CAMT053": result = parseCamt053(xml); break;
      case "NBS_XML": result = parseNbsXml(xml); break;
      case "MT940": result = parseMT940(xml); break;
      default:
        await supabase.from("document_imports").update({ status: "QUARANTINE", error_message: `Unknown format` }).eq("id", importId);
        return new Response(JSON.stringify({ error: "Unknown XML format" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (result.transactions.length === 0) {
      await supabase.from("document_imports").update({ status: "QUARANTINE", error_message: "No transactions found" }).eq("id", importId);
      return new Response(JSON.stringify({ error: "No transactions found", format }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Auto-detect bank account from IBAN
    let bankAccountId: string | null = null;
    const { data: importRec } = await supabase.from("document_imports").select("bank_account_id").eq("id", importId).single();
    bankAccountId = importRec?.bank_account_id || null;

    if (!bankAccountId && result.iban) {
      const { data: accts } = await supabase.from("bank_accounts").select("id").eq("tenant_id", tenantId).eq("iban", result.iban).limit(1);
      if (accts?.length) bankAccountId = accts[0].id;
      // Try account_number match
      if (!bankAccountId) {
        const cleanIban = result.iban.replace(/\s/g, "");
        const acctNum = cleanIban.length > 4 ? cleanIban.substring(4) : cleanIban;
        const { data: accts2 } = await supabase.from("bank_accounts").select("id").eq("tenant_id", tenantId).eq("account_number", acctNum).limit(1);
        if (accts2?.length) bankAccountId = accts2[0].id;
      }
    }

    // Create bank statement if we have a bank account
    let statementId: string | null = null;
    if (bankAccountId) {
      const { data: stmt } = await supabase.from("bank_statements").insert({
        tenant_id: tenantId,
        bank_account_id: bankAccountId,
        statement_date: result.period_end || new Date().toISOString().substring(0, 10),
        statement_number: result.statement_number || null,
        opening_balance: result.opening_balance || 0,
        closing_balance: result.closing_balance || 0,
        currency: "RSD",
        status: "imported",
      }).select("id").single();
      statementId = stmt?.id || null;
    }

    // Insert statement lines
    if (statementId) {
      const lines = result.transactions.map(tx => ({
        tenant_id: tenantId,
        statement_id: statementId!,
        line_date: tx.line_date,
        value_date: tx.value_date || null,
        amount: tx.amount,
        direction: tx.direction,
        description: tx.description || null,
        partner_name: tx.partner_name || null,
        partner_account: tx.partner_account || null,
        counterparty_iban: tx.counterparty_iban || null,
        counterparty_bank: tx.counterparty_bank || null,
        payment_reference: tx.payment_reference || null,
        payment_purpose: tx.payment_purpose || null,
        transaction_type: tx.transaction_type || null,
        document_import_id: importId,
        match_status: "unmatched",
      }));

      const batchSize = 100;
      for (let i = 0; i < lines.length; i += batchSize) {
        await supabase.from("bank_statement_lines").insert(lines.slice(i, i + batchSize));
      }
    }

    // Update import record
    await supabase.from("document_imports").update({
      status: "PARSED",
      parser_used: format,
      transactions_count: result.transactions.length,
      bank_account_id: bankAccountId,
      processed_at: new Date().toISOString(),
    }).eq("id", importId);

    return new Response(JSON.stringify({
      format: result.format,
      transactions_count: result.transactions.length,
      iban: result.iban,
      statement_number: result.statement_number,
      bank_account_id: bankAccountId,
      statement_id: statementId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("parse-bank-xml error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
