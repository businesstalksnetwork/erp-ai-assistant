/**
 * SEC-01: Centralized CORS configuration for all edge functions.
 * ISO 27001 A.13.1 — Network security management.
 *
 * Allowed origins can be extended via ALLOWED_ORIGINS env var (comma-separated).
 * Default: production domain + Lovable preview domains.
 */

const DEFAULT_ORIGINS = [
  "https://proerpai.lovable.app",
  "https://id-preview--a347532a-0028-44d9-85ae-4e042514628f.lovable.app",
];

function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (envOrigins) {
    return [...DEFAULT_ORIGINS, ...envOrigins.split(",").map((o) => o.trim()).filter(Boolean)];
  }
  return DEFAULT_ORIGINS;
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = getAllowedOrigins();

  // In development / Lovable preview, allow any lovable.app subdomain
  const isLovablePreview = origin.endsWith(".lovable.app");
  const isAllowed = allowed.includes(origin) || isLovablePreview;

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}
