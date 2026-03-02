import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  
  if (!vapidPublicKey) {
    return new Response(
      JSON.stringify({ error: "VAPID public key not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ publicKey: vapidPublicKey }),
    { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) }
  );
});
