import { supabase } from "@/integrations/supabase/client";

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
