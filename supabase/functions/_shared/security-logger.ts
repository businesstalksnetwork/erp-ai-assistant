/**
 * SEC-04: Security event logger.
 * ISO 27001 A.12.4 — Logging and monitoring.
 * Logs security-relevant events to the security_events table.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SecuritySeverity = "info" | "warning" | "error" | "critical";

export interface SecurityEvent {
  tenant_id?: string;
  user_id?: string;
  event_type: string;
  severity: SecuritySeverity;
  source: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, unknown>;
}

/** Log a security event to the security_events table via service role */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await admin.from("security_events").insert({
      tenant_id: event.tenant_id || null,
      user_id: event.user_id || null,
      event_type: event.event_type,
      severity: event.severity,
      source: event.source,
      ip_address: event.ip_address || null,
      user_agent: event.user_agent || null,
      details: event.details || {},
    });
  } catch (err) {
    // Never let logging failure break the request
    console.error("Security event logging failed:", err);
  }
}

/** Extract client IP from request headers */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
