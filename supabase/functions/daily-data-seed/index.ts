import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function uuid() { return crypto.randomUUID(); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randAmount(min: number, max: number) { return Math.round((Math.random() * (max - min) + min) * 100) / 100; }

const TENANT_ID = "92474a4b-ff91-48da-b111-89924e70b8b8";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require cron secret for non-interactive calls
    const cronSecret = req.headers.get("x-cron-secret");
    if (cronSecret !== Deno.env.get("CRON_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const year = today.getFullYear();
    const log: string[] = [];
    const L = (msg: string) => { log.push(msg); console.log(msg); };

    // Check if tenant exists
    const { data: tenant } = await sb.from("tenants").select("id").eq("id", TENANT_ID).single();
    if (!tenant) {
      return new Response(JSON.stringify({ success: true, message: "Tenant not found, skipping" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency check: see if we already have invoices for today
    const { data: existingInv } = await sb.from("invoices")
      .select("id").eq("tenant_id", TENANT_ID)
      .eq("invoice_date", todayStr).limit(1);
    if (existingInv?.length) {
      return new Response(JSON.stringify({ success: true, message: "Today's data already exists", date: todayStr }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load reference data
    const [
      { data: partners },
      { data: products },
      { data: suppliers },
      { data: locations },
      { data: fiscalDevices },
      { data: warehouses },
      { data: employees },
      { data: companies },
      { data: contacts },
      { data: fpData },
    ] = await Promise.all([
      sb.from("partners").select("id, name, pib").eq("tenant_id", TENANT_ID).eq("type", "customer").limit(50),
      sb.from("products").select("id, name, default_sale_price, default_purchase_price").eq("tenant_id", TENANT_ID).limit(100),
      sb.from("partners").select("id, name").eq("tenant_id", TENANT_ID).eq("type", "supplier").limit(15),
      sb.from("locations").select("id").eq("tenant_id", TENANT_ID).limit(3),
      sb.from("fiscal_devices").select("id").eq("tenant_id", TENANT_ID).limit(3),
      sb.from("warehouses").select("id").eq("tenant_id", TENANT_ID).limit(3),
      sb.from("employees").select("id").eq("tenant_id", TENANT_ID).limit(25),
      sb.from("companies").select("id").eq("tenant_id", TENANT_ID).limit(10),
      sb.from("contacts").select("id").eq("tenant_id", TENANT_ID).limit(10),
      sb.from("fiscal_periods").select("id, start_date, end_date").eq("tenant_id", TENANT_ID).order("start_date", { ascending: false }).limit(1),
    ]);

    if (!partners?.length || !products?.length) {
      return new Response(JSON.stringify({ success: true, message: "No base data, skipping" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const le = "ff1ad125-78d6-4931-985d-9071edf4238c";
    const fpId = fpData?.[0]?.id;

    // ── 1. Invoices (5-10) ──
    const numInvoices = randInt(5, 10);
    const invRows: any[] = [];
    const invLineRows: any[] = [];
    const { data: lastInv } = await sb.from("invoices").select("invoice_number")
      .eq("tenant_id", TENANT_ID).order("created_at", { ascending: false }).limit(1);
    let invCounter = 1;
    if (lastInv?.[0]) {
      const match = lastInv[0].invoice_number.match(/(\d+)$/);
      if (match) invCounter = parseInt(match[1]) + 1;
    }

    for (let i = 0; i < numInvoices; i++) {
      const invId = uuid();
      const partner = pick(partners);
      const statusRoll = Math.random();
      const status = statusRoll < 0.5 ? "paid" : statusRoll < 0.8 ? "sent" : "draft";
      let subtotal = 0, taxAmount = 0;
      const numLines = randInt(1, 3);
      for (let li = 0; li < numLines; li++) {
        const prod = pick(products);
        const qty = randInt(1, 10);
        const price = Number(prod.default_sale_price || 1000);
        const lineTotal = Math.round(qty * price * 100) / 100;
        const lineTax = Math.round(lineTotal * 0.2 * 100) / 100;
        subtotal += lineTotal;
        taxAmount += lineTax;
        invLineRows.push({
          id: uuid(), invoice_id: invId,
          product_id: prod.id, description: prod.name,
          quantity: qty, unit_price: price, line_total: lineTotal,
          tax_rate_value: 20, tax_amount: lineTax,
          total_with_tax: Math.round((lineTotal + lineTax) * 100) / 100,
          sort_order: li + 1,
        });
      }
      const nowIso = today.toISOString();
      invRows.push({
        id: invId, tenant_id: TENANT_ID,
        invoice_number: `FACT-${year}-${String(invCounter++).padStart(5, "0")}`,
        invoice_date: todayStr,
        due_date: new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10),
        partner_id: partner.id, partner_name: partner.name, partner_pib: partner.pib,
        status,
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: Math.round((subtotal + taxAmount) * 100) / 100,
        currency: "RSD", legal_entity_id: le,
        invoice_type: "regular", sale_type: "domestic",
        sef_status: status === "paid" ? "accepted" : "not_sent",
        paid_at: status === "paid" ? todayStr : null,
        created_at: nowIso,
      });
    }
    await sb.from("invoices").insert(invRows);
    await sb.from("invoice_lines").insert(invLineRows);
    L(`Invoices: ${invRows.length}, Lines: ${invLineRows.length}`);

    // ── 2. Supplier Invoices (2-3) ──
    const numSI = randInt(2, 3);
    const siRows: any[] = [];
    for (let i = 0; i < numSI; i++) {
      const supp = pick(suppliers || []);
      if (!supp) break;
      const amount = randAmount(5000, 100000);
      const tax = Math.round(amount * 0.2 * 100) / 100;
      siRows.push({
        id: uuid(), tenant_id: TENANT_ID,
        invoice_number: `UF-${year}-DAILY-${todayStr.replace(/-/g, "")}-${i + 1}`,
        invoice_date: todayStr,
        due_date: new Date(today.getTime() + 45 * 86400000).toISOString().slice(0, 10),
        supplier_id: supp.id, supplier_name: supp.name,
        status: "received",
        amount, tax_amount: tax, total: Math.round((amount + tax) * 100) / 100,
        currency: "RSD", legal_entity_id: le,
        created_at: today.toISOString(),
      });
    }
    if (siRows.length) {
      await sb.from("supplier_invoices").insert(siRows);
      L(`Supplier invoices: ${siRows.length}`);
    }

    // ── 3. Journal Entries (1-2 balanced) ──
    if (fpId) {
      const jeRows: any[] = [];
      const jlRows: any[] = [];
      for (let i = 0; i < randInt(1, 2); i++) {
        const jeId = uuid();
        const amount = randAmount(10000, 200000);
        const tax = Math.round(amount * 0.2 * 100) / 100;
        const total = Math.round((amount + tax) * 100) / 100;
        jeRows.push({
          id: jeId, tenant_id: TENANT_ID,
          entry_number: `JE-DAILY-${todayStr.replace(/-/g, "")}-${i + 1}`,
          entry_date: todayStr, description: `Dnevni knjiženje ${todayStr}`,
          status: "posted", fiscal_period_id: fpId,
          posted_at: today.toISOString(), legal_entity_id: le, source: "manual",
        });
        jlRows.push(
          { id: uuid(), journal_entry_id: jeId, account_id: "ed5dc8cc-2d7a-4f15-8232-70e9900e59bf", debit: total, credit: 0, description: "Kupac", sort_order: 1 },
          { id: uuid(), journal_entry_id: jeId, account_id: "b2ad54e3-9f5c-4c29-9658-710a3ceca24c", debit: 0, credit: amount, description: "Prihod", sort_order: 2 },
          { id: uuid(), journal_entry_id: jeId, account_id: "d0fb101a-7342-40d6-b863-c139f3e328a1", debit: 0, credit: tax, description: "PDV", sort_order: 3 },
        );
      }
      await sb.from("journal_entries").insert(jeRows);
      await sb.from("journal_lines").insert(jlRows);
      L(`Journal entries: ${jeRows.length}`);
    }

    // ── 4. POS Session + Transactions (3-5) ──
    if (locations?.length && fiscalDevices?.length && warehouses?.length) {
      const locIdx = today.getDate() % Math.min(locations.length, 3);
      const sessionId = uuid();
      const openTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0);
      const closeTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0);
      
      await sb.from("pos_sessions").insert({
        id: sessionId, tenant_id: TENANT_ID,
        location_id: locations[locIdx].id,
        fiscal_device_id: fiscalDevices[Math.min(locIdx, fiscalDevices.length - 1)].id,
        warehouse_id: warehouses[Math.min(locIdx, warehouses.length - 1)].id,
        opened_at: openTime.toISOString(), closed_at: closeTime.toISOString(),
        opening_balance: 5000, closing_balance: 5000 + randAmount(10000, 50000),
        status: "closed",
      });

      const numTx = randInt(3, 5);
      const txRows: any[] = [];
      for (let i = 0; i < numTx; i++) {
        const prod = pick(products);
        const total = randAmount(500, 15000);
        const tax = Math.round(total / 6 * 100) / 100;
        txRows.push({
          id: uuid(), tenant_id: TENANT_ID, session_id: sessionId,
          transaction_number: `TX-DAILY-${todayStr.replace(/-/g, "")}-${i + 1}`,
          total, subtotal: Math.round((total - tax) * 100) / 100, tax_amount: tax,
          payment_method: pick(["cash", "card"]),
          status: "completed", receipt_type: "normal", is_fiscal: true,
          items: [{ product_id: prod.id, name: prod.name, quantity: randInt(1, 3), price: total, total }],
          location_id: locations[locIdx].id,
          fiscal_device_id: fiscalDevices[Math.min(locIdx, fiscalDevices.length - 1)].id,
          warehouse_id: warehouses[Math.min(locIdx, warehouses.length - 1)].id,
          created_at: new Date(openTime.getTime() + randInt(0, 11 * 3600000)).toISOString(),
        });
      }
      await sb.from("pos_transactions").insert(txRows);
      
      // POS daily report
      const totalSales = txRows.reduce((s, tx) => s + tx.total, 0);
      const cashSales = txRows.filter(tx => tx.payment_method === "cash").reduce((s, tx) => s + tx.total, 0);
      await sb.from("pos_daily_reports").insert({
        tenant_id: TENANT_ID, session_id: sessionId,
        location_id: locations[locIdx].id,
        report_date: todayStr,
        total_sales: Math.round(totalSales * 100) / 100,
        net_sales: Math.round(totalSales * 100) / 100,
        cash_total: Math.round(cashSales * 100) / 100,
        card_total: Math.round((totalSales - cashSales) * 100) / 100,
        other_total: 0, total_refunds: 0,
        transaction_count: numTx, refund_count: 0,
      });
      L(`POS: 1 session, ${numTx} transactions, 1 report`);
    }

    // ── 5. Inventory Movements (2-5) ──
    if (warehouses?.length) {
      const movRows: any[] = [];
      for (let i = 0; i < randInt(2, 5); i++) {
        const prod = pick(products);
        const type = pick(["in", "out", "out"]);
        movRows.push({
          id: uuid(), tenant_id: TENANT_ID,
          product_id: prod.id, warehouse_id: pick(warehouses).id,
          movement_type: type, quantity: randInt(1, 20),
          unit_cost: Number(prod.default_purchase_price || 1000),
          reference: `DAILY-${todayStr}`,
          created_at: today.toISOString(),
        });
      }
      await sb.from("inventory_movements").insert(movRows);
      L(`Inventory movements: ${movRows.length}`);
    }

    // ── 6. CRM Activity (1-2) ──
    if (companies?.length && contacts?.length) {
      const actRows: any[] = [];
      for (let i = 0; i < randInt(1, 2); i++) {
        actRows.push({
          id: uuid(), tenant_id: TENANT_ID,
          type: pick(["call", "email", "meeting", "note"]),
          description: pick(["Follow-up poziv", "Slanje ponude", "Prezentacija", "Dogovor o isporuci"]),
          company_id: pick(companies).id,
          contact_id: pick(contacts).id,
          created_at: today.toISOString(),
        });
      }
      await sb.from("activities").insert(actRows);
      L(`CRM activities: ${actRows.length}`);
    }

    return new Response(JSON.stringify({ success: true, date: todayStr, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("daily-data-seed error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
