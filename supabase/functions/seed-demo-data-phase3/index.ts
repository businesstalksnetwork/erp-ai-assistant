import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tenantId = "92474a4b-ff91-48da-b111-89924e70b8b8";
    const log: string[] = [];
    const L = (msg: string) => { log.push(msg); console.log(msg); };

    // ============ LOAD EXISTING IDS ============
    const ids = async (table: string, cols = "id", limit = 1000) => {
      const { data } = await sb.from(table).select(cols).eq("tenant_id", tenantId).limit(limit);
      return data ?? [];
    };
    const idsNoTenant = async (table: string, cols = "id", limit = 1000) => {
      const { data } = await sb.from(table).select(cols).limit(limit);
      return data ?? [];
    };

    const contacts = await ids("contacts");
    const salespeople = await ids("salespeople");
    const leads = await ids("leads");
    const employees = await ids("employees");
    const departments = await ids("departments");
    const posTemplates = await idsNoTenant("position_templates");
    const bankStatements = await ids("bank_statements", "id, statement_date");
    const fixedAssets = await ids("fixed_assets", "id, acquisition_cost, useful_life_months, salvage_value, acquisition_date");
    const loans = await ids("loans", "id, principal, interest_rate, start_date, term_months");
    const meetings = await ids("meetings");
    const openItems = await ids("open_items", "id, remaining_amount, direction");
    const products = await ids("products", "id, default_sale_price, name");
    const warehouses = await ids("warehouses");
    const wmsZones = await ids("wms_zones");
    const wmsBins = await ids("wms_bins", "id, zone_id, code");
    const invoices = await ids("invoices", "id, total, partner_id");
    const purchaseOrders = await ids("purchase_orders", "id, supplier_id");
    const supplierInvoices = await ids("supplier_invoices", "id, purchase_order_id, supplier_id");
    const opportunities = await ids("opportunities");
    const userRoles = await ids("user_roles", "user_id");

    // ============ 1. FIX OPPORTUNITIES (idempotent - updates are safe to re-run) ============
    const contactIds = contacts.map(c => c.id);
    const spIds = salespeople.map(s => s.id);
    const leadIds = leads.map(l => l.id);
    // Only update if still null
    const { data: nullOpps } = await sb.from("opportunities").select("id").eq("tenant_id", tenantId).is("contact_id", null).limit(200);
    if (nullOpps?.length && contactIds.length && spIds.length && leadIds.length) {
      for (let i = 0; i < nullOpps.length; i++) {
        await sb.from("opportunities").update({
          contact_id: contactIds[i % contactIds.length],
          salesperson_id: spIds[i % spIds.length],
          lead_id: leadIds[i % leadIds.length],
        }).eq("id", nullOpps[i].id);
      }
      L(`1. Updated ${nullOpps.length} opportunities`);
    } else {
      L(`1. SKIP - opportunities already linked`);
    }

    // ============ 2. FIX SUPPLIER_INVOICES ============
    const poIds = purchaseOrders.map(p => p.id);
    const unlinkedSI = supplierInvoices.filter(si => !si.purchase_order_id);
    const toLink = Math.min(unlinkedSI.length, poIds.length > 0 ? 200 : 0);
    for (let i = 0; i < toLink; i++) {
      await sb.from("supplier_invoices").update({
        purchase_order_id: poIds[i % poIds.length],
      }).eq("id", unlinkedSI[i].id);
    }
    L(`2. Linked ${toLink} supplier_invoices to purchase_orders`);

    // ============ 3. DEPARTMENT POSITIONS ============
    {
      const { data: existDP } = await sb.from("department_positions").select("id").limit(1);
      if (!existDP?.length && departments.length && posTemplates.length) {
        const dpRows: any[] = [];
        for (const dept of departments) {
          const templates = posTemplates.slice(0, Math.min(3, posTemplates.length));
          for (const pt of templates) {
            dpRows.push({ department_id: dept.id, position_template_id: pt.id, headcount: Math.ceil(Math.random() * 3) });
          }
        }
        const { error } = await sb.from("department_positions").insert(dpRows);
        L(`3. Inserted ${error ? 'ERR: ' + error.message : dpRows.length} department_positions`);
      } else { L(`3. SKIP - department_positions exist`); }
    }

    // ============ 4. ATTENDANCE FOR REMAINING EMPLOYEES ============
    {
      const { data: coveredEmps } = await sb.from("attendance_records").select("employee_id").eq("tenant_id", tenantId);
      const coveredSet = new Set((coveredEmps ?? []).map(r => r.employee_id));
      const uncovered = employees.filter(e => !coveredSet.has(e.id));
      const attRows: any[] = [];
      const statuses: ("present" | "late" | "absent" | "remote")[] = ["present", "present", "present", "present", "late", "remote"];
      for (const emp of uncovered) {
        for (let d = 0; d < 22; d++) { // ~1 month of workdays
          const date = new Date(2025, 0, 6 + d + Math.floor(d / 5) * 2); // skip weekends roughly
          if (date.getDay() === 0 || date.getDay() === 6) continue;
          const st = statuses[Math.floor(Math.random() * statuses.length)];
          attRows.push({
            tenant_id: tenantId, employee_id: emp.id,
            date: date.toISOString().split("T")[0],
            status: st,
            check_in: st !== "absent" ? `${7 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}` : null,
            check_out: st !== "absent" ? `${15 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}` : null,
            hours_worked: st !== "absent" ? 7 + Math.random() * 2 : 0,
          });
        }
      }
      if (attRows.length) {
        // batch insert
        for (let i = 0; i < attRows.length; i += 100) {
          await sb.from("attendance_records").insert(attRows.slice(i, i + 100));
        }
        L(`4. Inserted ${attRows.length} attendance_records for ${uncovered.length} employees`);
      } else {
        L(`4. All employees already covered`);
      }
    }

    // ============ 5. BANK STATEMENT LINES ============
    {
      const { data: existBSL } = await sb.from("bank_statement_lines").select("id").eq("tenant_id", tenantId).limit(1);
      if (!existBSL?.length) {
        const bslRows: any[] = [];
        const descriptions = ["Uplata po fakturi", "Isplata dobavljacu", "Plata zaposlenom", "Komunalne usluge", "Zakup prostora", "Prihod od usluga", "Povrat PDV", "Avansna uplata"];
        for (const bs of bankStatements) {
          for (let i = 0; i < 10; i++) {
            const dir = i < 6 ? "credit" : "debit";
            bslRows.push({
              tenant_id: tenantId, statement_id: bs.id,
              line_date: bs.statement_date,
              description: descriptions[i % descriptions.length],
              amount: Math.round((5000 + Math.random() * 95000) * 100) / 100,
              direction: dir,
              partner_name: `Partner ${i + 1}`,
              partner_account: `265-${1000000 + Math.floor(Math.random() * 9000000)}-${10 + i}`,
              payment_reference: `97 ${Math.floor(Math.random() * 9999999999)}`,
              match_status: "unmatched",
            });
          }
        }
        const { error } = await sb.from("bank_statement_lines").insert(bslRows);
        L(`5. Inserted ${error ? 'ERR: ' + error.message : bslRows.length} bank_statement_lines`);
      } else { L(`5. SKIP - bank_statement_lines exist`); }
    }

    // ============ 6. FIXED ASSET DEPRECIATION ============
    {
      const { data: existDep } = await sb.from("fixed_asset_depreciation").select("id").eq("tenant_id", tenantId).limit(1);
      if (!existDep?.length) {
        const depRows: any[] = [];
        for (const fa of fixedAssets) {
          const cost = Number(fa.acquisition_cost) || 100000;
          const salvage = Number(fa.salvage_value) || 0;
          const months = Number(fa.useful_life_months) || 60;
          const monthlyDep = (cost - salvage) / months;
          const startDate = new Date(fa.acquisition_date || "2024-01-01");
          let accum = 0;
          for (let m = 0; m < Math.min(6, months); m++) {
            accum += monthlyDep;
            const period = new Date(startDate);
            period.setMonth(period.getMonth() + m + 1);
            depRows.push({
              tenant_id: tenantId, asset_id: fa.id,
              period: period.toISOString().split("T")[0],
              amount: Math.round(monthlyDep * 100) / 100,
              accumulated_total: Math.round(accum * 100) / 100,
            });
          }
        }
        const { error } = await sb.from("fixed_asset_depreciation").insert(depRows);
        L(`6. Inserted ${error ? 'ERR: ' + error.message : depRows.length} fixed_asset_depreciation`);
      } else { L(`6. SKIP - fixed_asset_depreciation exist`); }
    }

    // ============ 7. LOAN SCHEDULES + PAYMENTS ============
    {
      const { data: existLS } = await sb.from("loan_schedules").select("id").eq("tenant_id", tenantId).limit(1);
      if (!existLS?.length) {
        const schedRows: any[] = [];
        const payRows: any[] = [];
        for (const loan of loans) {
          const principal = Number(loan.principal) || 1000000;
          const rate = Number(loan.interest_rate) || 5;
          const months = Number(loan.term_months) || 36;
          const monthlyRate = rate / 100 / 12;
          const payment = monthlyRate > 0
            ? principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months))
            : principal / months;
          let balance = principal;
          const start = new Date(loan.start_date || "2024-01-01");
          for (let m = 1; m <= months; m++) {
            const interest = balance * monthlyRate;
            const princ = payment - interest;
            balance -= princ;
            const dueDate = new Date(start);
            dueDate.setMonth(dueDate.getMonth() + m);
            schedRows.push({
              tenant_id: tenantId, loan_id: loan.id, period_number: m,
              due_date: dueDate.toISOString().split("T")[0],
              principal_amount: Math.round(princ * 100) / 100,
              interest_amount: Math.round(interest * 100) / 100,
              total_amount: Math.round(payment * 100) / 100,
              remaining_balance: Math.max(0, Math.round(balance * 100) / 100),
              status: m <= 12 ? "paid" : "pending",
            });
            if (m <= 12) {
              payRows.push({
                tenant_id: tenantId, loan_id: loan.id, period_number: m,
                payment_date: dueDate.toISOString().split("T")[0],
                principal_amount: Math.round(princ * 100) / 100,
                interest_amount: Math.round(interest * 100) / 100,
                total_amount: Math.round(payment * 100) / 100,
              });
            }
          }
        }
        for (let i = 0; i < schedRows.length; i += 100) {
          await sb.from("loan_schedules").insert(schedRows.slice(i, i + 100));
        }
        await sb.from("loan_payments").insert(payRows);
        L(`7. Inserted ${schedRows.length} loan_schedules, ${payRows.length} loan_payments`);
      } else { L(`7. SKIP - loan_schedules exist`); }
    }

    // ============ 8. MEETING PARTICIPANTS ============
    {
      const mpRows: any[] = [];
      for (const meeting of meetings) {
        // Add 2 contacts + 1 employee as participants
        for (let i = 0; i < 2; i++) {
          const c = contacts[Math.floor(Math.random() * contacts.length)];
          mpRows.push({
            tenant_id: tenantId, meeting_id: meeting.id,
            contact_id: c.id, is_organizer: false, is_internal: false,
          });
        }
        if (employees.length) {
          const e = employees[Math.floor(Math.random() * employees.length)];
          mpRows.push({
            tenant_id: tenantId, meeting_id: meeting.id,
            employee_id: e.id, is_organizer: true, is_internal: true,
          });
        }
      }
      const { error } = await sb.from("meeting_participants").insert(mpRows);
      L(`8. Inserted ${error ? 'ERR: ' + error.message : mpRows.length} meeting_participants`);
    }

    // ============ 9. PAYROLL PARAMETERS ============
    {
      const ppRows = [{
        tenant_id: tenantId,
        effective_from: "2025-01-01", effective_to: "2025-12-31",
        nontaxable_amount: 25000, tax_rate: 10,
        pio_employee_rate: 14, health_employee_rate: 5.15, unemployment_employee_rate: 0.75,
        pio_employer_rate: 10, health_employer_rate: 5.15,
        min_contribution_base: 40880, max_contribution_base: 584580,
        gazette_reference: "Sl. glasnik RS 88/2024",
      }];
      const { error } = await sb.from("payroll_parameters").insert(ppRows);
      L(`9. Inserted ${error ? 'ERR: ' + error.message : ppRows.length} payroll_parameters`);
    }

    // ============ 10. INVENTORY COST LAYERS ============
    {
      const iclRows: any[] = [];
      const topProducts = products.slice(0, 50);
      const wh = warehouses[0];
      if (wh) {
        for (const p of topProducts) {
          for (let layer = 0; layer < 3; layer++) {
            const date = new Date(2025, layer * 2, 1);
            iclRows.push({
              tenant_id: tenantId, product_id: p.id, warehouse_id: wh.id,
              layer_date: date.toISOString().split("T")[0],
              quantity_remaining: 10 + Math.floor(Math.random() * 90),
              unit_cost: Math.round((Number(p.default_sale_price || 100) * (0.5 + Math.random() * 0.3)) * 100) / 100,
              reference: `GRN-${layer + 1}`,
            });
          }
        }
        for (let i = 0; i < iclRows.length; i += 100) {
          await sb.from("inventory_cost_layers").insert(iclRows.slice(i, i + 100));
        }
        L(`10. Inserted ${iclRows.length} inventory_cost_layers`);
      }
    }

    // ============ 11. RETAIL PRICE LISTS + PRICES ============
    {
      const { data: existingLists } = await sb.from("retail_price_lists").select("id").eq("tenant_id", tenantId);
      let listId: string;
      if (existingLists?.length) {
        listId = existingLists[0].id;
      } else {
        const { data: newList } = await sb.from("retail_price_lists").insert({
          tenant_id: tenantId, name: "Standardne maloprodajne cene", is_default: true, is_active: true,
          location_id: null,
        }).select("id").single();
        listId = newList!.id;
      }
      const rpRows: any[] = [];
      for (const p of products) {
        const basePrice = Number(p.default_sale_price || 100);
        rpRows.push({
          price_list_id: listId, product_id: p.id,
          retail_price: Math.round(basePrice * 1.3 * 100) / 100,
          markup_percent: 30,
          valid_from: "2025-01-01",
        });
      }
      for (let i = 0; i < rpRows.length; i += 100) {
        await sb.from("retail_prices").insert(rpRows.slice(i, i + 100));
      }
      L(`11. Inserted ${rpRows.length} retail_prices`);
    }

    // ============ 12. WEB PRICE LISTS + PRICES ============
    {
      const { data: existingWPL } = await sb.from("web_price_lists").select("id").eq("tenant_id", tenantId);
      let wplId: string;
      if (existingWPL?.length) {
        wplId = existingWPL[0].id;
      } else {
        const { data: newWPL } = await sb.from("web_price_lists").insert({
          tenant_id: tenantId, name: "Web prodajna lista", currency: "RSD", is_active: true,
        }).select("id").single();
        wplId = newWPL!.id;
      }
      const wpRows: any[] = [];
      const webProducts = products.slice(0, 100); // 50% of products
      for (const p of webProducts) {
        const basePrice = Number(p.default_sale_price || 100);
        wpRows.push({
          tenant_id: tenantId, web_price_list_id: wplId, product_id: p.id,
          price: Math.round(basePrice * 1.2 * 100) / 100,
          compare_at_price: Math.round(basePrice * 1.5 * 100) / 100,
        });
      }
      const { error } = await sb.from("web_prices").insert(wpRows);
      L(`12. Inserted ${error ? 'ERR: ' + error.message : wpRows.length} web_prices`);
    }

    // ============ 13. OPEN ITEM PAYMENTS ============
    {
      const payableItems = openItems.slice(0, 100);
      const oipRows: any[] = [];
      for (const oi of payableItems) {
        const amount = Number(oi.remaining_amount || 10000);
        oipRows.push({
          tenant_id: tenantId, open_item_id: oi.id,
          amount: Math.round(amount * 0.5 * 100) / 100, // 50% partial payment
          payment_date: "2025-06-15",
          payment_type: "bank_transfer",
          reference: `PAY-${Math.floor(Math.random() * 99999)}`,
        });
      }
      const { error } = await sb.from("open_item_payments").insert(oipRows);
      L(`13. Inserted ${error ? 'ERR: ' + error.message : oipRows.length} open_item_payments`);
    }

    // ============ 14. WMS AISLES ============
    {
      const { data: existAisles } = await sb.from("wms_aisles").select("id").eq("tenant_id", tenantId).limit(1);
      if (!existAisles?.length) {
        const aisleRows: any[] = [];
        for (const zone of wmsZones) {
          for (let a = 1; a <= 3; a++) {
            aisleRows.push({
              tenant_id: tenantId, zone_id: zone.id,
              name: `Hodnik ${a}`, code: `A${a}`,
              sort_order: a,
            });
          }
        }
        const { error } = await sb.from("wms_aisles").insert(aisleRows);
        L(`14. Inserted ${error ? 'ERR: ' + error.message : aisleRows.length} wms_aisles`);
      } else { L(`14. SKIP - wms_aisles exist`); }
    }

    // ============ 15. WMS BIN STOCK ============
    {
      const bsRows: any[] = [];
      const wh = warehouses[0];
      if (wh) {
        const usedBins = wmsBins.slice(0, 40);
        for (let i = 0; i < usedBins.length; i++) {
          const p = products[i % products.length];
          bsRows.push({
            tenant_id: tenantId, bin_id: usedBins[i].id,
            product_id: p.id, warehouse_id: wh.id,
            quantity: 5 + Math.floor(Math.random() * 50),
            status: "available",
          });
        }
        const { error } = await sb.from("wms_bin_stock").insert(bsRows);
        L(`15. Inserted ${error ? 'ERR: ' + error.message : bsRows.length} wms_bin_stock`);
      }
    }

    // ============ 16. WMS TASKS ============
    {
      const taskTypes = ["pick", "putaway", "replenish", "count"];
      const statuses = ["pending", "in_progress", "completed"];
      const taskRows: any[] = [];
      const wh = warehouses[0];
      if (wh && wmsBins.length >= 2) {
        for (let t = 0; t < 50; t++) {
          const fromBin = wmsBins[Math.floor(Math.random() * wmsBins.length)];
          const toBin = wmsBins[Math.floor(Math.random() * wmsBins.length)];
          const p = products[Math.floor(Math.random() * products.length)];
          taskRows.push({
            tenant_id: tenantId, warehouse_id: wh.id,
            task_number: `WMS-T${String(t + 1).padStart(4, "0")}`,
            task_type: taskTypes[t % taskTypes.length],
            status: statuses[Math.floor(Math.random() * statuses.length)],
            priority: Math.ceil(Math.random() * 5),
            product_id: p.id,
            quantity: 1 + Math.floor(Math.random() * 20),
            from_bin_id: fromBin.id,
            to_bin_id: toBin.id,
          });
        }
        const { error } = await sb.from("wms_tasks").insert(taskRows);
        L(`16. Inserted ${error ? 'ERR: ' + error.message : taskRows.length} wms_tasks`);
      }
    }

    // ============ 17. WMS CYCLE COUNTS ============
    try {
      const { data: existCC } = await sb.from("wms_cycle_counts").select("id").eq("tenant_id", tenantId).limit(1);
      if (!existCC?.length) {
        const wh = warehouses[0];
        if (wh) {
          const ccRows: any[] = [];
          for (let c = 0; c < 5; c++) {
            ccRows.push({
              tenant_id: tenantId, warehouse_id: wh.id,
              count_number: `CC-${String(c + 1).padStart(4, "0")}`,
              count_type: ["scheduled", "trigger", "abc"][c % 3],
              status: c < 2 ? "completed" : "in_progress",
              zone_id: wmsZones.length ? wmsZones[c % wmsZones.length].id : null,
            });
          }
          const { data: ccData, error: ccErr } = await sb.from("wms_cycle_counts").insert(ccRows).select("id");
          if (ccErr) { L(`17. ERR: ${ccErr.message}`); }
          else if (ccData?.length) {
            const lineRows: any[] = [];
            for (const cc of ccData) {
              for (let l = 0; l < 10; l++) {
                const bin = wmsBins[Math.floor(Math.random() * wmsBins.length)];
                const p = products[Math.floor(Math.random() * products.length)];
                const expected = 10 + Math.floor(Math.random() * 50);
                const counted = expected + Math.floor(Math.random() * 6) - 3;
                lineRows.push({ tenant_id: tenantId, count_id: cc.id, bin_id: bin.id, product_id: p.id, expected_quantity: expected, counted_quantity: counted, status: "counted" });
              }
            }
            const { error: clErr } = await sb.from("wms_cycle_count_lines").insert(lineRows);
            L(`17. Inserted ${ccData.length} cycle_counts + ${clErr ? 'ERR: ' + clErr.message : lineRows.length} lines`);
          }
        }
      } else { L(`17. SKIP`); }
    } catch (e: any) { L(`17. CATCH: ${e.message}`); }

    // ============ 18. RETURN CASES + LINES ============
    try {
      const { data: existRC } = await sb.from("return_cases").select("id").eq("tenant_id", tenantId).limit(1);
      if (!existRC?.length && invoices.length) {
        const rcRows: any[] = [];
        const topInv = invoices.slice(0, 10);
        for (let i = 0; i < topInv.length; i++) {
          rcRows.push({ tenant_id: tenantId, return_type: i < 7 ? "customer" : "supplier", source_type: "invoice", source_id: topInv[i].id, partner_id: topInv[i].partner_id, case_number: `RET-${String(i + 1).padStart(4, "0")}`, status: i < 5 ? "resolved" : "draft", opened_at: "2025-06-01", notes: "Demo" });
        }
        const { data: rcData, error: rcErr } = await sb.from("return_cases").insert(rcRows).select("id");
        if (rcErr) { L(`18. ERR: ${rcErr.message}`); }
        else if (rcData?.length) {
          const rlRows: any[] = [];
          for (const rc of rcData) {
            for (let l = 0; l < 2; l++) {
              const p = products[Math.floor(Math.random() * products.length)];
              rlRows.push({ return_case_id: rc.id, product_id: p.id, description: `Povrat: ${p.name || 'Proizvod'}`, quantity_returned: 1 + Math.floor(Math.random() * 5), quantity_accepted: 1 + Math.floor(Math.random() * 3), reason: ["defective", "wrong_item", "damaged", "not_needed"][l % 4], inspection_status: ["pending", "accepted", "rejected"][l % 3], sort_order: l + 1 });
            }
          }
          const { error: rlErr } = await sb.from("return_lines").insert(rlRows);
          L(`18. Inserted ${rcData.length} return_cases + ${rlErr ? 'ERR: ' + rlErr.message : rlRows.length} return_lines`);
        }
      } else { L(`18. SKIP`); }
    } catch (e: any) { L(`18. CATCH: ${e.message}`); }

    // ============ 19. CREDIT NOTES ============
    try {
      const { data: existCN } = await sb.from("credit_notes").select("id").eq("tenant_id", tenantId).limit(1);
      if (!existCN?.length && invoices.length) {
        const cnRows: any[] = [];
        for (let i = 0; i < Math.min(10, invoices.length); i++) {
          cnRows.push({ tenant_id: tenantId, invoice_id: invoices[i].id, credit_number: `CN-${String(i + 1).padStart(4, "0")}`, amount: Math.round(Number(invoices[i].total || 10000) * 0.1 * 100) / 100, currency: "RSD", status: i < 6 ? "issued" : "draft", issued_at: i < 6 ? "2025-07-01T00:00:00Z" : null, notes: "Knjizno odobrenje - demo" });
        }
        const { error } = await sb.from("credit_notes").insert(cnRows);
        L(`19. Inserted ${error ? 'ERR: ' + error.message : cnRows.length} credit_notes`);
      } else { L(`19. SKIP`); }
    } catch (e: any) { L(`19. CATCH: ${e.message}`); }

    // ============ 20. NOTIFICATIONS ============
    try {
      const { data: existN } = await sb.from("notifications").select("id").eq("tenant_id", tenantId).limit(1);
      if (!existN?.length) {
        const userIds = userRoles.map(r => r.user_id);
        if (userIds.length) {
          const categories = ["invoice", "approval", "inventory", "hr", "system"];
          const titles = ["Nova faktura", "Zahtev za odobrenje", "Nizak nivo zaliha", "Zahtev za odmor", "Sistemsko obaveštenje"];
          const nRows: any[] = [];
          for (let i = 0; i < 50; i++) {
            nRows.push({ tenant_id: tenantId, user_id: userIds[i % userIds.length], type: i < 10 ? "warning" : "info", category: categories[i % categories.length], title: titles[i % titles.length], message: `Demo notifikacija #${i + 1}`, is_read: i < 30 });
          }
          const { error } = await sb.from("notifications").insert(nRows);
          L(`20. Inserted ${error ? 'ERR: ' + error.message : nRows.length} notifications`);
        }
      } else { L(`20. SKIP`); }
    } catch (e: any) { L(`20. CATCH: ${e.message}`); }

    return new Response(JSON.stringify({ success: true, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Phase3 error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
