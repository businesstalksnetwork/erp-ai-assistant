import { supabase } from "@/integrations/supabase/client";
import { findAccountByCode } from "@/lib/journalUtils";

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
  testAmount: number
): { side: string; amount: number; source: string; description: string }[] {
  return lines.map((line) => {
    let amount = testAmount;
    if (line.amount_source === "TAX_AMOUNT") amount = testAmount * 0.2; // 20% VAT default
    if (line.amount_source === "TAX_BASE") amount = testAmount * 0.8;
    if (line.amount_source === "NET") amount = testAmount * 0.8;
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
        const acct = await findAccountByCode(tenantId, line.account_id);
        if (!acct) throw new Error(`Account ${line.account_id} not found`);
        accountCode = acct.code;
      }
    } else if (line.account_source === "DYNAMIC" && line.dynamic_source) {
      const ctxKey = DYNAMIC_MAP[line.dynamic_source];
      if (!ctxKey || !context[ctxKey]) {
        throw new Error(`Dynamic source ${line.dynamic_source} not provided in context`);
      }
      accountCode = context[ctxKey]!;
    } else {
      throw new Error(`Invalid posting rule line: source=${line.account_source}, dynamic=${line.dynamic_source}`);
    }

    // Calculate amount based on source
    let lineAmount = amount;
    switch (line.amount_source) {
      case "TAX_AMOUNT": lineAmount = amount * 0.2; break; // default 20% VAT
      case "TAX_BASE": lineAmount = amount / 1.2; break;
      case "NET": lineAmount = amount * 0.8; break;
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
