import { z } from "zod";

// ── Invoice Line Schema ──
export const invoiceLineSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().optional(),
  description: z.string().default(""),
  item_type: z.string().default("service"),
  popdv_field: z.string().default("3.2"),
  efaktura_category: z.string().default(""),
  quantity: z.number().min(0).default(1),
  unit_price: z.number().min(0).default(0),
  tax_rate_id: z.string().default(""),
  tax_rate_value: z.number().default(0),
  line_total: z.number().default(0),
  tax_amount: z.number().default(0),
  total_with_tax: z.number().default(0),
  sort_order: z.number().default(0),
});

export type InvoiceLineFormValues = z.infer<typeof invoiceLineSchema>;

// ── Invoice Form Schema ──
export const invoiceFormSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string().min(1),
  dueDate: z.string().default(""),
  vatDate: z.string().min(1),
  selectedPartnerId: z.string().default(""),
  partnerName: z.string().default(""),
  partnerPib: z.string().default(""),
  partnerAddress: z.string().default(""),
  currency: z.string().default("RSD"),
  notes: z.string().default(""),
  status: z.string().default("draft"),
  invoiceType: z.enum(["regular", "advance", "advance_final", "proforma", "credit_note", "debit_note"]).default("regular"),
  advanceInvoiceId: z.string().default(""),
  advanceAmountApplied: z.number().default(0),
  legalEntityId: z.string().default(""),
  salespersonId: z.string().default(""),
  salesOrderId: z.string().nullable().default(null),
  lines: z.array(invoiceLineSchema).min(1),
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

// ── Supplier Invoice Line Schema ──
export const supplierInvoiceLineSchema = z.object({
  id: z.string().optional(),
  description: z.string().default(""),
  item_type: z.string().default("service"),
  popdv_field: z.string().default(""),
  efaktura_category: z.string().default(""),
  quantity: z.number().min(0).default(1),
  unit_price: z.number().min(0).default(0),
  tax_rate_id: z.string().default(""),
  tax_rate_value: z.number().default(0),
  line_total: z.number().default(0),
  tax_amount: z.number().default(0),
  total_with_tax: z.number().default(0),
  vat_non_deductible: z.number().default(0),
  fee_value: z.number().default(0),
  account_id: z.string().default(""),
  cost_center_id: z.string().default(""),
  sort_order: z.number().default(0),
});

export type SupplierInvoiceLineFormValues = z.infer<typeof supplierInvoiceLineSchema>;

// ── Supplier Invoice Form Schema ──
export const supplierInvoiceFormSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string().min(1),
  vatDate: z.string().min(1),
  dueDate: z.string().default(""),
  supplierId: z.string().default(""),
  supplierName: z.string().default(""),
  purchaseOrderId: z.string().default(""),
  currency: z.string().default("RSD"),
  notes: z.string().default(""),
  status: z.string().default("draft"),
  legalEntityId: z.string().default(""),
  isForeignSupplier: z.boolean().default(false),
  lines: z.array(supplierInvoiceLineSchema).min(1),
});

export type SupplierInvoiceFormValues = z.infer<typeof supplierInvoiceFormSchema>;
