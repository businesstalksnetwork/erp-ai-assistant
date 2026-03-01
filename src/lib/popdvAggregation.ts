import { supabase } from "@/integrations/supabase/client";

/**
 * Reverse charge mapping: INPUT POPDV → OUTPUT POPDV (Section 3a)
 */
export const REVERSE_CHARGE_MAP: Record<string, string> = {
  "8g.1": "3a.2",
  "8g.2": "3a.4",
  "8g.3": "3a.5",
  "8g.4": "3a.6",
  "8b.1": "3a.1",
  "8b.2": "3a.2",
  "8b.3": "3a.4",
  "8b.4": "3a.5",
  "8b.5": "3a.6",
};

/** Check if a POPDV field triggers reverse charge */
export function isReverseChargeField(popdvField: string): boolean {
  return popdvField in REVERSE_CHARGE_MAP;
}

export function mapToOutputPopdv(inputField: string): string | null {
  return REVERSE_CHARGE_MAP[inputField] || null;
}

export interface PopdvLineAggregation {
  popdv_field: string;
  direction: "output" | "input";
  base_os: number; // base at 20%
  vat_os: number;  // vat at 20%
  base_ps: number; // base at 10%
  vat_ps: number;  // vat at 10%
  total_base: number;
  total_vat: number;
  total_with_vat: number;
  vat_non_deductible: number;
  fee_value: number;
  entry_count: number;
}

export interface PopdvPeriodResult {
  outputLines: PopdvLineAggregation[];
  inputLines: PopdvLineAggregation[];
  reverseChargeLines: PopdvLineAggregation[];
  section5: Section5;
  section8e: Section8e;
  section10: number;
  ppPdv: PpPdvForm;
}

interface Section5 {
  s5_1: number; // Total taxable base
  s5_2: number; // Special procedures base
  s5_3: number; // Special procedures VAT
  s5_7: number; // TOTAL OUTPUT VAT
}

interface Section8e {
  s8a_8: number; // Total VAT from 8a
  s8b_6: number; // Total VAT from 8b
  s8g_5: number; // Total VAT from 8g
  s6_4: number;  // Import VAT
  s7_3: number;  // Farmer PDV nadoknada
  s8dj: number;  // Total input VAT before deductions (8đ)
  s9a_1: number; // Total non-deductible
  s8e_1: number; // Deductible = 8đ - 9a.1
  s8e_3: number; // Correction increase
  s8e_4: number; // Correction decrease
  s8e_5: number; // TOTAL DEDUCTIBLE INPUT VAT
}

export interface PpPdvForm {
  field_001: number;
  field_002: number;
  field_003: number;
  field_103: number;
  field_004: number;
  field_005: number;
  field_105: number;
  field_006: number;
  field_106: number;
  field_007: number;
  field_107: number;
  field_008: number;
  field_108: number;
  field_009: number;
  field_109: number;
  field_110: number;
  field_111: number;
  field_112: number;
}

/**
 * Aggregate all POPDV data for a period using vat_date.
 */
export async function aggregatePopdvPeriod(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
  legalEntityId?: string | null
): Promise<PopdvPeriodResult> {
  // 1. Fetch OUTPUT invoice lines grouped by popdv_field
  const outputLines = await fetchOutputLines(tenantId, periodStart, periodEnd, legalEntityId);

  // 2. Fetch INPUT supplier invoice lines grouped by popdv_field
  const inputLines = await fetchInputLines(tenantId, periodStart, periodEnd, legalEntityId);

  // 3. Generate reverse charge output entries from 8g/8b input lines
  const reverseChargeLines = generateReverseChargeOutput(inputLines);

  // 4. Compute section totals
  const allOutput = [...outputLines, ...reverseChargeLines];
  const section5 = computeSection5(allOutput);
  const section8e = computeSection8e(inputLines, allOutput);
  const section10 = section5.s5_7 - section8e.s8e_5;

  // 5. Generate PP-PDV
  const ppPdv = generatePpPdv(allOutput, inputLines, section5, section8e, section10);

  return { outputLines, inputLines, reverseChargeLines, section5, section8e, section10, ppPdv };
}

async function fetchOutputLines(
  tenantId: string, start: string, end: string, legalEntityId?: string | null
): Promise<PopdvLineAggregation[]> {
  // Fetch invoices with vat_date in period
  let q = supabase.from("invoices")
    .select("id, vat_date, status")
    .eq("tenant_id", tenantId)
    .in("status", ["sent", "paid", "posted"])
    .gte("vat_date", start)
    .lte("vat_date", end);
  if (legalEntityId) q = q.eq("legal_entity_id", legalEntityId);

  const { data: invoices } = await q;
  if (!invoices || invoices.length === 0) return [];

  const invoiceIds = invoices.map(i => i.id);
  const allLines: any[] = [];
  for (let i = 0; i < invoiceIds.length; i += 200) {
    const chunk = invoiceIds.slice(i, i + 200);
    const { data } = await supabase.from("invoice_lines")
      .select("invoice_id, line_total, tax_amount, tax_rate_value, popdv_field, total_with_tax, vat_non_deductible")
      .in("invoice_id", chunk)
      .not("popdv_field", "is", null);
    if (data) allLines.push(...data);
  }

  // P3-10: Include credit notes as negative amounts in POPDV output
  let cnQ = supabase.from("credit_notes")
    .select("id, issued_at, status, subtotal, tax_amount, amount")
    .eq("tenant_id", tenantId)
    .in("status", ["posted", "sent", "approved"])
    .gte("issued_at", start)
    .lte("issued_at", end);
  if (legalEntityId) cnQ = cnQ.eq("legal_entity_id", legalEntityId);
  const { data: creditNotes } = await cnQ;
  if (creditNotes && creditNotes.length > 0) {
    for (const cn of creditNotes) {
      // Credit notes reduce output VAT — add as negative synthetic line
      // Use popdv_field 3.2 (domestic sales standard rate) as default
      const taxRate = cn.tax_amount > 0 && cn.subtotal > 0
        ? Math.round((cn.tax_amount / cn.subtotal) * 100)
        : 20;
      const popdvField = taxRate === 10 ? "3.3" : taxRate === 0 ? "3.6" : "3.2";
      allLines.push({
        invoice_id: cn.id,
        line_total: -(cn.subtotal || 0),
        tax_amount: -(cn.tax_amount || 0),
        tax_rate_value: taxRate,
        popdv_field: popdvField,
        total_with_tax: -(cn.amount || 0),
        vat_non_deductible: false,
      });
    }
  }

  return groupLines(allLines, "output");
}

async function fetchInputLines(
  tenantId: string, start: string, end: string, legalEntityId?: string | null
): Promise<PopdvLineAggregation[]> {
  let q = supabase.from("supplier_invoices")
    .select("id, vat_date, status")
    .eq("tenant_id", tenantId)
    .in("status", ["approved", "paid", "posted"])
    .gte("vat_date", start)
    .lte("vat_date", end);
  if (legalEntityId) q = q.eq("legal_entity_id", legalEntityId);

  const { data: invoices } = await q;
  if (!invoices || invoices.length === 0) return [];

  const invoiceIds = invoices.map(i => i.id);
  const allLines: any[] = [];
  for (let i = 0; i < invoiceIds.length; i += 200) {
    const chunk = invoiceIds.slice(i, i + 200);
    const { data } = await supabase.from("supplier_invoice_lines")
      .select("supplier_invoice_id, line_total, tax_amount, tax_rate_value, popdv_field, total_with_tax, vat_non_deductible, fee_value")
      .in("supplier_invoice_id", chunk)
      .not("popdv_field", "is", null);
    if (data) allLines.push(...data);
  }

  return groupLines(allLines, "input");
}

function groupLines(lines: any[], direction: "output" | "input"): PopdvLineAggregation[] {
  const groups: Record<string, PopdvLineAggregation> = {};

  for (const l of lines) {
    const field = l.popdv_field;
    if (!field) continue;
    if (!groups[field]) {
      groups[field] = {
        popdv_field: field, direction,
        base_os: 0, vat_os: 0, base_ps: 0, vat_ps: 0,
        total_base: 0, total_vat: 0, total_with_vat: 0,
        vat_non_deductible: 0, fee_value: 0, entry_count: 0,
      };
    }
    const g = groups[field];
    const rate = Number(l.tax_rate_value || 0);
    const base = Number(l.line_total || 0);
    const vat = Number(l.tax_amount || 0);

    if (rate === 20) { g.base_os += base; g.vat_os += vat; }
    else if (rate === 10) { g.base_ps += base; g.vat_ps += vat; }

    g.total_base += base;
    g.total_vat += vat;
    g.total_with_vat += Number(l.total_with_tax || base + vat);
    g.vat_non_deductible += Number(l.vat_non_deductible || 0);
    g.fee_value += Number(l.fee_value || 0);
    g.entry_count++;
  }

  return Object.values(groups).sort((a, b) => a.popdv_field.localeCompare(b.popdv_field));
}

function generateReverseChargeOutput(inputLines: PopdvLineAggregation[]): PopdvLineAggregation[] {
  const result: PopdvLineAggregation[] = [];
  for (const line of inputLines) {
    const outputField = REVERSE_CHARGE_MAP[line.popdv_field];
    if (!outputField) continue;
    result.push({
      popdv_field: outputField,
      direction: "output",
      base_os: line.base_os, vat_os: line.vat_os,
      base_ps: line.base_ps, vat_ps: line.vat_ps,
      total_base: line.total_base, total_vat: line.total_vat,
      total_with_vat: line.total_with_vat,
      vat_non_deductible: 0, fee_value: 0,
      entry_count: line.entry_count,
    });
  }
  return result;
}

function sumField(lines: PopdvLineAggregation[], prefix: string, field: "total_vat" | "total_base" | "vat_non_deductible" | "fee_value"): number {
  return lines.filter(l => l.popdv_field.startsWith(prefix)).reduce((s, l) => s + l[field], 0);
}

function getField(lines: PopdvLineAggregation[], id: string, field: "total_vat" | "total_base" | "vat_non_deductible"): number {
  const l = lines.find(x => x.popdv_field === id);
  return l ? l[field] : 0;
}

function computeSection5(outputLines: PopdvLineAggregation[]): Section5 {
  // 5.1 = Total taxable base from sections 3 + 3a
  const s5_1 = sumField(outputLines, "3", "total_base");
  // 5.2/5.3 = Special procedures (section 4)
  const s5_2 = getField(outputLines, "4.1.3", "total_base") + getField(outputLines, "4.2.3", "total_base");
  const s5_3 = getField(outputLines, "4.1.4", "total_vat") + getField(outputLines, "4.2.4", "total_vat");
  // 5.7 = TOTAL OUTPUT VAT
  const s5_7 = sumField(outputLines, "3", "total_vat") + s5_3;

  return { s5_1, s5_2, s5_3, s5_7 };
}

function computeSection8e(inputLines: PopdvLineAggregation[], outputLines: PopdvLineAggregation[]): Section8e {
  const s8a_8 = sumField(inputLines, "8a", "total_vat");
  const s8b_6 = sumField(inputLines, "8b", "total_vat");
  const s8g_5 = sumField(inputLines, "8g", "total_vat");
  const s6_4 = getField(inputLines, "6.4", "total_vat");
  const s7_3 = getField(inputLines, "7.3", "total_vat");
  const s8dj = s8a_8 + s8b_6 + s6_4 + s7_3 + s8g_5;
  const s9a_1 = sumField(inputLines, "9", "vat_non_deductible");
  const s8e_1 = s8dj - s9a_1;
  const s8e_3 = getField(outputLines, "8e.3", "total_vat");
  const s8e_4 = getField(outputLines, "8e.4", "total_vat");
  const s8e_5 = s8e_1 + s8e_3 - s8e_4;

  return { s8a_8, s8b_6, s8g_5, s6_4, s7_3, s8dj, s9a_1, s8e_1, s8e_3, s8e_4, s8e_5 };
}

function generatePpPdv(
  outputLines: PopdvLineAggregation[],
  inputLines: PopdvLineAggregation[],
  s5: Section5,
  s8e: Section8e,
  s10: number
): PpPdvForm {
  return {
    field_001: getField(outputLines, "1.5", "total_base") || sumField(outputLines, "1", "total_base"),
    field_002: getField(outputLines, "2.5", "total_base") || sumField(outputLines, "2", "total_base"),
    field_003: s5.s5_1,
    field_103: s5.s5_2 + s5.s5_3,
    field_004: getField(outputLines, "5.4", "total_base") + getField(outputLines, "5.5", "total_base"),
    field_005: s5.s5_1,
    field_105: s5.s5_7,
    field_006: getField(inputLines, "6.2.1", "total_base") + getField(inputLines, "6.2.2", "total_base") - getField(inputLines, "6.2.3", "total_base"),
    field_106: s8e.s6_4,
    field_007: getField(inputLines, "7.1", "total_base"),
    field_107: s8e.s7_3,
    field_008: s8e.s8dj,
    field_108: s8e.s9a_1,
    field_009: s8e.s8e_3 - s8e.s8e_4,
    field_109: s8e.s8e_5,
    field_110: s10,
    field_111: s10 > 0 ? s10 : 0,
    field_112: s10 < 0 ? Math.abs(s10) : 0,
  };
}

/**
 * Create reverse charge entries in the database for a supplier invoice's lines.
 * Called during approval.
 */
export async function createReverseChargeEntries(
  tenantId: string,
  supplierInvoiceId: string,
  vatDate: string,
  lines: Array<{ id: string; popdv_field: string; line_total: number; tax_amount: number }>
): Promise<void> {
  const entries = lines
    .filter(l => isReverseChargeField(l.popdv_field))
    .map(l => ({
      tenant_id: tenantId,
      supplier_invoice_id: supplierInvoiceId,
      supplier_invoice_line_id: l.id,
      input_popdv_field: l.popdv_field,
      output_popdv_field: mapToOutputPopdv(l.popdv_field)!,
      base_amount: l.line_total,
      vat_amount: l.tax_amount,
      vat_date: vatDate,
    }));

  if (entries.length === 0) return;

  const { error } = await supabase.from("reverse_charge_entries").insert(entries);
  if (error) throw error;
}

/**
 * Generate PP-PDV XML for ePorezi filing
 */
export function generatePpPdvXml(ppPdv: PpPdvForm, meta: {
  pib: string;
  companyName: string;
  periodStart: string;
  periodEnd: string;
  periodYear: number;
  periodMonth: number;
}): string {
  const fmt = (n: number) => n.toFixed(2);
  const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ObrazacPPPDV xmlns="urn:poreskauprava.gov.rs:ObrazacPPPDV">
  <Zaglavlje>
    <PIB>${escXml(meta.pib)}</PIB>
    <NazivObveznika>${escXml(meta.companyName)}</NazivObveznika>
    <PoreskiPeriodOd>${escXml(meta.periodStart)}</PoreskiPeriodOd>
    <PoreskiPeriodDo>${escXml(meta.periodEnd)}</PoreskiPeriodDo>
    <GodinaPerioda>${meta.periodYear}</GodinaPerioda>
    <MesecPerioda>${meta.periodMonth}</MesecPerioda>
  </Zaglavlje>
  <Podaci>
    <Polje001>${fmt(ppPdv.field_001)}</Polje001>
    <Polje002>${fmt(ppPdv.field_002)}</Polje002>
    <Polje003>${fmt(ppPdv.field_003)}</Polje003>
    <Polje103>${fmt(ppPdv.field_103)}</Polje103>
    <Polje004>${fmt(ppPdv.field_004)}</Polje004>
    <Polje005>${fmt(ppPdv.field_005)}</Polje005>
    <Polje105>${fmt(ppPdv.field_105)}</Polje105>
    <Polje006>${fmt(ppPdv.field_006)}</Polje006>
    <Polje106>${fmt(ppPdv.field_106)}</Polje106>
    <Polje007>${fmt(ppPdv.field_007)}</Polje007>
    <Polje107>${fmt(ppPdv.field_107)}</Polje107>
    <Polje008>${fmt(ppPdv.field_008)}</Polje008>
    <Polje108>${fmt(ppPdv.field_108)}</Polje108>
    <Polje009>${fmt(ppPdv.field_009)}</Polje009>
    <Polje109>${fmt(ppPdv.field_109)}</Polje109>
    <Polje110>${fmt(ppPdv.field_110)}</Polje110>
    <Polje111>${fmt(ppPdv.field_111)}</Polje111>
    <Polje112>${fmt(ppPdv.field_112)}</Polje112>
  </Podaci>
</ObrazacPPPDV>`;
}
