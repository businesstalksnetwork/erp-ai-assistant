import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyEmailRequest {
  token: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token }: VerifyEmailRequest = await req.json();

    console.log(`[verify-email] Processing verification request`);

    if (!token) {
      throw new Error("Missing token");
    }

    // Initialize Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find the token in database
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
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if token is already used
    if (tokenData.used_at) {
      console.log("[verify-email] Token already used");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "token_used",
          message: "Ovaj link za verifikaciju je već iskorišćen. Možete se prijaviti." 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if token is expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt < new Date()) {
      console.log("[verify-email] Token expired");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "token_expired",
          message: "Link za verifikaciju je istekao. Molimo registrujte se ponovo." 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`[verify-email] Token valid for user: ${tokenData.user_id}`);

    // Confirm user's email using Admin API
    const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(
      tokenData.user_id,
      { 
        email_confirm: true 
      }
    );

    if (updateUserError) {
      console.error("[verify-email] Error confirming user:", updateUserError);
      throw new Error("Failed to confirm user email");
    }

    console.log(`[verify-email] User email confirmed: ${tokenData.email}`);

    // Also set email_verified = true in profiles table (application-level verification)
    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({ email_verified: true })
      .eq("id", tokenData.user_id);

    if (profileUpdateError) {
      console.error("[verify-email] Error updating profile email_verified:", profileUpdateError);
      // Don't throw - the auth confirmation succeeded, this is secondary
    } else {
      console.log(`[verify-email] Profile email_verified set to true`);
    }

    // Mark token as used
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
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[verify-email] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "server_error",
        message: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
