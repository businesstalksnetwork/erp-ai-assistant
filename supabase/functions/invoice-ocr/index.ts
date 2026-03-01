import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { tenant_id, image_base64, file_type } = await req.json();
    if (!tenant_id || !image_base64) {
      return new Response(JSON.stringify({ error: "Missing tenant_id or image_base64" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify membership
    const { data: member } = await supabase.from("tenant_members").select("id").eq("tenant_id", tenant_id).eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!member) {
      return new Response(JSON.stringify({ error: "Not a tenant member" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const mediaType = file_type === "pdf" ? "application/pdf" : "image/jpeg";

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract invoice data from this image. Return JSON with these fields:
{
  "supplier_name": "string",
  "supplier_pib": "string (9 digits)",
  "supplier_maticni_broj": "string",
  "invoice_number": "string",
  "invoice_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD or null",
  "subtotal": number,
  "tax_amount": number,
  "total": number,
  "currency": "RSD",
  "items": [{"description": "string", "quantity": number, "unit_price": number, "tax_rate": number, "total": number}],
  "bank_account": "string or null",
  "payment_reference": "string or null",
  "confidence": number (0-1)
}
Respond ONLY with the JSON object. If a field can't be extracted, use null.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mediaType};base64,${image_base64}` },
            },
          ],
        }],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", errText);
      return new Response(JSON.stringify({ error: "AI service error" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    let extracted;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      extracted = JSON.parse(cleaned);
    } catch {
      extracted = { error: "Failed to parse AI response", raw: content };
    }

    // Try APR lookup if we have PIB
    if (extracted.supplier_pib) {
      try {
        const aprRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/validate-pib`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({ pib: extracted.supplier_pib }),
        });
        if (aprRes.ok) {
          const aprData = await aprRes.json();
          if (aprData.valid) {
            extracted.apr_verified = true;
            extracted.apr_name = aprData.name || extracted.supplier_name;
          }
        }
      } catch (e) {
        console.warn("APR lookup failed:", e);
      }
    }

    // Log AI action
    await supabase.from("ai_action_log").insert({
      tenant_id, user_id: user.id, action_type: "invoice_ocr", module: "purchasing",
      model_version: "gpt-4o", reasoning: `OCR extracted invoice from ${extracted.supplier_name || "unknown"}`,
      confidence_score: extracted.confidence || null,
    });

    return new Response(JSON.stringify({ extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
