/**
 * EI-01/EI-02: UBL XML Builder class for Serbian eFaktura (EN 16931).
 * ISO 19005 / EN 16931 compliant XML generation.
 * Replaces string concatenation with structured builder pattern.
 */

/** Escape XML special characters */
export function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatAmount(n: number): string {
  return n.toFixed(2);
}

export function formatPrice(n: number): string {
  const s = n.toFixed(4);
  return s.replace(/0{1,2}$/, '');
}

/** Map tax_rate_value to UBL TaxCategory ID per Serbian eFaktura spec */
export function getTaxCategoryId(taxRateValue: number, isReverseCharge = false, invoiceDate?: string): string {
  if (taxRateValue === 0) return "O";
  const useLegacyCodes = invoiceDate ? invoiceDate < "2026-04-01" : false;
  if (isReverseCharge) {
    if (useLegacyCodes) return "AE";
    return taxRateValue === 10 ? "AE10" : "AE20";
  }
  if (useLegacyCodes) return "S";
  return taxRateValue === 10 ? "S10" : "S20";
}

/** Structured XML element builder — eliminates string concatenation */
export class XmlBuilder {
  private parts: string[] = [];
  private indent = 0;

  constructor(private indentStr = "  ") {}

  declaration(): this {
    this.parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    return this;
  }

  openTag(tag: string, attrs?: Record<string, string>): this {
    const attrStr = attrs
      ? " " + Object.entries(attrs).map(([k, v]) => `${k}="${escapeXml(v)}"`).join(" ")
      : "";
    this.parts.push(`${this.pad()}<${tag}${attrStr}>`);
    this.indent++;
    return this;
  }

  closeTag(tag: string): this {
    this.indent--;
    this.parts.push(`${this.pad()}</${tag}>`);
    return this;
  }

  element(tag: string, content: string | number | null | undefined, attrs?: Record<string, string>): this {
    if (content === null || content === undefined) return this;
    const attrStr = attrs
      ? " " + Object.entries(attrs).map(([k, v]) => `${k}="${escapeXml(v)}"`).join(" ")
      : "";
    this.parts.push(`${this.pad()}<${tag}${attrStr}>${escapeXml(String(content))}</${tag}>`);
    return this;
  }

  /** Add element only if value is truthy */
  elementIf(condition: any, tag: string, content: string | number | null | undefined, attrs?: Record<string, string>): this {
    if (condition) this.element(tag, content, attrs);
    return this;
  }

  raw(xml: string): this {
    this.parts.push(xml);
    return this;
  }

  private pad(): string {
    return this.indentStr.repeat(this.indent);
  }

  build(): string {
    return this.parts.join("\n");
  }
}

/** EN 16931 mandatory element validation */
export interface UblValidationError {
  field: string;
  message: string;
}

export interface UblInvoiceData {
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes?: string | null;
  advance_amount_applied?: number;
  document_type?: number;
  billing_reference_number?: string;
  billing_reference_date?: string;
}

export interface UblParty {
  pib: string;
  maticni_broj?: string;
  name: string;
  address: string;
  city: string;
  postal_code?: string;
  country?: string;
  email?: string;
  bank_account?: string;
}

export interface UblLine {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_amount: number;
  tax_rate_value: number;
  total_with_tax?: number;
  sort_order: number;
  product_id?: string | null;
  efaktura_category?: string | null;
}

/**
 * EI-01: Validate mandatory EN 16931 elements before XML generation.
 * Returns array of validation errors (empty = valid).
 */
export function validateUblInvoice(
  invoice: UblInvoiceData,
  supplier: UblParty,
  buyer: UblParty,
  lines: UblLine[],
): UblValidationError[] {
  const errors: UblValidationError[] = [];

  // BT-1: Invoice number
  if (!invoice.invoice_number?.trim()) errors.push({ field: "invoice_number", message: "BT-1 Invoice number is required" });
  // BT-2: Issue date
  if (!invoice.invoice_date?.trim()) errors.push({ field: "invoice_date", message: "BT-2 Issue date is required" });
  // BT-5: Currency
  if (!invoice.currency?.trim()) errors.push({ field: "currency", message: "BT-5 Currency code is required" });
  // BG-4: Supplier
  if (!supplier.pib?.trim()) errors.push({ field: "supplier.pib", message: "BT-31 Supplier tax ID (PIB) is required" });
  if (!supplier.name?.trim()) errors.push({ field: "supplier.name", message: "BT-27 Supplier name is required" });
  if (!supplier.address?.trim()) errors.push({ field: "supplier.address", message: "BT-35 Supplier address is required" });
  if (!supplier.city?.trim()) errors.push({ field: "supplier.city", message: "BT-37 Supplier city is required" });
  // BG-7: Buyer
  if (!buyer.pib?.trim()) errors.push({ field: "buyer.pib", message: "BT-48 Buyer tax ID (PIB) is required" });
  if (!buyer.name?.trim()) errors.push({ field: "buyer.name", message: "BT-44 Buyer name is required" });
  // BG-25: Lines
  if (!lines || lines.length === 0) errors.push({ field: "lines", message: "BG-25 At least one invoice line is required" });
  lines?.forEach((line, i) => {
    if (!line.description?.trim()) errors.push({ field: `lines[${i}].description`, message: `BT-153 Line ${i + 1} description is required` });
    if (line.quantity <= 0) errors.push({ field: `lines[${i}].quantity`, message: `BT-129 Line ${i + 1} quantity must be positive` });
  });

  return errors;
}
