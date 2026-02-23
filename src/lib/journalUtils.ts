import { supabase } from "@/integrations/supabase/client";

/**
 * Finds a chart of accounts entry by code for a given tenant.
 */
export async function findAccountByCode(tenantId: string, code: string) {
  const { data } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name")
    .eq("tenant_id", tenantId)
    .eq("code", code)
    .eq("is_active", true)
    .limit(1)
    .single();
  return data;
}

/**
 * Checks if the fiscal period for a given date is open.
 * Returns the fiscal_period_id if found, or null.
 * Throws an error if the period is closed/locked.
 */
export async function checkFiscalPeriodOpen(tenantId: string, entryDate: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("check_fiscal_period_open", {
    p_tenant_id: tenantId,
    p_entry_date: entryDate,
  });
  if (error) throw error;
  return data as string | null;
}

/**
 * Creates a journal entry with multiple lines using deterministic account codes.
 * Uses the atomic create_journal_entry_with_lines RPC to ensure header + lines
 * are inserted in a single transaction. No partial "posted" entries can occur.
 */
export async function createCodeBasedJournalEntry(params: {
  tenantId: string;
  userId: string | null;
  entryDate: string;
  description: string;
  reference: string;
  legalEntityId?: string;
  lines: Array<{
    accountCode: string;
    debit: number;
    credit: number;
    description: string;
    sortOrder: number;
  }>;
}) {
  const { tenantId, entryDate, description, reference, legalEntityId, lines } = params;

  // Resolve account codes to IDs (read-only, safe client-side)
  const resolvedLines = await Promise.all(
    lines.map(async (line) => {
      const account = await findAccountByCode(tenantId, line.accountCode);
      if (!account) throw new Error(`Account ${line.accountCode} not found in chart of accounts`);
      return {
        account_id: account.id,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
        sort_order: line.sortOrder,
      };
    })
  );

  // Generate entry number
  const entryNumber = `JE-${Date.now().toString(36).toUpperCase()}`;

  // Call atomic RPC — handles balance check, fiscal period check, and insert in one transaction
  const { data, error } = await supabase.rpc("create_journal_entry_with_lines", {
    p_tenant_id: tenantId,
    p_entry_number: entryNumber,
    p_entry_date: entryDate,
    p_description: description,
    p_reference: reference,
    p_legal_entity_id: legalEntityId || null,
    p_lines: JSON.stringify(resolvedLines),
  });

  if (error) throw error;
  return data as string;
}
