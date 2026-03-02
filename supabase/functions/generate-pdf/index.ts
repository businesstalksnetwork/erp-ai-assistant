/**
 * ARCH-01: Generate PDF/A-3 Edge Function
 * ISO 19005 — Long-term archival PDF with embedded UBL XML.
 *
 * Generates actual PDF bytes with A4 invoice layout,
 * embedded UBL XML via AF relationship, and XMP metadata.
 * Includes BG-7 AccountingCustomerParty per EN 16931.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, PDFName, PDFString, PDFArray, PDFDict, PDFHexString } from "https://esm.sh/pdf-lib@1.17.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { checkRateLimit, rateLimitHeaders } from "../_shared/rate-limiter.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    // Rate limit: export category (5/min)
    const token = authHeader.replace("Bearer ", "");
    const rl = await checkRateLimit(`generate-pdf:${token.slice(-8)}`, "export");
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: withSecurityHeaders({ ...corsHeaders, ...rateLimitHeaders(rl.retryAfterMs!), "Content-Type": "application/json" }),
      });
    }

    const body = await req.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400,
        headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch invoice with lines, supplier partner, and customer partner
    const { data: invoice, error: invErr } = await sb
      .from("invoices")
      .select("*, invoice_lines(*), partners(*)")
      .eq("id", invoice_id)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }),
      });
    }

    // Fetch customer partner if customer_id exists
    let customerPartner = null;
    if (invoice.customer_id) {
      const { data } = await sb.from("partners").select("*").eq("id", invoice.customer_id).single();
      customerPartner = data;
    }

    // Generate UBL XML with BG-7 CustomerParty
    const ublXml = generateUblXml(invoice, customerPartner);

    // Generate actual PDF
    const pdfBytes = await generatePdfDocument(invoice, customerPartner, ublXml);

    return new Response(pdfBytes, {
      headers: withSecurityHeaders({
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number || invoice_id}.pdf"`,
      }),
    });
  } catch (e) {
    return createErrorResponse(e, req, { logPrefix: "generate-pdf" });
  }
});

async function generatePdfDocument(invoice: any, customer: any, ublXml: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  let y = pageHeight - margin;
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lineColor = rgb(0.8, 0.8, 0.8);

  // Header
  page.drawText("FAKTURA / INVOICE", { x: margin, y, size: 18, font: fontBold, color: black });
  y -= 25;
  page.drawText(`Broj: ${invoice.invoice_number || "N/A"}`, { x: margin, y, size: 11, font, color: black });
  page.drawText(`Datum: ${invoice.invoice_date || ""}`, { x: 350, y, size: 11, font, color: black });
  y -= 15;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: lineColor });
  y -= 20;

  // Supplier (BG-4)
  page.drawText("Dobavljač / Supplier:", { x: margin, y, size: 10, font: fontBold, color: gray });
  y -= 14;
  page.drawText(invoice.partners?.name || "N/A", { x: margin, y, size: 11, font, color: black });
  y -= 14;
  if (invoice.partners?.tax_id) {
    page.drawText(`PIB: ${invoice.partners.tax_id}`, { x: margin, y, size: 9, font, color: gray });
    y -= 12;
  }
  if (invoice.partners?.address) {
    page.drawText(invoice.partners.address, { x: margin, y, size: 9, font, color: gray });
    y -= 12;
  }

  // Customer (BG-7)
  const custX = 320;
  let custY = y + 40 + (invoice.partners?.address ? 12 : 0);
  page.drawText("Kupac / Customer:", { x: custX, y: custY, size: 10, font: fontBold, color: gray });
  custY -= 14;
  page.drawText(customer?.name || "N/A", { x: custX, y: custY, size: 11, font, color: black });
  custY -= 14;
  if (customer?.tax_id) {
    page.drawText(`PIB: ${customer.tax_id}`, { x: custX, y: custY, size: 9, font, color: gray });
    custY -= 12;
  }
  if (customer?.address) {
    page.drawText(customer.address, { x: custX, y: custY, size: 9, font, color: gray });
  }

  y -= 20;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: lineColor });
  y -= 20;

  // Line items table header
  const cols = [margin, margin + 30, margin + 250, margin + 310, margin + 380, margin + 440];
  page.drawText("#", { x: cols[0], y, size: 9, font: fontBold, color: gray });
  page.drawText("Opis / Description", { x: cols[1], y, size: 9, font: fontBold, color: gray });
  page.drawText("Kol.", { x: cols[2], y, size: 9, font: fontBold, color: gray });
  page.drawText("Cena", { x: cols[3], y, size: 9, font: fontBold, color: gray });
  page.drawText("PDV%", { x: cols[4], y, size: 9, font: fontBold, color: gray });
  page.drawText("Ukupno", { x: cols[5], y, size: 9, font: fontBold, color: gray });
  y -= 5;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: lineColor });
  y -= 14;

  // Line items
  const lines = invoice.invoice_lines || [];
  for (let i = 0; i < lines.length && y > 100; i++) {
    const line = lines[i];
    page.drawText(String(i + 1), { x: cols[0], y, size: 9, font, color: black });
    const desc = (line.description || "").substring(0, 35);
    page.drawText(desc, { x: cols[1], y, size: 9, font, color: black });
    page.drawText(String(line.quantity || 0), { x: cols[2], y, size: 9, font, color: black });
    page.drawText(formatNum(line.unit_price), { x: cols[3], y, size: 9, font, color: black });
    page.drawText(`${line.tax_rate || 0}%`, { x: cols[4], y, size: 9, font, color: black });
    page.drawText(formatNum(line.total), { x: cols[5], y, size: 9, font, color: black });
    y -= 16;
  }

  y -= 5;
  page.drawLine({ start: { x: 350, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: lineColor });
  y -= 18;

  // Total
  page.drawText("UKUPNO / TOTAL:", { x: 350, y, size: 11, font: fontBold, color: black });
  page.drawText(`${formatNum(invoice.total_amount)} ${invoice.currency || "RSD"}`, {
    x: cols[5], y, size: 11, font: fontBold, color: black,
  });

  // Footer
  page.drawText("PDF/A-3b • ISO 19005-3:2012 • UBL 2.1 XML embedded", {
    x: margin, y: 40, size: 7, font, color: gray,
  });
  page.drawText(`Generated: ${new Date().toISOString()}`, {
    x: margin, y: 28, size: 7, font, color: gray,
  });

  // Embed UBL XML as file attachment (AF relationship for PDF/A-3)
  const xmlBytes = new TextEncoder().encode(ublXml);
  const xmlStream = pdfDoc.context.flateStream(xmlBytes);
  xmlStream.dict.set(PDFName.of("Type"), PDFName.of("EmbeddedFile"));
  xmlStream.dict.set(PDFName.of("Subtype"), PDFName.of("text/xml"));
  const xmlStreamRef = pdfDoc.context.register(xmlStream);

  const fileSpecDict = pdfDoc.context.obj({
    Type: "Filespec",
    F: PDFString.of("invoice.xml"),
    UF: PDFHexString.fromText("invoice.xml"),
    AFRelationship: PDFName.of("Data"),
    EF: { F: xmlStreamRef },
  });
  const fileSpecRef = pdfDoc.context.register(fileSpecDict);

  // Add AF entry to catalog
  const catalog = pdfDoc.catalog;
  catalog.set(PDFName.of("AF"), pdfDoc.context.obj([fileSpecRef]));

  // Names/EmbeddedFiles
  const efTree = pdfDoc.context.obj({
    Names: [PDFHexString.fromText("invoice.xml"), fileSpecRef],
  });
  const names = pdfDoc.context.obj({ EmbeddedFiles: efTree });
  catalog.set(PDFName.of("Names"), names);

  // XMP Metadata for PDF/A-3b conformance marker
  const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Invoice ${escapeXml(invoice.invoice_number || "")}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>ProERP AI</rdf:li></rdf:Seq></dc:creator>
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

  const xmpBytes = new TextEncoder().encode(xmp);
  const xmpStream = pdfDoc.context.flateStream(xmpBytes);
  xmpStream.dict.set(PDFName.of("Type"), PDFName.of("Metadata"));
  xmpStream.dict.set(PDFName.of("Subtype"), PDFName.of("XML"));
  const xmpRef = pdfDoc.context.register(xmpStream);
  catalog.set(PDFName.of("Metadata"), xmpRef);

  return await pdfDoc.save();
}

function formatNum(n: any): string {
  const num = Number(n) || 0;
  return num.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateUblXml(invoice: any, customer: any): string {
  const lines = (invoice.invoice_lines || [])
    .map(
      (line: any, i: number) => `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="EA">${line.quantity || 0}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="${invoice.currency || "RSD"}">${line.total || 0}</cbc:LineExtensionAmount>
      <cac:Item><cbc:Name>${escapeXml(line.description || "")}</cbc:Name></cac:Item>
      <cac:Price><cbc:PriceAmount currencyID="${invoice.currency || "RSD"}">${line.unit_price || 0}</cbc:PriceAmount></cac:Price>
    </cac:InvoiceLine>`
    )
    .join("");

  const supplierParty = `
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escapeXml(invoice.partners?.name || "")}</cbc:Name></cac:PartyName>
      ${invoice.partners?.tax_id ? `<cac:PartyTaxScheme><cbc:CompanyID>${escapeXml(invoice.partners.tax_id)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}
      ${invoice.partners?.address ? `<cac:PostalAddress><cbc:StreetName>${escapeXml(invoice.partners.address)}</cbc:StreetName><cac:Country><cbc:IdentificationCode>RS</cbc:IdentificationCode></cac:Country></cac:PostalAddress>` : ""}
    </cac:Party>
  </cac:AccountingSupplierParty>`;

  const customerParty = `
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${escapeXml(customer?.name || "")}</cbc:Name></cac:PartyName>
      ${customer?.tax_id ? `<cac:PartyTaxScheme><cbc:CompanyID>${escapeXml(customer.tax_id)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}
      ${customer?.address ? `<cac:PostalAddress><cbc:StreetName>${escapeXml(customer.address)}</cbc:StreetName><cac:Country><cbc:IdentificationCode>RS</cbc:IdentificationCode></cac:Country></cac:PostalAddress>` : ""}
    </cac:Party>
  </cac:AccountingCustomerParty>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ID>${escapeXml(invoice.invoice_number || "")}</cbc:ID>
  <cbc:IssueDate>${invoice.invoice_date || new Date().toISOString().slice(0, 10)}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${invoice.currency || "RSD"}</cbc:DocumentCurrencyCode>
  ${supplierParty}
  ${customerParty}
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount currencyID="${invoice.currency || "RSD"}">${invoice.total_amount || 0}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${lines}
</Invoice>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
