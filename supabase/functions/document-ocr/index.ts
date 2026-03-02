import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/error-handler.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const { tenant_id, document_id, image_base64 } = await req.json();
    if (!tenant_id || !document_id || !image_base64) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify membership
    const { data: member } = await supabase.from("tenant_members").select("id").eq("tenant_id", tenant_id).eq("user_id", user.id).eq("status", "active").limit(1).single();
    if (!member) {
      return new Response(JSON.stringify({ error: "Not a tenant member" }), { status: 403, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), { status: 500, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    // Call AI to extract text and classify document
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You are an OCR and document classification assistant. 
1. Extract ALL text visible in the provided image, preserving layout where possible.
2. Classify the document into one of these categories: faktura (invoice), ugovor (contract), racun (receipt), izvod (bank statement), resenje (decision/resolution), dopis (letter/correspondence), ponuda (offer/quote), nalog (order), potvrda (confirmation), izvestaj (report), ostalo (other).
3. Return JSON with two fields: {"text": "extracted text here", "category": "category_key"}
If no text is found, return {"text": "NO_TEXT_FOUND", "category": "ostalo"}.` },
          { role: "user", content: [
            { type: "text", text: "Extract text and classify this document:" },
            { type: "image_url", image_url: { url: `data:image/png;base64,${image_base64}` } },
          ]},
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), { status: 429, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required for AI credits" }), { status: 402, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
      }
      return new Response(JSON.stringify({ error: "AI processing failed" }), { status: 500, headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";
    
    // Parse classification response
    let extractedText = rawContent;
    let category = "ostalo";
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      extractedText = parsed.text || rawContent;
      category = parsed.category || "ostalo";
    } catch {
      // Fallback: treat entire response as text
      extractedText = rawContent;
    }

    // Store OCR text and category in documents table
    await supabase.from("documents").update({ ocr_text: extractedText, ai_category: category }).eq("id", document_id).eq("tenant_id", tenant_id);

    // CR7-06: Audit log for document OCR
    try {
      await supabase.from("ai_action_log").insert({
        tenant_id: tenant_id,
        user_id: user.id,
        action_type: "document_ocr",
        module: "documents",
        model_version: "google/gemini-2.5-flash",
        user_decision: "auto",
        reasoning: `OCR processed document ${document_id}, classified as '${category}', extracted ${extractedText.length} chars`,
      });
    } catch (e) {
      console.warn("Failed to log AI action:", e);
    }

    return new Response(JSON.stringify({ text: extractedText, category }), { headers: withSecurityHeaders({ ...corsHeaders, "Content-Type": "application/json" }) });
  } catch (e) {
    return createErrorResponse(e, req, { logPrefix: "document-ocr" });
  }
});
