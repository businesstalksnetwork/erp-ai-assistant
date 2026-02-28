import { supabase } from "@/integrations/supabase/client";
import { findAccountByCode, findAccountById } from "@/lib/journalUtils";

export interface PostingRuleLine {
  id: string;
  line_number: number;
  side: "DEBIT" | "CREDIT";
  account_source: "FIXED" | "DYNAMIC";
  account_id: string | null;
  dynamic_source: string | null;
  amount_source: "FULL" | "TAX_BASE" | "TAX_AMOUNT" | "NET" | "GROSS";
  amount_factor: number;
  description_template: string;
  is_tax_line: boolean;
}

export interface PostingRuleResult {
  rule_id: string;
  rule_name: string;
  rule_description: string;
  lines: PostingRuleLine[];
}

export async function findPostingRule(
  tenantId: string,
  modelCode: string,
  bankAccountId?: string,
  currency?: string,
  partnerType?: string
): Promise<PostingRuleResult | null> {
  const { data, error } = await supabase.rpc("find_posting_rule", {
    p_tenant_id: tenantId,
    p_model_code: modelCode,
    p_bank_account_id: bankAccountId || null,
    p_currency: currency || null,
    p_partner_type: partnerType || null,
  });

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const row = data[0];
  return {
    rule_id: row.rule_id,
    rule_name: row.rule_name,
    rule_description: row.rule_description,
    lines: (row.lines as unknown as PostingRuleLine[]) || [],
  };
}

/** Simulate a posting rule with a test amount - returns debit/credit entries */
export function simulatePosting(
  lines: PostingRuleLine[],
  testAmount: number,
  taxRate?: number
): { side: string; amount: number; source: string; description: string }[] {
  return lines.map((line) => {
    let amount = testAmount;
    const rate = taxRate ?? 0.2;
    if (line.amount_source === "TAX_AMOUNT") amount = testAmount * rate;
    if (line.amount_source === "TAX_BASE") amount = testAmount / (1 + rate);
    if (line.amount_source === "NET") amount = testAmount * (1 - rate);
    amount *= line.amount_factor || 1;

    const source =
      line.account_source === "FIXED"
        ? `Account ${line.account_id?.substring(0, 8) || "?"}`
        : `Dynamic: ${line.dynamic_source || "?"}`;

    return {
      side: line.side,
      amount: Math.round(amount * 100) / 100,
      source,
      description: line.description_template || "",
    };
  });
}

/** Map payment model code to i18n translation key */
export const PAYMENT_MODEL_KEYS: Record<string, string> = {
  // Original bank statement models
  CUSTOMER_PAYMENT: "customerPayment",
  VENDOR_PAYMENT: "vendorPayment",
  ADVANCE_RECEIVED: "advanceReceived",
  ADVANCE_PAID: "advancePaid",
  SALARY_PAYMENT: "salaryPayment",
  TAX_PAYMENT: "taxPayment",
  VAT_PAYMENT: "vatPayment",
  VAT_REFUND: "vatRefund",
  BANK_FEE: "bankFee",
  INTER_ACCOUNT_TRANSFER: "interAccountTransfer",
  FX_REVALUATION: "fxRevaluationModel",
  INTERNAL_COMPENSATION: "internalCompensation",
  CUSTOMER_REFUND: "customerRefund",
  VENDOR_REFUND: "vendorRefund",
  // Inventory & purchasing
  GOODS_RECEIPT: "goodsReceipt",
  SUPPLIER_INVOICE_POST: "supplierInvoicePost",
  SUPPLIER_INVOICE_PAYMENT: "supplierInvoicePayment",
  // Returns
  CUSTOMER_RETURN_RESTOCK: "customerReturnRestock",
  CUSTOMER_RETURN_CREDIT: "customerReturnCredit",
  SUPPLIER_RETURN: "supplierReturn",
  CREDIT_NOTE_ISSUED: "creditNoteIssued",
  // Loans
  LOAN_PAYMENT_PAYABLE: "loanPaymentPayable",
  LOAN_PAYMENT_RECEIVABLE: "loanPaymentReceivable",
  // Compensation
  COMPENSATION: "compensation",
  // Fixed assets
  ASSET_DEPRECIATION: "assetDepreciation",
  ASSET_DISPOSAL: "assetDisposal",
  // FX
  FX_GAIN: "fxGain",
  FX_LOSS: "fxLoss",
  // Deferrals
  DEFERRAL_REVENUE: "deferralRevenue",
  DEFERRAL_EXPENSE: "deferralExpense",
  // Cash register
  CASH_IN: "cashIn",
  CASH_OUT: "cashOut",
  // Intercompany
  INTERCOMPANY_POST: "intercompanyPost",
  // Payroll (new engine)
  PAYROLL_NET: "payrollNet",
  PAYROLL_TAX: "payrollTax",
  PAYROLL_PAYMENT: "payrollPayment",
  // POS (Phase 5)
  POS_SALE_REVENUE: "posSaleRevenue",
  POS_SALE_COGS: "posSaleCogs",
  POS_SALE_RETAIL: "posSaleRetail",
  // Production (Phase 5)
  PRODUCTION_COMPLETION: "productionCompletion",
};

export const DYNAMIC_SOURCES = [
  "BANK_ACCOUNT",
  "PARTNER_RECEIVABLE",
  "PARTNER_PAYABLE",
  "EMPLOYEE_NET",
  "TAX_PAYABLE",
  "CONTRIBUTION_PAYABLE",
  "ADVANCE_RECEIVED",
  "ADVANCE_PAID",
  "CLEARING",
] as const;

export const AMOUNT_SOURCES = ["FULL", "TAX_BASE", "TAX_AMOUNT", "NET", "GROSS"] as const;

/**
 * Dynamic source → GL account resolution context.
 * Callers provide the relevant account codes/IDs for dynamic resolution.
 */
export interface DynamicContext {
  bankAccountGlCode?: string;
  partnerReceivableCode?: string;
  partnerPayableCode?: string;
  employeeNetCode?: string;
  taxPayableCode?: string;
  contributionPayableCode?: string;
  advanceReceivedCode?: string;
  advancePaidCode?: string;
  clearingCode?: string;
  /** Tax rate as decimal (0.20 for 20%, 0.10 for 10%, 0 for exempt). Defaults to 0.20. */
  taxRate?: number;
}

const DYNAMIC_MAP: Record<string, keyof DynamicContext> = {
  BANK_ACCOUNT: "bankAccountGlCode",
  PARTNER_RECEIVABLE: "partnerReceivableCode",
  PARTNER_PAYABLE: "partnerPayableCode",
  EMPLOYEE_NET: "employeeNetCode",
  TAX_PAYABLE: "taxPayableCode",
  CONTRIBUTION_PAYABLE: "contributionPayableCode",
  ADVANCE_RECEIVED: "advanceReceivedCode",
  ADVANCE_PAID: "advancePaidCode",
  CLEARING: "clearingCode",
};

/**
 * Resolves a posting rule into concrete journal lines ready for createCodeBasedJournalEntry.
 * Handles both FIXED (account_id lookup) and DYNAMIC (context-based) account resolution.
 */
export async function resolvePostingRuleToJournalLines(
  tenantId: string,
  lines: PostingRuleLine[],
  amount: number,
  context: DynamicContext,
  accounts?: { id: string; code: string }[]
): Promise<Array<{ accountCode: string; debit: number; credit: number; description: string; sortOrder: number }>> {
  const result: Array<{ accountCode: string; debit: number; credit: number; description: string; sortOrder: number }> = [];

  for (const line of lines) {
    let accountCode: string;

    if (line.account_source === "FIXED" && line.account_id) {
      // Look up account code from cached accounts list or fetch
      const cached = accounts?.find((a) => a.id === line.account_id);
      if (cached) {
        accountCode = cached.code;
      } else {
        const acct = await findAccountById(tenantId, line.account_id);
        if (!acct) throw new Error(`Account ${line.account_id} not found`);
        accountCode = acct.code;
      }
    } else if (line.account_source === "DYNAMIC" && line.dynamic_source) {
      const ctxKey = DYNAMIC_MAP[line.dynamic_source];
      const ctxValue = ctxKey ? context[ctxKey] : undefined;
      if (!ctxKey || !ctxValue || typeof ctxValue !== "string") {
        throw new Error(`Dynamic source ${line.dynamic_source} not provided in context`);
      }
      accountCode = ctxValue;
    } else {
      throw new Error(`Invalid posting rule line: source=${line.account_source}, dynamic=${line.dynamic_source}`);
    }

    // Calculate amount based on source — use dynamic tax rate from context
    const rate = context.taxRate ?? 0.2;
    let lineAmount = amount;
    switch (line.amount_source) {
      case "TAX_AMOUNT": lineAmount = amount * rate; break;
      case "TAX_BASE": lineAmount = amount / (1 + rate); break;
      case "NET": lineAmount = amount * (1 - rate); break;
      case "GROSS": break; // same as FULL
      case "FULL": break;
    }
    lineAmount *= line.amount_factor || 1;
    lineAmount = Math.round(lineAmount * 100) / 100;

    result.push({
      accountCode,
      debit: line.side === "DEBIT" ? lineAmount : 0,
      credit: line.side === "CREDIT" ? lineAmount : 0,
      description: line.description_template || "",
      sortOrder: line.line_number,
    });
  }

  return result;
}
