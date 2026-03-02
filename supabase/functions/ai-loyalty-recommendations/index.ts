/**
 * AI Loyalty Recommendations — heuristic-based member engagement suggestions.
 * SEC: JWT auth + tenant membership check + rate limiting + shared CORS.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse, createJsonResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";
import { checkRateLimit, rateLimitHeaders } from "../_shared/rate-limiter.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    if (req.method !== "POST") {
      return createErrorResponse("Method not allowed", req, { status: 405 });
    }

    // Auth: verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return createErrorResponse("Unauthorized", req, { status: 401 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const anonClient = createClient(supabaseUrl, anonKey);

    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return createErrorResponse("Unauthorized", req, { status: 401 });

    const { tenant_id } = await req.json();
    if (!tenant_id) return createErrorResponse("tenant_id required", req, { status: 400 });

    // Tenant membership check
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) return createErrorResponse("Forbidden", req, { status: 403 });

    // Rate limit
    const rl = await checkRateLimit(`loyalty-recs:${user.id}`, "ai");
    if (!rl.allowed) return createErrorResponse("Rate limited", req, { status: 429 });

    // Fetch members with their transaction history summary
    const { data: members } = await supabase
      .from("loyalty_members")
      .select("id, first_name, last_name, card_number, points_balance, lifetime_points, current_tier, enrolled_at, status")
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .order("lifetime_points", { ascending: false })
      .limit(50);

    if (!members || members.length === 0) {
      return createJsonResponse({ recommendations: [] }, req);
    }

    // Get recent transactions per member
    const memberIds = members.map(m => m.id);
    const { data: transactions } = await supabase
      .from("loyalty_transactions")
      .select("member_id, points, type, created_at")
      .in("member_id", memberIds)
      .order("created_at", { ascending: false })
      .limit(500);

    // Build member profiles
    const memberProfiles = members.map(m => {
      const txs = (transactions || []).filter(t => t.member_id === m.id);
      const earnTxs = txs.filter(t => t.points > 0);
      const lastTx = txs[0];
      const daysSinceLastTx = lastTx ? Math.floor((Date.now() - new Date(lastTx.created_at).getTime()) / 86400000) : 999;

      return {
        name: `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.card_number || m.id.slice(0, 8),
        card_number: m.card_number,
        tier: m.current_tier,
        points: m.points_balance,
        lifetime: m.lifetime_points,
        tx_count: txs.length,
        earn_count: earnTxs.length,
        days_since_last: daysSinceLastTx,
        enrolled_days: Math.floor((Date.now() - new Date(m.enrolled_at).getTime()) / 86400000),
      };
    });

    // Generate recommendations using heuristics
    const recommendations: any[] = [];

    for (const mp of memberProfiles) {
      if (mp.days_since_last > 30 && mp.days_since_last < 999) {
        recommendations.push({
          member_name: mp.name, card_number: mp.card_number,
          recommendation: `${mp.name} hasn't made a purchase in ${mp.days_since_last} days. Consider sending a personalized offer or bonus points incentive to re-engage.`,
          action_type: "re_engagement",
          priority: mp.days_since_last > 60 ? "high" : "medium",
        });
      }

      if (mp.tier === "bronze" && mp.lifetime >= 3000) {
        recommendations.push({
          member_name: mp.name, card_number: mp.card_number,
          recommendation: `${mp.name} is close to Silver tier (${mp.lifetime}/5000 pts). A targeted promotion could push them over.`,
          action_type: "tier_upgrade", priority: "medium",
        });
      } else if (mp.tier === "silver" && mp.lifetime >= 15000) {
        recommendations.push({
          member_name: mp.name, card_number: mp.card_number,
          recommendation: `${mp.name} is approaching Gold tier (${mp.lifetime}/20000 pts). Consider a double-points campaign.`,
          action_type: "tier_upgrade", priority: "medium",
        });
      }

      if (mp.lifetime >= 50000 && mp.points > 5000) {
        recommendations.push({
          member_name: mp.name, card_number: mp.card_number,
          recommendation: `${mp.name} is a top Platinum member with ${mp.points.toLocaleString()} unredeemed points. Consider exclusive VIP offers.`,
          action_type: "vip_recognition", priority: "low",
        });
      }

      if (mp.enrolled_days < 14 && mp.earn_count === 0) {
        recommendations.push({
          member_name: mp.name, card_number: mp.card_number,
          recommendation: `${mp.name} enrolled recently but hasn't earned any points yet. Send a welcome offer with bonus points on first purchase.`,
          action_type: "onboarding", priority: "high",
        });
      }
    }

    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

    return createJsonResponse({ recommendations: recommendations.slice(0, 20) }, req);
  } catch (error) {
    return createErrorResponse(error, req, { logPrefix: "ai-loyalty-recommendations" });
  }
});
