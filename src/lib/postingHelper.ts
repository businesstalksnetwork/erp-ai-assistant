import { findPostingRule, resolvePostingRuleToJournalLines, DynamicContext } from "@/lib/postingRuleEngine";
import { createCodeBasedJournalEntry, checkFiscalPeriodOpen } from "@/lib/journalUtils";
import { supabase } from "@/integrations/supabase/client";

/**
 * Attempts to post a journal entry using the posting rules engine.
 * If no rule is found, falls back to the provided hardcoded lines.
 * Enforces fiscal period check before posting.
 * Writes audit log entry after successful posting.
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

  // 3.2: Enforce fiscal period check before posting
  await checkFiscalPeriodOpen(tenantId, entryDate);

  let lines = fallbackLines;

  try {
    const rule = await findPostingRule(tenantId, modelCode, bankAccountId, currency, partnerType);
    if (rule && rule.lines.length > 0) {
      lines = await resolvePostingRuleToJournalLines(tenantId, rule.lines, amount, context);
    }
  } catch (e) {
    console.warn(`[PostingHelper] Rule lookup failed for ${modelCode}, using fallback:`, e);
  }

  const journalId = await createCodeBasedJournalEntry({
    tenantId,
    userId,
    entryDate,
    description,
    reference,
    legalEntityId,
    lines,
  });

  // 3.6: Audit log entry for GL posting
  try {
    await supabase.from("audit_log").insert({
      tenant_id: tenantId,
      user_id: userId,
      action: "gl_post",
      entity_type: modelCode,
      entity_id: journalId,
      details: { description, reference, amount, linesCount: lines.length },
    } as any);
  } catch (e) {
    console.warn("[PostingHelper] Audit log insert failed:", e);
  }

  return journalId;
}
