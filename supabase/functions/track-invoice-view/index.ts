import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const handler = async (req: Request): Promise<Response> => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("<html><body><h1>Nevažeći link</h1><p>Link za preuzimanje fakture je nevažeći.</p></body></html>", {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Look up tracking record
    const { data: view, error } = await supabase
      .from("invoice_views")
      .select("id, pdf_url, invoice_id, company_id, viewed_at, view_count")
      .eq("tracking_token", token)
      .single();

    if (error || !view) {
      console.error("Token not found:", token, error);
      return new Response("<html><body><h1>Link nije pronađen</h1><p>Link za preuzimanje fakture nije pronađen ili je istekao.</p></body></html>", {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Get viewer info
    const viewerIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const viewerUserAgent = req.headers.get("user-agent") || "unknown";
    const now = new Date().toISOString();

    // Update view stats
    const updateData: Record<string, unknown> = {
      view_count: (view.view_count || 0) + 1,
      last_viewed_at: now,
      viewer_ip: viewerIp,
      viewer_user_agent: viewerUserAgent,
    };

    // Set first view time
    if (!view.viewed_at) {
      updateData.viewed_at = now;
    }

    await supabase
      .from("invoice_views")
      .update(updateData)
      .eq("id", view.id);

    // Create notification for invoice owner (only on first view)
    if (!view.viewed_at && view.invoice_id && view.company_id) {
      // Get invoice details and owner
      const { data: invoice } = await supabase
        .from("invoices")
        .select("invoice_number, client_name")
        .eq("id", view.invoice_id)
        .single();

      const { data: company } = await supabase
        .from("companies")
        .select("user_id")
        .eq("id", view.company_id)
        .single();

      if (invoice && company) {
        await supabase.from("notifications").insert({
          user_id: company.user_id,
          company_id: view.company_id,
          type: "invoice_viewed",
          title: "Faktura pregledana",
          message: `Klijent ${invoice.client_name} je otvorio fakturu ${invoice.invoice_number}`,
          link: `/invoices/${view.invoice_id}`,
          reference_id: view.invoice_id,
        });
      }
    }

    // Redirect to PDF
    return new Response(null, {
      status: 302,
      headers: { Location: view.pdf_url },
    });
  } catch (err) {
    console.error("Error in track-invoice-view:", err);
    return new Response("<html><body><h1>Greška</h1><p>Došlo je do greške pri otvaranju fakture.</p></body></html>", {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
};

serve(handler);
