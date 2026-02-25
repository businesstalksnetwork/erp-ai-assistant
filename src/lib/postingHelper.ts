import { findPostingRule, resolvePostingRuleToJournalLines, DynamicContext } from "@/lib/postingRuleEngine";
import { createCodeBasedJournalEntry } from "@/lib/journalUtils";

/**
 * Attempts to post a journal entry using the posting rules engine.
 * If no rule is found, falls back to the provided hardcoded lines.
 * Returns the journal entry ID.
 */
export async function postWithRuleOrFallback(params: {
  tenantId: string;
  userId: string | null;
  modelCode: string;
  amount: number;
  entryDate: string;
  description: string;
  reference: string;
  legalEntityId?: string;
  context: DynamicContext;
  bankAccountId?: string;
  currency?: string;
  partnerType?: string;
  fallbackLines: Array<{
    accountCode: string;
    debit: number;
    credit: number;
    description: string;
    sortOrder: number;
  }>;
}): Promise<string> {
  const {
    tenantId, userId, modelCode, amount, entryDate,
    description, reference, legalEntityId, context,
    bankAccountId, currency, partnerType, fallbackLines,
  } = params;

  let lines = fallbackLines;

  try {
    const rule = await findPostingRule(tenantId, modelCode, bankAccountId, currency, partnerType);
    if (rule && rule.lines.length > 0) {
      lines = await resolvePostingRuleToJournalLines(tenantId, rule.lines, amount, context);
    }
  } catch (e) {
    console.warn(`[PostingHelper] Rule lookup failed for ${modelCode}, using fallback:`, e);
  }

  return createCodeBasedJournalEntry({
    tenantId,
    userId,
    entryDate,
    description,
    reference,
    legalEntityId,
    lines,
  });
}
