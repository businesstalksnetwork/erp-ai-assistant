import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth gate (High Fix 5): require either a valid user JWT or internal service secret
    const authHeader = req.headers.get("Authorization");
    const internalSecret = req.headers.get("X-Internal-Secret");
    const expectedSecret = Deno.env.get("INTERNAL_SERVICE_SECRET");

    let authenticated = false;

    // Check internal secret for function-to-function calls
    if (internalSecret && expectedSecret && internalSecret === expectedSecret) {
      authenticated = true;
    }

    // Check user JWT
    if (!authenticated && authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: authErr } = await userClient.auth.getUser();
      if (!authErr && user) {
        authenticated = true;
      }
    }

    if (!authenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event_id } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch the event
    const { data: event, error: eventError } = await supabase
      .from("module_events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(
        JSON.stringify({ error: "Event not found", details: eventError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Skip if already completed
    if (event.status === "completed") {
      return new Response(JSON.stringify({ message: "Event already processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Mark as processing
    await supabase
      .from("module_events")
      .update({ status: "processing" })
      .eq("id", event_id);

    // 3. Find matching subscriptions (exact match or wildcard)
    const eventParts = event.event_type.split(".");
    const wildcardPattern = eventParts[0] + ".*";

    const { data: subscriptions } = await supabase
      .from("module_event_subscriptions")
      .select("*")
      .eq("is_active", true)
      .or(`event_type.eq.${event.event_type},event_type.eq.${wildcardPattern}`);

    if (!subscriptions || subscriptions.length === 0) {
      await supabase
        .from("module_events")
        .update({ status: "completed", processed_at: new Date().toISOString() })
        .eq("id", event_id);

      return new Response(
        JSON.stringify({ message: "No subscriptions matched", event_type: event.event_type }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Process each subscription handler
    let allSuccess = true;
    const results: Array<{ subscription_id: string; status: string; error?: string }> = [];

    for (const sub of subscriptions) {
      try {
        const handlerResult = await handleEvent(supabase, event, sub);

        // Log success
        await supabase.from("module_event_logs").insert({
          event_id: event_id,
          subscription_id: sub.id,
          status: "success",
          response: handlerResult,
        });

        results.push({ subscription_id: sub.id, status: "success" });
      } catch (handlerError: unknown) {
        allSuccess = false;
        const errorMsg = handlerError instanceof Error ? handlerError.message : String(handlerError);

        await supabase.from("module_event_logs").insert({
          event_id: event_id,
          subscription_id: sub.id,
          status: "failed",
          error_message: errorMsg,
        });

        results.push({ subscription_id: sub.id, status: "failed", error: errorMsg });
      }
    }

    // 5. Update event status
    const newRetryCount = event.retry_count + (allSuccess ? 0 : 1);
    const finalStatus = allSuccess
      ? "completed"
      : newRetryCount >= event.max_retries
        ? "failed"
        : "pending"; // will be retried

    await supabase
      .from("module_events")
      .update({
        status: finalStatus,
        retry_count: newRetryCount,
        processed_at: allSuccess ? new Date().toISOString() : null,
        error_message: allSuccess ? null : `${results.filter((r) => r.status === "failed").length} handler(s) failed`,
      })
      .eq("id", event_id);

    return new Response(
      JSON.stringify({ event_id, status: finalStatus, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Route event to the correct handler based on event_type + handler_module.
 * All logic lives here — no external function calls needed.
 */
async function handleEvent(
  supabase: ReturnType<typeof createClient>,
  event: Record<string, unknown>,
  subscription: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const eventType = event.event_type as string;
  const handlerModule = subscription.handler_module as string;
  const payload = event.payload as Record<string, unknown>;
  const tenantId = event.tenant_id as string;
  const entityId = event.entity_id as string;

  // --- Inventory handlers ---
  if (handlerModule === "inventory") {
    if (eventType === "invoice.posted") {
      // Deduct stock for invoice lines with products
      return await handleInvoicePostedInventory(supabase, tenantId, entityId, payload);
    }
    if (eventType === "sales_order.confirmed") {
      const { error } = await supabase.rpc("reserve_stock_for_order", {
        p_tenant_id: tenantId,
        p_sales_order_id: entityId,
      });
      if (error) throw new Error(`Stock reservation failed: ${error.message}`);
      return { action: "reserve_stock", message: "Stock reserved for sales order", entity_id: entityId };
    }
    if (eventType === "sales_order.cancelled") {
      const { error } = await supabase.rpc("release_stock_for_order", {
        p_tenant_id: tenantId,
        p_sales_order_id: entityId,
      });
      if (error) throw new Error(`Stock release failed: ${error.message}`);
      return { action: "release_stock", message: "Stock released for cancelled order", entity_id: entityId };
    }
    if (eventType === "production.completed") {
      return { action: "add_finished_goods", message: "Production output placeholder", entity_id: entityId };
    }
    if (eventType === "pos.transaction_completed") {
      return { action: "deduct_pos_stock", message: "POS stock deduction placeholder", entity_id: entityId };
    }
    if (eventType === "return_case.approved") {
      return await handleReturnApprovedInventory(supabase, tenantId, entityId, payload);
    }
    if (eventType === "supplier_return.shipped") {
      return await handleSupplierReturnShipped(supabase, tenantId, entityId, payload);
    }
  }

  // --- Accounting handlers ---
  if (handlerModule === "accounting") {
    if (eventType === "pos.transaction_completed") {
      return { action: "create_pos_journal", message: "POS journal entry placeholder", entity_id: entityId };
    }
    if (eventType === "credit_note.issued") {
      return { action: "create_storno_journal", message: "Credit note storno journal placeholder", entity_id: entityId };
    }
    if (eventType === "fixed_asset.depreciated") {
      return { action: "post_depreciation_entry", message: "Fixed asset depreciation journal placeholder", entity_id: entityId };
    }
    if (eventType === "deferral.recognized") {
      return { action: "post_deferral_recognition", message: "Deferral recognition journal placeholder", entity_id: entityId };
    }
  }

  // --- Workflow handlers ---
  if (handlerModule === "workflow") {
    if (eventType === "approval.completed") {
      return { action: "update_entity_approval_status", message: "Approval status update placeholder", entity_id: entityId };
    }
  }

  // --- Notification handlers ---
  if (handlerModule === "notifications") {
    if (eventType === "invoice.overdue") {
      return await emitNotification(supabase, tenantId, {
        target_user_ids: "all_tenant_members",
        type: "warning",
        category: "invoice",
        title: `Invoice ${payload.invoice_number || entityId} is overdue`,
        message: `Invoice is overdue by ${payload.days_overdue || "?"} days`,
        entity_type: "invoice",
        entity_id: entityId,
      });
    }
    if (eventType === "approval.requested") {
      return await emitNotification(supabase, tenantId, {
        target_user_ids: "all_tenant_members",
        type: "action",
        category: "approval",
        title: `Approval requested`,
        message: `Approval requested for ${payload.entity_type || "entity"} ${payload.entity_name || entityId}`,
        entity_type: "approval",
        entity_id: entityId,
      });
    }
    if (eventType === "approval.completed") {
      const targetUsers = payload.requested_by ? [payload.requested_by as string] : "all_tenant_members";
      return await emitNotification(supabase, tenantId, {
        target_user_ids: targetUsers,
        type: "info",
        category: "approval",
        title: `Approval ${payload.decision || "completed"}`,
        message: `Your ${payload.entity_type || "entity"} has been ${payload.decision || "processed"}`,
        entity_type: "approval",
        entity_id: entityId,
      });
    }
    if (eventType === "inventory.low_stock") {
      return await emitNotification(supabase, tenantId, {
        target_user_ids: "all_tenant_members",
        type: "warning",
        category: "inventory",
        title: `Low stock: ${payload.product_name || "Product"}`,
        message: `${payload.product_name || "A product"} is below minimum stock level`,
        entity_type: "product",
        entity_id: entityId,
      });
    }
    if (eventType === "return_case.approved") {
      return await emitNotification(supabase, tenantId, {
        target_user_ids: "all_tenant_members",
        type: "info",
        category: "invoice",
        title: `Return case approved`,
        message: `Return case ${payload.case_number || entityId} has been approved`,
        entity_type: "return_case",
        entity_id: entityId,
      });
    }
    if (eventType === "leave_request.submitted") {
      return await emitNotification(supabase, tenantId, {
        target_user_ids: "all_tenant_members",
        type: "action",
        category: "hr",
        title: `Leave request submitted`,
        message: `New leave request from ${payload.employee_name || "an employee"}`,
        entity_type: "leave_request",
        entity_id: entityId,
      });
    }
    if (eventType === "loan_payment.due") {
      return { action: "notify_loan_payment", message: "Loan payment notification placeholder", entity_id: entityId };
    }
  }

  return { action: "noop", message: `No handler implemented for ${eventType} -> ${handlerModule}` };
}

async function handleInvoicePostedInventory(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  invoiceId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const warehouseId = payload.warehouse_id as string | undefined;
  if (!warehouseId) {
    return { action: "skip", message: "No warehouse specified, skipping inventory deduction" };
  }

  // Get invoice lines with products
  const { data: lines } = await supabase
    .from("invoice_lines")
    .select("product_id, quantity")
    .eq("invoice_id", invoiceId)
    .not("product_id", "is", null);

  if (!lines || lines.length === 0) {
    return { action: "skip", message: "No product lines on invoice" };
  }

  const adjustments: string[] = [];
  for (const line of lines) {
    const { error } = await supabase.rpc("adjust_inventory_stock", {
      p_tenant_id: tenantId,
      p_product_id: line.product_id,
      p_warehouse_id: warehouseId,
      p_quantity: -line.quantity,
      p_movement_type: "out",
      p_notes: `Event bus: invoice ${payload.invoice_number || invoiceId}`,
      p_reference: String(payload.invoice_number || invoiceId),
    });
    if (error) throw new Error(`Stock adjustment failed for product ${line.product_id}: ${error.message}`);
    adjustments.push(line.product_id);
  }

  return { action: "deduct_stock", adjusted_products: adjustments };
}

async function handleReturnApprovedInventory(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  returnCaseId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const returnType = payload.return_type as string;
  if (returnType !== "customer") {
    return { action: "skip", message: "Only customer returns add stock back" };
  }

  const { data: lines } = await supabase
    .from("return_lines")
    .select("product_id, quantity_accepted")
    .eq("return_case_id", returnCaseId)
    .eq("inspection_status", "accepted")
    .not("product_id", "is", null);

  if (!lines || lines.length === 0) {
    return { action: "skip", message: "No accepted product lines" };
  }

  // Use first warehouse available for tenant
  const { data: wh } = await supabase
    .from("warehouses")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!wh) {
    return { action: "skip", message: "No active warehouse found" };
  }

  const adjustments: string[] = [];
  for (const line of lines) {
    const { error } = await supabase.rpc("adjust_inventory_stock", {
      p_tenant_id: tenantId,
      p_product_id: line.product_id,
      p_warehouse_id: wh.id,
      p_quantity: line.quantity_accepted,
      p_movement_type: "in",
      p_notes: `Event bus: customer return ${payload.case_number || returnCaseId}`,
      p_reference: String(payload.case_number || returnCaseId),
    });
    if (error) throw new Error(`Stock adjustment failed for product ${line.product_id}: ${error.message}`);
    adjustments.push(line.product_id);
  }

  return { action: "add_return_stock", adjusted_products: adjustments };
}

async function handleSupplierReturnShipped(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  shipmentId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  // ... keep existing code
  const warehouseId = payload.warehouse_id as string | undefined;
  const returnCaseId = payload.return_case_id as string | undefined;
  if (!warehouseId || !returnCaseId) {
    return { action: "skip", message: "No warehouse or return case specified" };
  }

  const { data: lines } = await supabase
    .from("return_lines")
    .select("product_id, quantity_returned")
    .eq("return_case_id", returnCaseId)
    .not("product_id", "is", null);

  if (!lines || lines.length === 0) {
    return { action: "skip", message: "No product lines on return case" };
  }

  const adjustments: string[] = [];
  for (const line of lines) {
    const { error } = await supabase.rpc("adjust_inventory_stock", {
      p_tenant_id: tenantId,
      p_product_id: line.product_id,
      p_warehouse_id: warehouseId,
      p_quantity: -line.quantity_returned,
      p_movement_type: "out",
      p_notes: `Event bus: supplier return shipment ${payload.shipment_number || shipmentId}`,
      p_reference: String(payload.shipment_number || shipmentId),
    });
    if (error) throw new Error(`Stock adjustment failed for product ${line.product_id}: ${error.message}`);
    adjustments.push(line.product_id);
  }

  return { action: "deduct_supplier_return_stock", adjusted_products: adjustments };
}

async function emitNotification(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  params: {
    target_user_ids: string | string[];
    type: string;
    category: string;
    title: string;
    message: string;
    entity_type?: string;
    entity_id?: string;
  }
): Promise<Record<string, unknown>> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const res = await fetch(`${supabaseUrl}/functions/v1/create-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      ...params,
    }),
  });

  const result = await res.json();
  return { action: "notification_sent", ...result };
}
