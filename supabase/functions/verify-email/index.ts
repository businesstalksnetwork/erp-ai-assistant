import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface VerifyEmailRequest {
  token: string;
}

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { token }: VerifyEmailRequest = await req.json();

    console.log(`[verify-email] Processing verification request`);

    if (!token) {
      throw new Error("Missing token");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("verification_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      console.error("[verify-email] Token not found:", tokenError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "invalid_token",
          message: "Link za verifikaciju nije validan ili je već iskorišćen." 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (tokenData.used_at) {
      console.log("[verify-email] Token already used");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "token_used",
          message: "Ovaj link za verifikaciju je već iskorišćen. Možete se prijaviti." 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      console.log("[verify-email] Token expired");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "token_expired",
          message: "Link za verifikaciju je istekao. Molimo registrujte se ponovo." 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[verify-email] Token valid for user: ${tokenData.user_id}`);

    const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(
      tokenData.user_id,
      { email_confirm: true }
    );

    if (updateUserError) {
      console.error("[verify-email] Error confirming user:", updateUserError);
      throw new Error("Failed to confirm user email");
    }

    console.log(`[verify-email] User email confirmed: ${tokenData.email}`);

    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ email_verified: true })
      .eq("id", tokenData.user_id);

    if (profileUpdateError) {
      console.error("[verify-email] Error updating profile email_verified:", profileUpdateError);
    } else {
      console.log(`[verify-email] Profile email_verified set to true`);
    }

    await supabaseAdmin
      .from("verification_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    console.log(`[verify-email] Token marked as used`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email adresa je uspešno potvrđena. Sada se možete prijaviti." 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[verify-email] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "server_error",
        message: error.message 
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
