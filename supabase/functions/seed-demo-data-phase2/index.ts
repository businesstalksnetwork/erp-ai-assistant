import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOW = new Date();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(sbUrl, sbKey);

    const { tenant_id } = await req.json().catch(() => ({ tenant_id: null }));

    let tenantId = tenant_id;
    if (!tenantId) {
      const { data: t } = await sb.from("tenants").select("id").limit(1).single();
      if (!t) throw new Error("No tenant found");
      tenantId = t.id;
    }

    const log: string[] = [];
    const L = (msg: string) => { log.push(msg); console.log(msg); };

    // Fetch reference data
    const [
      { data: employees },
      { data: products },
      { data: purchaseOrders },
      { data: productionOrders },
      { data: warehouses },
      { data: companies },
      { data: contacts },
      { data: leads },
      { data: opportunities },
      { data: posSessions },
      { data: pdvPeriods },
      { data: invoices },
      { data: supplierInvoices },
      { data: assetAccounts },
      { data: allowanceTypes },
      { data: costCenters },
    ] = await Promise.all([
      sb.from("employees").select("id, first_name, last_name").eq("tenant_id", tenantId).limit(25),
      sb.from("products").select("id, name, default_purchase_price").eq("tenant_id", tenantId).limit(30),
      sb.from("purchase_orders").select("id").eq("tenant_id", tenantId).limit(200),
      sb.from("production_orders").select("id").eq("tenant_id", tenantId).limit(200),
      sb.from("warehouses").select("id").eq("tenant_id", tenantId).limit(5),
      sb.from("companies").select("id").eq("tenant_id", tenantId).limit(10),
      sb.from("contacts").select("id").eq("tenant_id", tenantId).limit(10),
      sb.from("leads").select("id").eq("tenant_id", tenantId).limit(10),
      sb.from("opportunities").select("id").eq("tenant_id", tenantId).limit(10),
      sb.from("pos_sessions").select("id, location_id, opened_at").eq("tenant_id", tenantId).limit(500),
      sb.from("pdv_periods").select("id, start_date, end_date").eq("tenant_id", tenantId).order("start_date").limit(20),
      sb.from("invoices").select("id, invoice_number, invoice_date, total, tax_amount").eq("tenant_id", tenantId).limit(100),
      sb.from("supplier_invoices").select("id, invoice_number, invoice_date, total, tax_amount").eq("tenant_id", tenantId).limit(100),
      sb.from("chart_of_accounts").select("id").eq("tenant_id", tenantId).eq("account_type", "asset").limit(5),
      sb.from("allowance_types").select("id").eq("tenant_id", tenantId).limit(5),
      sb.from("cost_centers").select("id").eq("tenant_id", tenantId).limit(5),
    ]);

    if (!employees?.length) throw new Error("No employees found");
    if (!products?.length) throw new Error("No products found");

    const empIds = employees.map((e: any) => e.id);
    const prodIds = products.map((p: any) => p.id);
    const whId = warehouses?.[0]?.id;

    // ── 1. Holidays (2025 + 2026, tenant-specific) ──
    {
      await sb.from("holidays").delete().eq("tenant_id", tenantId);
      const holidays: any[] = [];
      for (const yr of [2025, 2026]) {
        holidays.push(
          { name: "Nova Godina", date: `${yr}-01-01`, is_recurring: true, tenant_id: tenantId },
          { name: "Nova Godina 2", date: `${yr}-01-02`, is_recurring: true, tenant_id: tenantId },
          { name: "Božić", date: `${yr}-01-07`, is_recurring: true, tenant_id: tenantId },
          { name: "Sretenje", date: `${yr}-02-15`, is_recurring: true, tenant_id: tenantId },
          { name: "Sretenje 2", date: `${yr}-02-16`, is_recurring: true, tenant_id: tenantId },
          { name: "Praznik rada", date: `${yr}-05-01`, is_recurring: true, tenant_id: tenantId },
          { name: "Praznik rada 2", date: `${yr}-05-02`, is_recurring: true, tenant_id: tenantId },
          { name: "Vidovdan", date: `${yr}-06-28`, is_recurring: true, tenant_id: tenantId },
          { name: "Primirje", date: `${yr}-11-11`, is_recurring: true, tenant_id: tenantId },
          { name: "Badnji dan", date: `${yr}-12-24`, is_recurring: false, tenant_id: tenantId },
        );
      }
      const { error } = await sb.from("holidays").insert(holidays);
      L(error ? `Holidays ERROR: ${error.message}` : `Holidays: ${holidays.length}`);
    }

    // ── 2. PDV Entries ──
    if (pdvPeriods?.length && invoices?.length) {
      await sb.from("pdv_entries").delete().eq("tenant_id", tenantId);
      const entries: any[] = [];
      for (const inv of invoices.slice(0, 50)) {
        const invDate = new Date(inv.invoice_date);
        const monthIdx = (invDate.getFullYear() - 2025) * 12 + invDate.getMonth();
        const period = pdvPeriods[Math.min(monthIdx, pdvPeriods.length - 1)];
        if (!period) continue;
        const base = Number(inv.total) - Number(inv.tax_amount);
        entries.push({
          tenant_id: tenantId, pdv_period_id: period.id,
          popdv_section: "3.1", document_type: "invoice",
          document_id: inv.id, document_number: inv.invoice_number,
          document_date: inv.invoice_date, base_amount: base,
          vat_amount: Number(inv.tax_amount), vat_rate: 20, direction: "output",
        });
      }
      for (const si of (supplierInvoices || []).slice(0, 50)) {
        const siDate = new Date(si.invoice_date);
        const monthIdx = (siDate.getFullYear() - 2025) * 12 + siDate.getMonth();
        const period = pdvPeriods[Math.min(monthIdx, pdvPeriods.length - 1)];
        if (!period) continue;
        const base = Number(si.total) - Number(si.tax_amount);
        entries.push({
          tenant_id: tenantId, pdv_period_id: period.id,
          popdv_section: "8.1", document_type: "supplier_invoice",
          document_id: si.id, document_number: si.invoice_number,
          document_date: si.invoice_date, base_amount: base,
          vat_amount: Number(si.tax_amount), vat_rate: 20, direction: "input",
        });
      }
      if (entries.length) {
        const { error } = await sb.from("pdv_entries").insert(entries);
        L(error ? `PDV entries ERROR: ${error.message}` : `PDV entries: ${entries.length}`);
      }
    }

    // ── 3. Purchase Order Lines ──
    if (purchaseOrders?.length && products?.length) {
      const { count } = await sb.from("purchase_order_lines").select("id", { count: "exact", head: true });
      if (!count || count < 10) {
        const batchSize = 50;
        let totalLines = 0;
        for (let b = 0; b < purchaseOrders.length; b += batchSize) {
          const batch = purchaseOrders.slice(b, b + batchSize);
          const lines: any[] = [];
          for (const po of batch) {
            const numLines = 1 + Math.floor(Math.random() * 3);
            for (let j = 0; j < numLines; j++) {
              const prod = products[Math.floor(Math.random() * products.length)];
              const qty = 1 + Math.floor(Math.random() * 20);
              const price = Number(prod.default_purchase_price || 1000) + Math.random() * 5000;
              lines.push({
                purchase_order_id: po.id, product_id: prod.id,
                description: prod.name, quantity: qty,
                unit_price: Math.round(price * 100) / 100,
                total: Math.round(qty * price * 100) / 100, sort_order: j,
              });
            }
          }
          const { error } = await sb.from("purchase_order_lines").insert(lines);
          if (error) { L(`PO lines batch ERROR: ${error.message}`); break; }
          totalLines += lines.length;
        }
        L(`PO lines: ${totalLines}`);
      } else {
        L(`PO lines: already ${count}`);
      }
    }

    // ── 4. BOM Templates + Lines ──
    if (products?.length) {
      const { data: existingBoms } = await sb.from("bom_templates").select("id").eq("tenant_id", tenantId).limit(20);
      const bomIds = existingBoms?.map((b: any) => b.id) || [];
      
      if (bomIds.length < 5) {
        const templates: any[] = [];
        for (let i = 0; i < 20; i++) {
          templates.push({
            tenant_id: tenantId, product_id: prodIds[i % prodIds.length],
            name: `BOM-${products[i % products.length].name}`,
            is_active: true, version: 1,
          });
        }
        const { data: bomData, error: bomErr } = await sb.from("bom_templates").insert(templates).select("id");
        if (bomErr) { L(`BOM templates ERROR: ${bomErr.message}`); }
        else {
          bomIds.push(...bomData.map((b: any) => b.id));
          L(`BOM templates: ${bomData.length}`);
        }
      }

      const { count: blCount } = await sb.from("bom_lines").select("id", { count: "exact", head: true });
      if ((!blCount || blCount < 5) && bomIds.length) {
        const bomLines: any[] = [];
        for (const bomId of bomIds) {
          const numMats = 2 + Math.floor(Math.random() * 3);
          for (let j = 0; j < numMats; j++) {
            bomLines.push({
              bom_template_id: bomId,
              material_product_id: prodIds[(j + 5) % prodIds.length],
              quantity: 1 + Math.floor(Math.random() * 10),
              unit: "kom", sort_order: j,
            });
          }
        }
        const { error: blErr } = await sb.from("bom_lines").insert(bomLines);
        L(blErr ? `BOM lines ERROR: ${blErr.message}` : `BOM lines: ${bomLines.length}`);
      }

      if (productionOrders?.length && bomIds.length) {
        const { data: unlinked } = await sb.from("production_orders").select("id").eq("tenant_id", tenantId).is("bom_template_id", null).limit(200);
        if (unlinked?.length) {
          for (let i = 0; i < unlinked.length; i++) {
            await sb.from("production_orders").update({ bom_template_id: bomIds[i % bomIds.length] }).eq("id", unlinked[i].id);
          }
          L(`Production orders linked to BOM: ${unlinked.length}`);
        }
      }
    }

    // ── 5. Production Consumption ──
    if (productionOrders?.length && products?.length && whId) {
      const { count: pcCount } = await sb.from("production_consumption").select("id", { count: "exact", head: true });
      if (!pcCount || pcCount < 5) {
        const rows: any[] = [];
        for (const po of productionOrders.slice(0, 100)) {
          const numMats = 2 + Math.floor(Math.random() * 2);
          for (let j = 0; j < numMats; j++) {
            rows.push({
              production_order_id: po.id,
              product_id: prodIds[(j + 3) % prodIds.length],
              warehouse_id: whId,
              quantity_consumed: 1 + Math.floor(Math.random() * 10),
            });
          }
        }
        for (let b = 0; b < rows.length; b += 100) {
          const { error } = await sb.from("production_consumption").insert(rows.slice(b, b + 100));
          if (error) { L(`Prod consumption ERROR: ${error.message}`); break; }
        }
        L(`Production consumption: ${rows.length}`);
      }
    }

    // ── 6. Fixed Assets ──
    if (assetAccounts?.length) {
      const { count: faCount } = await sb.from("fixed_assets").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
      if (!faCount || faCount < 5) {
        const assets = [
          { name: "Laptop Dell Latitude #1", cost: 180000, life: 36 },
          { name: "Laptop Dell Latitude #2", cost: 180000, life: 36 },
          { name: "Server Dell PowerEdge", cost: 650000, life: 60 },
          { name: "UPS APC 3000VA", cost: 85000, life: 60 },
          { name: "Switch Cisco 24-port", cost: 45000, life: 60 },
          { name: "Firewall FortiGate", cost: 120000, life: 48 },
          { name: "Klimatizacija kancelarija", cost: 250000, life: 120 },
          { name: "Kancelarijski nameštaj set #1", cost: 350000, life: 120 },
          { name: "Kancelarijski nameštaj set #2", cost: 280000, life: 120 },
          { name: "Fiat Doblo - dostava", cost: 2500000, life: 60 },
          { name: "Toyota Yaris - službeno", cost: 2200000, life: 60 },
          { name: "Printer HP LaserJet", cost: 65000, life: 48 },
          { name: "Projektor Epson", cost: 95000, life: 60 },
          { name: "Telefonska centrala", cost: 180000, life: 84 },
          { name: "Video nadzor sistem", cost: 320000, life: 60 },
          { name: "Protivpožarni sistem", cost: 450000, life: 120 },
          { name: "Skladišni regali", cost: 280000, life: 120 },
          { name: "Viljuškar Toyota", cost: 3500000, life: 120 },
          { name: "Kompresor Atlas Copco", cost: 750000, life: 120 },
          { name: "CNC mašina", cost: 8500000, life: 120 },
        ].map((a, i) => ({
          tenant_id: tenantId, name: a.name,
          acquisition_date: `2025-0${1 + (i % 6)}-${10 + (i % 15)}`,
          acquisition_cost: a.cost, useful_life_months: a.life,
          depreciation_method: "straight_line", salvage_value: Math.round(a.cost * 0.05),
          status: "active", account_id: assetAccounts[i % assetAccounts.length].id,
        }));
        const { error } = await sb.from("fixed_assets").insert(assets);
        L(error ? `Fixed assets ERROR: ${error.message}` : `Fixed assets: ${assets.length}`);
      }
    }

    // ── 7. Leave Requests (2025 + 2026) ──
    {
      const { count: lrCount } = await sb.from("leave_requests").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
      if (!lrCount || lrCount < 5) {
        const leaveTypes = ["vacation", "sick", "personal", "vacation", "vacation"];
        const statuses = ["approved", "approved", "approved", "pending", "rejected"];
        const requests: any[] = [];
        for (let i = 0; i < 60; i++) {
          const emp = empIds[i % empIds.length];
          const yr = i < 48 ? 2025 : 2026;
          const month = yr === 2026 ? 1 + Math.floor(Math.random() * 2) : 1 + (i % 12);
          const day = 1 + Math.floor(Math.random() * 20);
          const days = 1 + Math.floor(Math.random() * 10);
          const startDate = `${yr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const endDay = Math.min(day + days, 28);
          const endDate = `${yr}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
          requests.push({
            tenant_id: tenantId, employee_id: emp,
            leave_type: leaveTypes[i % leaveTypes.length],
            start_date: startDate, end_date: endDate,
            days_count: endDay - day, reason: `Zahtev #${i + 1}`,
            status: statuses[i % statuses.length],
            vacation_year: yr,
          });
        }
        const { error } = await sb.from("leave_requests").insert(requests);
        L(error ? `Leave requests ERROR: ${error.message}` : `Leave requests: ${requests.length}`);
      }
    }

    // ── 8. Attendance Records (through current date) ──
    {
      const { count: arCount } = await sb.from("attendance_records").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
      if (!arCount || arCount < 5) {
        const statuses = ["present", "present", "present", "present", "remote", "present", "present"];
        const records: any[] = [];
        const totalDays = Math.floor((NOW.getTime() - new Date(2025, 0, 1).getTime()) / 86400000);
        for (let e = 0; e < Math.min(empIds.length, 10); e++) {
          for (let d = 0; d < Math.min(totalDays, 500); d++) {
            const date = new Date(2025, 0, 6 + d);
            const dow = date.getDay();
            if (dow === 0 || dow === 6) continue;
            if (date > NOW) break;
            const checkIn = `0${7 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}:00`;
            const checkOut = `${16 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}:00`;
            records.push({
              tenant_id: tenantId, employee_id: empIds[e],
              date: date.toISOString().split("T")[0],
              check_in: checkIn, check_out: checkOut,
              hours_worked: 8 + Math.random() * 1.5,
              status: statuses[Math.floor(Math.random() * statuses.length)],
            });
          }
        }
        for (let b = 0; b < records.length; b += 200) {
          const { error } = await sb.from("attendance_records").insert(records.slice(b, b + 200));
          if (error) { L(`Attendance ERROR batch ${b}: ${error.message}`); break; }
        }
        L(`Attendance records: ${records.length}`);
      }
    }

    // ── 9. Payroll Runs + Items (2025 + 2026) ──
    {
      const { count: prCount } = await sb.from("payroll_runs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
      if (!prCount || prCount < 5) {
        const payrollMonths: Array<{m: number, yr: number}> = [];
        for (let m = 1; m <= 12; m++) payrollMonths.push({ m, yr: 2025 });
        for (let m = 1; m <= NOW.getMonth() + 1; m++) payrollMonths.push({ m, yr: 2026 });

        const runs: any[] = [];
        for (const { m, yr } of payrollMonths) {
          let status: string;
          if (yr === 2025) {
            status = m <= 10 ? "paid" : m === 11 ? "approved" : "draft";
          } else {
            status = m < NOW.getMonth() + 1 ? "paid" : "draft";
          }
          runs.push({
            tenant_id: tenantId, period_month: m, period_year: yr,
            status, total_gross: 0, total_net: 0, total_taxes: 0, total_contributions: 0,
          });
        }
        const { data: runData, error: runErr } = await sb.from("payroll_runs").insert(runs).select("id, period_month, period_year");
        if (runErr) { L(`Payroll runs ERROR: ${runErr.message}`); }
        else {
          L(`Payroll runs: ${runData.length}`);
          const items: any[] = [];
          for (const run of runData) {
            for (const empId of empIds) {
              const gross = 80000 + Math.floor(Math.random() * 120000);
              const taxBase = gross - 25000;
              const tax = Math.round(taxBase * 0.10);
              const pension = Math.round(gross * 0.14);
              const health = Math.round(gross * 0.0515);
              const unemp = Math.round(gross * 0.0075);
              const net = gross - tax - pension - health - unemp;
              const pensionEmp = Math.round(gross * 0.10);
              const healthEmp = Math.round(gross * 0.0515);
              items.push({
                payroll_run_id: run.id, employee_id: empId,
                gross_salary: gross, taxable_base: taxBase,
                income_tax: tax, pension_contribution: pension,
                health_contribution: health, unemployment_contribution: unemp,
                net_salary: net, total_cost: gross + pensionEmp + healthEmp,
                working_days: 22, actual_working_days: 20 + Math.floor(Math.random() * 3),
                pension_employer: pensionEmp, health_employer: healthEmp,
              });
            }
          }
          for (let b = 0; b < items.length; b += 100) {
            const { error } = await sb.from("payroll_items").insert(items.slice(b, b + 100));
            if (error) { L(`Payroll items ERROR batch ${b}: ${error.message}`); break; }
          }
          L(`Payroll items: ${items.length}`);

          for (const run of runData) {
            const runItems = items.filter(i => i.payroll_run_id === run.id);
            const totals = runItems.reduce((acc, i) => ({
              total_gross: acc.total_gross + i.gross_salary,
              total_net: acc.total_net + i.net_salary,
              total_taxes: acc.total_taxes + i.income_tax,
              total_contributions: acc.total_contributions + i.pension_contribution + i.health_contribution + i.unemployment_contribution,
            }), { total_gross: 0, total_net: 0, total_taxes: 0, total_contributions: 0 });
            await sb.from("payroll_runs").update(totals).eq("id", run.id);
          }
          L(`Payroll run totals updated`);
        }
      }
    }

    // ── 10. Allowances ──
    {
      let atIds = allowanceTypes?.map((a: any) => a.id) || [];
      if (!atIds.length) {
        const atRows = [
          { tenant_id: tenantId, code: "TOPLI_OBROK", name: "Topli obrok" },
          { tenant_id: tenantId, code: "PREVOZ", name: "Prevoz na posao" },
          { tenant_id: tenantId, code: "REGRES", name: "Regres za godišnji odmor" },
          { tenant_id: tenantId, code: "MINULI_RAD", name: "Minuli rad" },
          { tenant_id: tenantId, code: "TERENSKI_RAD", name: "Terenski dodatak" },
        ];
        const { data: atData, error: atErr } = await sb.from("allowance_types").insert(atRows).select("id");
        if (atErr) { L(`Allowance types ERROR: ${atErr.message}`); }
        else { atIds = atData.map((a: any) => a.id); L(`Allowance types: ${atData.length}`); }
      }
      if (atIds.length) {
        const { count: alCount } = await sb.from("allowances").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
        if (!alCount || alCount < 5) {
          const rows: any[] = [];
          for (let i = 0; i < 60; i++) {
            const yr = i < 48 ? 2025 : 2026;
            rows.push({
              tenant_id: tenantId,
              employee_id: empIds[i % empIds.length],
              allowance_type_id: atIds[i % atIds.length],
              amount: 5000 + Math.floor(Math.random() * 15000),
              month: yr === 2026 ? 1 + (i % 2) : 1 + (i % 12), year: yr,
            });
          }
          const { error } = await sb.from("allowances").insert(rows);
          L(error ? `Allowances ERROR: ${error.message}` : `Allowances: ${rows.length}`);
        }
      }
    }

    // ── 11. Deductions ──
    {
      const { count: deCount } = await sb.from("deductions").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
      if (!deCount || deCount < 5) {
        const types = ["loan_repayment", "advance", "union_fee", "insurance"];
        const rows: any[] = [];
        for (let i = 0; i < 30; i++) {
          rows.push({
            tenant_id: tenantId,
            employee_id: empIds[i % empIds.length],
            type: types[i % types.length],
            description: `${types[i % types.length]} za ${employees[i % employees.length].first_name}`,
            total_amount: 50000 + Math.floor(Math.random() * 200000),
            paid_amount: Math.floor(Math.random() * 50000),
            start_date: `2025-0${1 + (i % 6)}-01`,
            is_active: i < 25,
          });
        }
        const { error } = await sb.from("deductions").insert(rows);
        L(error ? `Deductions ERROR: ${error.message}` : `Deductions: ${rows.length}`);
      }
    }

    // ── 12. Overtime Hours ──
    {
      const { count: otCount } = await sb.from("overtime_hours").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
      if (!otCount || otCount < 5) {
        const rows: any[] = [];
        for (let i = 0; i < 50; i++) {
          const yr = i < 40 ? 2025 : 2026;
          rows.push({
            tenant_id: tenantId,
            employee_id: empIds[i % empIds.length],
            year: yr, month: yr === 2026 ? 1 + (i % 2) : 1 + (i % 12),
            hours: 2 + Math.floor(Math.random() * 20),
            tracking_type: i % 3 === 0 ? "night" : "overtime",
          });
        }
        const { error } = await sb.from("overtime_hours").insert(rows);
        L(error ? `Overtime ERROR: ${error.message}` : `Overtime hours: ${rows.length}`);
      }
    }

    // ── 13. Insurance Records ──
    {
      const { count: irCount } = await sb.from("insurance_records").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
      if (!irCount || irCount < 5) {
        const rows: any[] = [];
        for (let i = 0; i < empIds.length; i++) {
          const emp = employees[i];
          rows.push({
            tenant_id: tenantId, employee_id: emp.id,
            first_name: emp.first_name, last_name: emp.last_name,
            jmbg: `${1000000000000 + i}`,
            insurance_start: "2025-01-01", registration_date: "2025-01-01",
          });
        }
        const { error } = await sb.from("insurance_records").insert(rows);
        L(error ? `Insurance ERROR: ${error.message}` : `Insurance records: ${rows.length}`);
      }
    }

    // ── 14. Activities ──
    if (companies?.length) {
      const { count: actCount } = await sb.from("activities").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
      if (!actCount || actCount < 5) {
        const types = ["call", "email", "meeting", "note", "task"];
        const descriptions = [
          "Razgovor o novoj narudžbini", "Slanje ponude emailom",
          "Sastanak u kancelariji", "Interna beleška", "Praćenje isporuke",
          "Dogovor o uslovima plaćanja", "Reklamacija proizvoda",
          "Prezentacija novih proizvoda", "Follow-up poziv", "Potpisivanje ugovora",
        ];
        const rows: any[] = [];
        for (let i = 0; i < 200; i++) {
          const row: any = {
            tenant_id: tenantId,
            type: types[i % types.length],
            description: descriptions[i % descriptions.length],
          };
          if (i % 4 === 0 && companies?.length) row.company_id = companies[i % companies.length].id;
          if (i % 4 === 1 && contacts?.length) row.contact_id = contacts[i % contacts.length].id;
          if (i % 4 === 2 && leads?.length) row.lead_id = leads[i % leads.length].id;
          if (i % 4 === 3 && opportunities?.length) row.opportunity_id = opportunities[i % opportunities.length].id;
          rows.push(row);
        }
        for (let b = 0; b < rows.length; b += 100) {
          const { error } = await sb.from("activities").insert(rows.slice(b, b + 100));
          if (error) { L(`Activities ERROR batch ${b}: ${error.message}`); break; }
        }
        L(`Activities: ${rows.length}`);
      }
    }

    // ── 15. Meetings (2025 + 2026) ──
    {
      const { count: mtCount } = await sb.from("meetings").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
      if (!mtCount || mtCount < 5) {
        const rows: any[] = [];
        for (let i = 0; i < 35; i++) {
          const yr = i < 25 ? 2025 : 2026;
          const month = yr === 2026 ? 1 + (i % 2) : 1 + (i % 12);
          const day = 1 + Math.floor(Math.random() * 25);
          const hour = 9 + Math.floor(Math.random() * 8);
          rows.push({
            tenant_id: tenantId,
            title: `Sastanak ${i + 1} - ${["Prodaja", "Projekat", "Revizija", "Planiranje", "Kick-off"][i % 5]}`,
            description: `Poslovni sastanak #${i + 1}`,
            scheduled_at: `${yr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00Z`,
            duration_minutes: [30, 60, 90, 120][i % 4],
            location: ["Kancelarija", "Online", "Sala A", "Sala B", "Kod klijenta"][i % 5],
            status: i < 20 ? "completed" : i < 30 ? "scheduled" : "cancelled",
          });
        }
        const { error } = await sb.from("meetings").insert(rows);
        L(error ? `Meetings ERROR: ${error.message}` : `Meetings: ${rows.length}`);
      }
    }

    // ── 16. POS Daily Reports ──
    if (posSessions?.length) {
      const { count: posCount } = await sb.from("pos_daily_reports").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
      if (!posCount || posCount < 10) {
        const reports: any[] = [];
        for (let i = 0; i < Math.min(posSessions.length, 500); i++) {
          const session = posSessions[i];
          const totalSales = 20000 + Math.floor(Math.random() * 80000);
          const refunds = Math.floor(Math.random() * 3000);
          const netSales = totalSales - refunds;
          const cashPct = 0.3 + Math.random() * 0.4;
          const cashTotal = Math.round(netSales * cashPct);
          const cardTotal = netSales - cashTotal;
          const reportDate = session.opened_at ? session.opened_at.split("T")[0] : `2025-01-${String(1 + (i % 28)).padStart(2, "0")}`;
          reports.push({
            tenant_id: tenantId, session_id: session.id,
            location_id: session.location_id, report_date: reportDate,
            total_sales: totalSales, total_refunds: refunds, net_sales: netSales,
            cash_total: cashTotal, card_total: cardTotal, other_total: 0,
            transaction_count: 10 + Math.floor(Math.random() * 40),
            refund_count: Math.floor(Math.random() * 3),
            tax_breakdown: { "20%": Math.round(netSales * 0.1667), "10%": 0 },
            opening_float: 10000,
            actual_cash_count: cashTotal + 10000 + Math.floor(Math.random() * 500) - 250,
            cash_variance: Math.floor(Math.random() * 500) - 250,
          });
        }
        for (let b = 0; b < reports.length; b += 100) {
          const { error } = await sb.from("pos_daily_reports").insert(reports.slice(b, b + 100));
          if (error) { L(`POS reports ERROR batch ${b}: ${error.message}`); break; }
        }
        L(`POS daily reports: ${reports.length}`);
      }
    }

    // ── 17. Payroll Parameters (extended to 2026) ──
    {
      const ppRows = [{
        tenant_id: tenantId,
        effective_from: "2025-01-01", effective_to: "2026-12-31",
        nontaxable_amount: 25000, tax_rate: 10,
        pio_employee_rate: 14, health_employee_rate: 5.15, unemployment_employee_rate: 0.75,
        pio_employer_rate: 10, health_employer_rate: 5.15,
        min_contribution_base: 40880, max_contribution_base: 584580,
        gazette_reference: "Sl. glasnik RS 88/2024",
      }];
      const { error } = await sb.from("payroll_parameters").insert(ppRows);
      L(`17. Inserted ${error ? 'ERR: ' + error.message : ppRows.length} payroll_parameters`);
    }

    return new Response(JSON.stringify({ success: true, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
