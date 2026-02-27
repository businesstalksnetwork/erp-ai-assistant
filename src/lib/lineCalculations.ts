/**
 * Shared line calculation utilities for Invoice and Supplier Invoice forms.
 * Extracts common calc logic to avoid duplication across form pages.
 */

export interface BaseLineFields {
  quantity: number;
  unit_price: number;
  tax_rate_value: number;
  line_total: number;
  tax_amount: number;
  total_with_tax: number;
}

export interface InvoiceLineCalc extends BaseLineFields {
  item_type: string;
  popdv_field: string;
  efaktura_category: string;
  sort_order: number;
  description: string;
  tax_rate_id: string;
  id?: string;
  product_id?: string;
}

export interface SupplierInvoiceLineCalc extends BaseLineFields {
  item_type: string;
  popdv_field: string;
  efaktura_category: string;
  sort_order: number;
  description: string;
  tax_rate_id: string;
  vat_non_deductible: number;
  fee_value: number;
  account_id: string;
  cost_center_id: string;
  id?: string;
}

// ── eFaktura category options (shared) ──

export const EFAKTURA_OPTIONS = [
  { value: "S10", label: "S10 — PDV 10%" },
  { value: "S20", label: "S20 — PDV 20%" },
  { value: "AE10", label: "AE10 — Obrnuto 10%" },
  { value: "AE20", label: "AE20 — Obrnuto 20%" },
  { value: "Z", label: "Z — Nulta stopa" },
  { value: "E", label: "E — Oslobođeno" },
  { value: "O", label: "O — Van sistema PDV" },
  { value: "SS", label: "SS — Posebni postupci" },
] as const;

// ── Empty line factories ──

export function emptyInvoiceLine(
  order: number,
  defaultTaxRateId: string,
  defaultRate: number
): InvoiceLineCalc {
  return {
    description: "",
    quantity: 1,
    unit_price: 0,
    tax_rate_id: defaultTaxRateId,
    tax_rate_value: defaultRate,
    line_total: 0,
    tax_amount: 0,
    total_with_tax: 0,
    sort_order: order,
    item_type: "service",
    popdv_field: "3.2",
    efaktura_category: "",
  };
}

export function emptySupplierInvoiceLine(
  order: number,
  defaultTaxRateId: string,
  defaultRate: number,
  defaultPopdv = ""
): SupplierInvoiceLineCalc {
  return {
    description: "",
    item_type: "service",
    popdv_field: defaultPopdv,
    efaktura_category: "",
    quantity: 1,
    unit_price: 0,
    tax_rate_id: defaultTaxRateId,
    tax_rate_value: defaultRate,
    line_total: 0,
    tax_amount: 0,
    total_with_tax: 0,
    vat_non_deductible: 0,
    fee_value: 0,
    account_id: "",
    cost_center_id: "",
    sort_order: order,
  };
}

// ── Calculation helpers ──

/** Standard invoice line calc: qty × price + tax */
export function calcInvoiceLine<T extends BaseLineFields>(line: T): T {
  const lineTotal = line.quantity * line.unit_price;
  const taxAmount = lineTotal * (line.tax_rate_value / 100);
  return {
    ...line,
    line_total: lineTotal,
    tax_amount: taxAmount,
    total_with_tax: lineTotal + taxAmount,
  };
}

/** Check if POPDV field is fee-based (8v/8d) */
export function isFeeField(popdv: string): boolean {
  return /^8[vd]/.test(popdv);
}

/** Supplier invoice line calc with fee-based and non-deductible handling */
export function calcSupplierInvoiceLine(
  line: SupplierInvoiceLineCalc
): SupplierInvoiceLineCalc {
  const lineTotal = line.quantity * line.unit_price;

  // 8v/8d: fee_value is the tax base (provizija)
  if (isFeeField(line.popdv_field)) {
    const taxAmount = line.fee_value * (line.tax_rate_value / 100);
    return {
      ...line,
      line_total: lineTotal,
      tax_amount: taxAmount,
      total_with_tax: lineTotal + taxAmount,
      vat_non_deductible: 0,
    };
  }

  // Section 9: fully non-deductible
  if (line.popdv_field.startsWith("9")) {
    const nonDeductible = lineTotal * (line.tax_rate_value / 100);
    return {
      ...line,
      line_total: lineTotal,
      tax_amount: 0,
      vat_non_deductible: nonDeductible,
      total_with_tax: lineTotal + nonDeductible,
    };
  }

  // Standard calc
  const taxAmount = lineTotal * (line.tax_rate_value / 100);
  return {
    ...line,
    line_total: lineTotal,
    tax_amount: taxAmount,
    total_with_tax: lineTotal + taxAmount,
    vat_non_deductible: 0,
  };
}

/** Check if PIB is non-Serbian (not exactly 9 digits) */
export function isForeignPib(pib: string | null | undefined): boolean {
  if (!pib) return false;
  const cleaned = pib.replace(/\s/g, "");
  return cleaned.length > 0 && !/^\d{9}$/.test(cleaned);
}

// ── Summary helpers ──

export function calcLineTotals<T extends BaseLineFields>(lines: T[]) {
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const totalTax = lines.reduce((s, l) => s + l.tax_amount, 0);
  const total = lines.reduce((s, l) => s + l.total_with_tax, 0);
  return { subtotal, totalTax, total };
}
