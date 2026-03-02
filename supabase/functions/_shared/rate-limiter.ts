/**
 * SEC-08: DB-backed sliding window rate limiter for edge functions.
 * ISO 27001 A.12.6 — Technical vulnerability management.
 *
 * Uses Supabase rate_limit_log table for distributed rate limiting
 * across all edge function instances. Falls back to in-memory if DB fails.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Rate limit categories with default limits per PRD */
export const RATE_LIMIT_CATEGORIES = {
  ai: { limit: 30, windowMs: 60_000 },
  sef: { limit: 60, windowMs: 60_000 },
  crud: { limit: 120, windowMs: 60_000 },
  auth: { limit: 10, windowMs: 60_000 },
  export: { limit: 5, windowMs: 60_000 },
  general: { limit: 60, windowMs: 60_000 },
} as const;

export type RateLimitCategory = keyof typeof RATE_LIMIT_CATEGORIES;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

// In-memory fallback store
const memStore = new Map<string, number[]>();

function checkInMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  let timestamps = memStore.get(key) || [];
  timestamps = timestamps.filter((t) => t > cutoff);

  if (timestamps.length >= limit) {
    const retryAfterMs = timestamps[0] + windowMs - now;
    memStore.set(key, timestamps);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  timestamps.push(now);
  memStore.set(key, timestamps);
  return { allowed: true, remaining: limit - timestamps.length };
}

/**
 * Check rate limit using DB-backed sliding window.
 * @param key - Unique identifier (e.g., "ai-assistant:user-id")
 * @param category - Rate limit category (ai, sef, crud, auth, export, general)
 * @param overrideLimit - Override the default limit for this category
 * @param overrideWindowMs - Override the default window for this category
 */
export async function checkRateLimit(
  key: string,
  categoryOrLimit: RateLimitCategory | number = "general",
  overrideWindowMs?: number,
): Promise<RateLimitResult> {
  let limit: number;
  let windowMs: number;

  if (typeof categoryOrLimit === "number") {
    // Legacy compatibility: checkRateLimit(key, limit, windowMs)
    limit = categoryOrLimit;
    windowMs = overrideWindowMs ?? 60_000;
  } else {
    const cat = RATE_LIMIT_CATEGORIES[categoryOrLimit];
    limit = cat.limit;
    windowMs = overrideWindowMs ?? cat.windowMs;
  }

  const category = typeof categoryOrLimit === "string" ? categoryOrLimit : "general";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Periodically cleanup old entries (1% chance per request)
    if (Math.random() < 0.01) {
      sb.rpc("cleanup_rate_limit_log").then(() => {});
    }

    const windowStart = new Date(Date.now() - windowMs).toISOString();

    // Count requests in the current window
    const { count, error: countErr } = await sb
      .from("rate_limit_log")
      .select("*", { count: "exact", head: true })
      .eq("key", key)
      .gte("ts", windowStart);

    if (countErr) throw countErr;

    const currentCount = count ?? 0;

    if (currentCount >= limit) {
      // Get oldest entry to calculate retry-after
      const { data: oldest } = await sb
        .from("rate_limit_log")
        .select("ts")
        .eq("key", key)
        .gte("ts", windowStart)
        .order("ts", { ascending: true })
        .limit(1)
        .single();

      const retryAfterMs = oldest
        ? new Date(oldest.ts).getTime() + windowMs - Date.now()
        : windowMs;

      return { allowed: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 1000) };
    }

    // Insert new entry
    await sb.from("rate_limit_log").insert({ key, category });

    return { allowed: true, remaining: limit - currentCount - 1 };
  } catch (e) {
    // Fallback to in-memory if DB fails
    console.warn("Rate limiter DB fallback:", e);
    return checkInMemory(key, limit, windowMs);
  }
}

/** Build rate limit headers for 429 responses */
export function rateLimitHeaders(retryAfterMs: number): Record<string, string> {
  return {
    "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
    "X-RateLimit-Reset": new Date(Date.now() + retryAfterMs).toISOString(),
  };
}
