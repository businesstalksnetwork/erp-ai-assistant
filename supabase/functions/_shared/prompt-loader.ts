/**
 * AI-02: Centralized prompt loader from ai_prompt_registry.
 * ISO 42001 — AI governance: versioned, auditable prompt management.
 *
 * Falls back to a provided default if no registry entry exists.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface PromptConfig {
  prompt_template: string;
  model: string;
  temperature: number;
  max_tokens: number;
  confidence_auto_approve: number;
  confidence_flag_threshold: number;
}

const DEFAULT_CONFIG: Omit<PromptConfig, "prompt_template"> = {
  model: "gemini-3-flash-preview",
  temperature: 0.3,
  max_tokens: 2000,
  confidence_auto_approve: 0.85,
  confidence_flag_threshold: 0.50,
};

/**
 * Load a prompt from the registry, with tenant-specific override support.
 * Priority: tenant-specific active prompt > global active prompt > fallback default.
 */
export async function loadPrompt(
  functionName: string,
  promptKey: string,
  tenantId: string | null,
  fallbackTemplate: string,
): Promise<PromptConfig> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Try tenant-specific first, then global
    const { data: rows } = await admin
      .from("ai_prompt_registry")
      .select("prompt_template, model, temperature, max_tokens, confidence_auto_approve, confidence_flag_threshold")
      .eq("function_name", functionName)
      .eq("prompt_key", promptKey)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(10);

    if (rows && rows.length > 0) {
      // Prefer tenant-specific over global (null tenant_id)
      const tenantRow = tenantId
        ? rows.find((r: any) => r.tenant_id === tenantId)
        : null;
      const globalRow = rows.find((r: any) => r.tenant_id === null);
      const chosen = tenantRow || globalRow || rows[0];

      return {
        prompt_template: chosen.prompt_template || fallbackTemplate,
        model: chosen.model || DEFAULT_CONFIG.model,
        temperature: Number(chosen.temperature) || DEFAULT_CONFIG.temperature,
        max_tokens: chosen.max_tokens || DEFAULT_CONFIG.max_tokens,
        confidence_auto_approve: Number(chosen.confidence_auto_approve) ?? DEFAULT_CONFIG.confidence_auto_approve,
        confidence_flag_threshold: Number(chosen.confidence_flag_threshold) ?? DEFAULT_CONFIG.confidence_flag_threshold,
      };
    }
  } catch (err) {
    console.warn("Prompt registry lookup failed, using fallback:", err);
  }

  return {
    prompt_template: fallbackTemplate,
    ...DEFAULT_CONFIG,
  };
}

/**
 * AI-03: Evaluate confidence score against thresholds.
 * Returns a decision category for the AI output.
 */
export type ConfidenceDecision = "auto_approve" | "suggest" | "flag" | "reject";

export function evaluateConfidence(
  score: number,
  config: Pick<PromptConfig, "confidence_auto_approve" | "confidence_flag_threshold">,
): ConfidenceDecision {
  if (score >= config.confidence_auto_approve) return "auto_approve";
  if (score >= config.confidence_flag_threshold) return "suggest";
  if (score >= 0.2) return "flag";
  return "reject";
}
