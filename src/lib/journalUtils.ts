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
 * Checks fiscal period before posting.
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
  const { tenantId, userId, entryDate, description, reference, legalEntityId, lines } = params;

  // Check fiscal period
  const fiscalPeriodId = await checkFiscalPeriodOpen(tenantId, entryDate);

  // Resolve account codes to IDs
  const resolvedLines = await Promise.all(
    lines.map(async (line) => {
      const account = await findAccountByCode(tenantId, line.accountCode);
      if (!account) throw new Error(`Account ${line.accountCode} not found in chart of accounts`);
      return { ...line, accountId: account.id };
    })
  );

  // Generate entry number
  const entryNumber = `JE-${Date.now().toString(36).toUpperCase()}`;

  // Create journal entry
  const { data: je, error: jeError } = await supabase
    .from("journal_entries")
    .insert([{
      tenant_id: tenantId,
      entry_number: entryNumber,
      entry_date: entryDate,
      description,
      reference,
      status: "posted",
      fiscal_period_id: fiscalPeriodId || null,
      posted_at: new Date().toISOString(),
      posted_by: userId,
      created_by: userId,
      legal_entity_id: legalEntityId || null,
    }])
    .select("id")
    .single();
  if (jeError) throw jeError;

  // Create journal lines
  const journalLines = resolvedLines.map((line) => ({
    journal_entry_id: je.id,
    account_id: line.accountId,
    debit: line.debit,
    credit: line.credit,
    description: line.description,
    sort_order: line.sortOrder,
  }));

  const { error: linesError } = await supabase.from("journal_lines").insert(journalLines);
  if (linesError) throw linesError;

  return je.id;
}
