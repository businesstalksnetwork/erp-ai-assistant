import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Constants ──
const TENANT_ID = "92474a4b-ff91-48da-b111-89924e70b8b8";
const LEGAL_ENTITY_ID = "ff1ad125-78d6-4931-985d-9071edf4238c";
const TAX_20 = "26b3447d-0365-4b8f-9a14-6bd3d4a78dec";
const TAX_10 = "281f96b2-deab-4273-9562-39403124293d";
const TAX_0 = "3f183317-972e-44f4-98bf-0de3449a7203";
const ACC_CASH = "c99cd8a6-5bc1-4e87-b4a3-32696d96f000";
const ACC_AR = "ed5dc8cc-2d7a-4f15-8232-70e9900e59bf";
const ACC_AP = "29c0edec-81b4-4c70-bd54-6c8cffabc8f2";
const ACC_REVENUE = "b2ad54e3-9f5c-4c29-9658-710a3ceca24c";
const ACC_COGS = "f6bbf951-e8cb-4415-bdaf-98d942a3aa39";
const ACC_VAT = "d0fb101a-7342-40d6-b863-c139f3e328a1";
const ACC_EXPENSES = "09cb5b01-88d9-46f0-a5bd-f260d4b94dd3";

// ── Helpers ──
function uuid() { return crypto.randomUUID(); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randAmount(min: number, max: number) { return Math.round((Math.random() * (max - min) + min) * 100) / 100; }

// Dynamic date range: Jan 2025 through today
const NOW = new Date();
const TOTAL_MONTHS = (NOW.getFullYear() - 2025) * 12 + NOW.getMonth() + 1; // e.g. 14 for Feb 2026

function dateInRange(monthOffset?: number) {
  const m = monthOffset != null ? Math.min(monthOffset, TOTAL_MONTHS - 1) : randInt(0, TOTAL_MONTHS - 1);
  const d = randInt(1, 28);
  const h = randInt(8, 17);
  const target = new Date(2025, m, d, h, randInt(0, 59));
  if (target > NOW) { target.setTime(NOW.getTime() - randInt(0, 86400000)); }
  return target.toISOString();
}
function dateStr(d: string) { return d.slice(0, 10); }
function yearFromDate(d: string) { return new Date(d).getFullYear(); }

async function batchInsert(supabase: any, table: string, rows: any[], batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`Error inserting ${table} batch ${i}:`, error.message);
      // Continue instead of throwing so seed completes
    }
  }
}

// ── Serbian names data ──
const firstNames = ["Marko","Nikola","Stefan","Aleksandar","Jovan","Milan","Petar","Luka","Miloš","Đorđe","Ana","Jelena","Marija","Ivana","Milica","Jovana","Katarina","Teodora","Tamara","Dragana","Nemanja","Branko","Zoran","Dejan","Igor"];
const lastNames = ["Jovanović","Petrović","Nikolić","Marković","Đorđević","Stojanović","Ilić","Stanković","Pavlović","Milošević","Todorović","Stevanović","Đukić","Kovačević","Popović"];
const cities = ["Beograd","Novi Sad","Niš","Kragujevac","Subotica","Zrenjanin","Pančevo","Čačak","Kruševac","Kraljevo","Novi Pazar","Smederevo","Leskovac","Užice","Vranje"];
const streets = ["Knez Mihailova","Bulevar Kralja Aleksandra","Terazije","Makedonska","Nemanjina","Cara Dušana","Vojvode Stepe","Bulevar Oslobođenja","Maksima Gorkog","Kralja Petra"];

const companyNames = [
  "Telekom Srbija","NIS a.d.","Hemofarm","Delta Holding","MK Group","Gorenje Beograd","Metalac a.d.","Imlek","Bambi Banat","Sunoko",
  "Sojaprotein","Jaffa Crvenka","Energoprojekt","Komercijalna Banka","Apatinska Pivara","Carnex","Dijamant","Frikom","Gomex","Univerexport",
  "Vip Mobile","Telenor","Gigatron","Tehnomanija","Comtrade","Nelt Group","MPC Properties","Airport Nikola Tesla","Lasta a.d.","Galenika",
  "Tigar Tyres","FAM Kruševac","Tarkett","Knjaz Miloš","Nectar","Proleter Zrenjanin","Ball Packaging","Philip Morris","Coca-Cola HBC","Henkel Srbija",
  "Siemens Srbija","Bosch Srbija","Continental","Leoni Wiring","Yura Corporation","Fiat Srbija","Grundfos","Geox","Calzedonia","Swarovski"
];

const supplierNames = [
  "IT Komponente d.o.o.","TechSupply Srbija","MegaComp","DataLink","NetPro Solutions","ServerParts d.o.o.","PrintMedia Srbija",
  "OfficeMax Beograd","EcoSupply","CloudTech d.o.o.","SoftLicense Hub","HardwareWorld","CableNet","DisplayPro","SecurityTech"
];

const productNames = [
  "Laptop Dell Latitude 5540","Laptop Lenovo ThinkPad T14","Desktop HP ProDesk 400","Monitor Dell 27\" U2723QE","Monitor Samsung 24\" S24C","Tastatura Logitech MX Keys","Miš Logitech MX Master 3","Slušalice Jabra Evolve2 75","Web kamera Logitech Brio","Docking Station Dell WD19",
  "Server Dell PowerEdge R750","UPS APC Smart-UPS 1500VA","Switch Cisco Catalyst 2960","Router MikroTik RB4011","Firewall FortiGate 60F","NAS Synology DS920+","SSD Samsung 980 Pro 1TB","RAM Kingston 16GB DDR5","USB Hub Anker 7-port","Kabel UTP Cat6 305m",
  "Printer HP LaserJet Pro M404","Skener Epson DS-530","Projektor Epson EB-W49","Tablet Samsung Galaxy Tab S9","Telefon Samsung Galaxy S24","External SSD 2TB Portable","Adapter USB-C Multiport","Toner HP 59A","Papir A4 500 listova","Fascikla plastična A4",
  "Microsoft 365 Business Premium","Windows 11 Pro licenca","Adobe Creative Cloud","Autodesk AutoCAD licenca","VMware vSphere Standard","Kaspersky Endpoint Security","Veeam Backup & Replication","Slack Business+ licenca","Zoom Workplace Pro","Atlassian Jira licenca",
  "GitHub Enterprise licenca","Docker Business licenca","Cloudflare Pro plan","AWS Reserved Instance","Azure VM B2s mesečno","Google Workspace Enterprise","SAP Business One licenca","Salesforce CRM licenca","HubSpot Marketing Hub","Notion Team licenca",
  "Sistemska administracija mesečno","Helpdesk podrška Tier 1","Helpdesk podrška Tier 2","Mrežna infrastruktura setup","Cloud migracija","Penetration testing","IT konsalting sat","DevOps implementacija","CI/CD pipeline setup","Kubernetes deployment",
  "Web development sat","Mobile app development sat","UI/UX dizajn sat","QA testiranje sat","Data analytics konzultacije","Cybersecurity audit","Backup & DR planning","Network monitoring mesečno","SLA Premium podrška","Training IT security",
  "Instalacija radne stanice","Konfiguracija servera","Održavanje mreže mesečno","VPN setup","Email migracija",
  "Stolica ergonomska","Sto kancelarijski 160x80","Monitor arm dual","Podloga za miša gel","Whiteboard 120x90","Marker set za whiteboard","Post-it blok 76x76","Olovka hemijska plava","Spajalice kutija 1000","Selotejp providni",
  "Koverta C4 bela","Registrator A4 široki","Kalkulator Casio","Etikete samolepljive A4","Kesa za uništavač papira",
  "Access Point UniFi U6+","PoE Injektor 48V","Patch Panel 24-port","Rack kabinet 42U","Organizator kablova","Optički kabel SM 50m","SFP+ modul 10G","Media konvertor","Krimper RJ45","Tester mrežnih kablova"
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Environment guard: block in production
    if (Deno.env.get("ENVIRONMENT") === "production") {
      return new Response(JSON.stringify({ error: "Seed functions are disabled in production" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth: require super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: caller.id });
    if (!isSA) {
      return new Response(JSON.stringify({ error: "Forbidden: Super Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const _authSkip = true;
    const log: string[] = [];
    const t = TENANT_ID;
    const le = LEGAL_ENTITY_ID;

    // ═══════════════════════════════════════════════════
    // 0. CLEANUP
    // ═══════════════════════════════════════════════════
    const { error: rpcErr } = await supabase.rpc("force_delete_journal_entries", { p_tenant_id: t });
    if (rpcErr) console.log("RPC force_delete err:", rpcErr.message);
    
    const fkCleanup: Array<{parent: string, child: string, fk: string}> = [
      { parent: "invoices", child: "invoice_lines", fk: "invoice_id" },
      { parent: "invoices", child: "credit_notes", fk: "invoice_id" },
      { parent: "invoices", child: "deferrals", fk: "source_invoice_id" },
      { parent: "quotes", child: "quote_lines", fk: "quote_id" },
      { parent: "sales_orders", child: "sales_order_lines", fk: "sales_order_id" },
      { parent: "purchase_orders", child: "purchase_order_lines", fk: "purchase_order_id" },
      { parent: "purchase_orders", child: "supplier_invoices", fk: "purchase_order_id" },
      { parent: "goods_receipts", child: "goods_receipt_lines", fk: "goods_receipt_id" },
      { parent: "bank_statements", child: "bank_statement_lines", fk: "statement_id" },
      { parent: "bom_templates", child: "bom_lines", fk: "bom_template_id" },
      { parent: "bom_templates", child: "production_orders", fk: "bom_template_id" },
      { parent: "payroll_runs", child: "payroll_items", fk: "payroll_run_id" },
      { parent: "production_orders", child: "production_consumption", fk: "production_order_id" },
      { parent: "open_items", child: "open_item_payments", fk: "open_item_id" },
      { parent: "leads", child: "opportunities", fk: "lead_id" },
      { parent: "companies", child: "activities", fk: "company_id" },
      { parent: "contacts", child: "opportunities", fk: "contact_id" },
      { parent: "salespeople", child: "opportunities", fk: "salesperson_id" },
      { parent: "warehouses", child: "inventory_cost_layers", fk: "warehouse_id" },
      { parent: "products", child: "inventory_cost_layers", fk: "product_id" },
      { parent: "products", child: "retail_prices", fk: "product_id" },
      { parent: "wms_zones", child: "wms_bins", fk: "zone_id" },
      { parent: "wms_bins", child: "wms_bin_stock", fk: "bin_id" },
      { parent: "wms_bins", child: "wms_tasks", fk: "from_bin_id" },
      { parent: "employees", child: "salespeople", fk: "employee_id" },
      { parent: "partners", child: "open_items", fk: "partner_id" },
      { parent: "partners", child: "return_cases", fk: "partner_id" },
    ];
    for (const { parent, child, fk } of fkCleanup) {
      const { data: parentIds } = await supabase.from(parent).select("id").eq("tenant_id", t);
      if (parentIds && parentIds.length > 0) {
        const ids = parentIds.map((r: any) => r.id);
        for (let i = 0; i < ids.length; i += 100) {
          await supabase.from(child).delete().in(fk, ids.slice(i, i + 100));
        }
      }
    }

    await supabase.from("holidays").delete().is("tenant_id", null);

    const cleanupTables = [
      "pos_daily_reports",
      "pdv_entries", "pdv_periods",
      "payroll_runs",
      "attendance_records", "leave_requests",
      "overtime_hours", "insurance_records",
      "allowances", "allowance_types",
      "deductions",
      "open_item_payments", "open_items",
      "credit_notes", "return_cases",
      "deferrals", "deferral_schedules",
      "inventory_cost_layers",
      "wms_tasks", "wms_cycle_counts", "wms_bin_stock",
      "activities", "opportunities",
      "sales_targets", "salespeople", "sales_channels",
      "exchange_rates", "currencies",
      "position_templates", "meetings",
      "fixed_assets",
      "work_logs", "annual_leave_balances",
      "inventory_movements", "pos_transactions", "pos_sessions",
      "production_orders", "bom_templates",
      "goods_receipts",
      "quotes", "sales_orders", "purchase_orders",
      "supplier_invoices", "fiscal_receipts", "invoices",
      "employee_contracts", "employee_salaries", "employees",
      "inventory_stock",
      "wms_bins", "wms_zones", "warehouses",
      "contact_company_assignments", "contacts",
      "company_category_assignments", "companies", "company_categories",
      "leads",
      "loans",
      "partners", "products",
      "fiscal_devices", "fiscal_periods",
      "departments", "locations",
      "budgets", "cost_centers",
      "bank_statements", "bank_accounts",
      "ar_aging_snapshots", "ap_aging_snapshots",
    ];
    for (const table of cleanupTables) {
      const { error } = await supabase.from(table).delete().eq("tenant_id", t);
      if (error) console.log(`Cleanup ${table}: ${error.message}`);
    }
    log.push("✓ Cleanup complete");

    // ═══════════════════════════════════════════════════
    // 1. UPDATE LEGAL ENTITY
    // ═══════════════════════════════════════════════════
    await supabase.from("legal_entities").update({
      pib: "112345678", maticni_broj: "21876543",
      address: "Bulevar Mihajla Pupina 10a", city: "Beograd", country: "RS",
    }).eq("id", le);
    log.push("✓ Legal entity updated");

    // ═══════════════════════════════════════════════════
    // 2. LOCATIONS
    // ═══════════════════════════════════════════════════
    const locIds = [uuid(), uuid(), uuid()];
    const locations = [
      { id: locIds[0], tenant_id: t, name: "Beograd - Centrala", type: "office", address: "Bulevar Mihajla Pupina 10a", city: "Beograd", is_active: true },
      { id: locIds[1], tenant_id: t, name: "Novi Sad - Filijala", type: "office", address: "Bulevar Oslobođenja 78", city: "Novi Sad", is_active: true },
      { id: locIds[2], tenant_id: t, name: "Niš - Magacin", type: "warehouse", address: "Industrijska zona bb", city: "Niš", is_active: true },
    ];
    await batchInsert(supabase, "locations", locations);
    log.push("✓ 3 locations");

    // ═══════════════════════════════════════════════════
    // 3. DEPARTMENTS
    // ═══════════════════════════════════════════════════
    const deptIds = [uuid(), uuid(), uuid(), uuid(), uuid()];
    const departments = [
      { id: deptIds[0], tenant_id: t, name: "IT", code: "IT", is_active: true },
      { id: deptIds[1], tenant_id: t, name: "Prodaja", code: "SALES", is_active: true },
      { id: deptIds[2], tenant_id: t, name: "Finansije", code: "FIN", is_active: true },
      { id: deptIds[3], tenant_id: t, name: "Logistika", code: "LOG", is_active: true },
      { id: deptIds[4], tenant_id: t, name: "Proizvodnja", code: "PROD", is_active: true },
    ];
    await batchInsert(supabase, "departments", departments);
    log.push("✓ 5 departments");

    // ═══════════════════════════════════════════════════
    // 4. FISCAL PERIODS (dynamic: Jan 2025 through current month)
    // ═══════════════════════════════════════════════════
    const fpIds: string[] = [];
    const fiscalPeriods = [];
    for (let m = 0; m < TOTAL_MONTHS; m++) {
      const id = uuid();
      fpIds.push(id);
      const year = 2025 + Math.floor(m / 12);
      const monthInYear = m % 12;
      const start = new Date(year, monthInYear, 1);
      const end = new Date(year, monthInYear + 1, 0);
      fiscalPeriods.push({
        id, tenant_id: t,
        name: `${String(monthInYear + 1).padStart(2, "0")}/${year}`,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        status: "open",
      });
    }
    await batchInsert(supabase, "fiscal_periods", fiscalPeriods);
    log.push(`✓ ${TOTAL_MONTHS} fiscal periods`);

    // ═══════════════════════════════════════════════════
    // 5. FISCAL DEVICES
    // ═══════════════════════════════════════════════════
    const fdIds = [uuid(), uuid(), uuid()];
    const fiscalDevices = [
      { id: fdIds[0], tenant_id: t, device_name: "POS Kasa Beograd", device_type: "V", ib_number: "IBFM1234567", location_name: "Beograd - Centrala", location_address: "Bulevar M. Pupina 10a", location_id: locIds[0], legal_entity_id: le, is_active: true, pac: "abcd1234" },
      { id: fdIds[1], tenant_id: t, device_name: "POS Kasa Novi Sad", device_type: "V", ib_number: "IBFM2345678", location_name: "Novi Sad - Filijala", location_address: "Bulevar Oslobođenja 78", location_id: locIds[1], legal_entity_id: le, is_active: true, pac: "efgh5678" },
      { id: fdIds[2], tenant_id: t, device_name: "POS Kasa Niš", device_type: "V", ib_number: "IBFM3456789", location_name: "Niš - Magacin", location_address: "Industrijska zona bb", location_id: locIds[2], legal_entity_id: le, is_active: true, pac: "ijkl9012" },
    ];
    await batchInsert(supabase, "fiscal_devices", fiscalDevices);
    log.push("✓ 3 fiscal devices");

    // ═══════════════════════════════════════════════════
    // 6. PARTNERS (50 clients + 15 suppliers)
    // ═══════════════════════════════════════════════════
    const clientIds: string[] = [];
    const supplierIds: string[] = [];
    const partners: any[] = [];
    
    for (let i = 0; i < 50; i++) {
      const id = uuid();
      clientIds.push(id);
      partners.push({
        id, tenant_id: t, name: companyNames[i], type: "customer",
        pib: String(100000000 + i * 111), maticni_broj: String(20000000 + i * 100),
        address: `${pick(streets)} ${randInt(1, 200)}`, city: pick(cities), country: "RS",
        email: `office@${companyNames[i].toLowerCase().replace(/[^a-z]/g, "").slice(0, 10)}.rs`,
        phone: `+381${randInt(11, 38)}${randInt(1000000, 9999999)}`,
        payment_terms_days: pick([15, 30, 45, 60]),
        is_active: true,
      });
    }
    for (let i = 0; i < 15; i++) {
      const id = uuid();
      supplierIds.push(id);
      partners.push({
        id, tenant_id: t, name: supplierNames[i], type: "supplier",
        pib: String(200000000 + i * 222), maticni_broj: String(30000000 + i * 200),
        address: `${pick(streets)} ${randInt(1, 200)}`, city: pick(cities), country: "RS",
        email: `nabavka@${supplierNames[i].toLowerCase().replace(/[^a-z]/g, "").slice(0, 10)}.rs`,
        phone: `+381${randInt(11, 38)}${randInt(1000000, 9999999)}`,
        payment_terms_days: pick([30, 45, 60]),
        is_active: true,
      });
    }
    await batchInsert(supabase, "partners", partners);
    log.push("✓ 65 partners");

    // ═══════════════════════════════════════════════════
    // 7. COMPANIES + CONTACTS (CRM)
    // ═══════════════════════════════════════════════════
    const crmCompanyIds: string[] = [];
    const crmCompanies: any[] = [];
    for (let i = 0; i < 50; i++) {
      const id = uuid();
      crmCompanyIds.push(id);
      crmCompanies.push({
        id, tenant_id: t, legal_name: companyNames[i],
        display_name: companyNames[i],
        pib: String(100000000 + i * 111),
        city: pick(cities), country: "RS", status: "active",
        partner_id: clientIds[i],
        email: `crm@${companyNames[i].toLowerCase().replace(/[^a-z]/g, "").slice(0, 10)}.rs`,
      });
    }
    await batchInsert(supabase, "companies", crmCompanies);
    log.push("✓ 50 CRM companies");

    const contacts: any[] = [];
    const contactIds: string[] = [];
    for (let i = 0; i < 80; i++) {
      const id = uuid();
      contactIds.push(id);
      const fn = pick(firstNames);
      const ln = pick(lastNames);
      contacts.push({
        id, tenant_id: t, first_name: fn, last_name: ln,
        email: `${fn.toLowerCase()}.${ln.toLowerCase().replace(/[ćčžšđ]/g, c => ({ć:"c",č:"c",ž:"z",š:"s",đ:"d"}[c] || c))}@${companyNames[i % 50].toLowerCase().replace(/[^a-z]/g, "").slice(0, 8)}.rs`,
        phone: `+381${randInt(60, 69)}${randInt(1000000, 9999999)}`,
        city: pick(cities),
        type: pick(["customer", "supplier", "prospect"]),
        function_area: pick(["management", "sales", "marketing", "finance", "hr", "it", "operations"]),
        seniority_level: pick(["c_level", "executive", "manager", "senior", "mid", "junior"]),
      });
    }
    await batchInsert(supabase, "contacts", contacts);
    log.push("✓ 80 contacts");

    const ccAssign: any[] = [];
    for (let i = 0; i < 80; i++) {
      ccAssign.push({
        id: uuid(), tenant_id: t,
        contact_id: contactIds[i],
        company_id: crmCompanyIds[i % 50],
        is_primary: i < 50,
        job_title: pick(["Direktor", "Menadžer", "Šef nabavke", "IT rukovodilac", "Finansijski direktor", "Komercijalni direktor"]),
      });
    }
    await batchInsert(supabase, "contact_company_assignments", ccAssign);
    log.push("✓ 80 contact-company assignments");

    // ═══════════════════════════════════════════════════
    // 8. PRODUCTS (100)
    // ═══════════════════════════════════════════════════
    const prodIds: string[] = [];
    const products: any[] = [];
    for (let i = 0; i < 100; i++) {
      const id = uuid();
      prodIds.push(id);
      const purchasePrice = randAmount(500, 50000);
      const salePrice = Math.round(purchasePrice * (1 + randAmount(0.2, 0.8)) * 100) / 100;
      const retailPrice = Math.round(salePrice * 1.2 * 100) / 100;
      products.push({
        id, tenant_id: t,
        name: productNames[i], name_sr: productNames[i],
        sku: `SKU-${String(i + 1).padStart(4, "0")}`,
        barcode: `860${String(randInt(1000000000, 9999999999))}`,
        description: `${productNames[i]} - visokokvalitetan proizvod`,
        unit_of_measure: i < 30 ? "kom" : i < 50 ? "lic" : i < 75 ? "sat" : "kom",
        default_purchase_price: purchasePrice,
        default_sale_price: salePrice,
        default_retail_price: retailPrice,
        tax_rate_id: i < 75 ? TAX_20 : (i < 90 ? TAX_10 : TAX_0),
        is_active: true,
      });
    }
    await batchInsert(supabase, "products", products);
    log.push("✓ 100 products");

    // ═══════════════════════════════════════════════════
    // 9. WAREHOUSES + WMS ZONES + BINS
    // ═══════════════════════════════════════════════════
    const whIds = [uuid(), uuid(), uuid()];
    const warehouses = [
      { id: whIds[0], tenant_id: t, name: "Glavni magacin Beograd", code: "MAG-BG", location_id: locIds[0], is_active: true, zones: [] },
      { id: whIds[1], tenant_id: t, name: "Magacin Novi Sad", code: "MAG-NS", location_id: locIds[1], is_active: true, zones: [] },
      { id: whIds[2], tenant_id: t, name: "Magacin Niš", code: "MAG-NI", location_id: locIds[2], is_active: true, zones: [] },
    ];
    await batchInsert(supabase, "warehouses", warehouses);
    log.push("✓ 3 warehouses");

    const zoneIds: string[] = [];
    const zones: any[] = [];
    const zoneNames = ["Prijem", "Skladištenje", "Otprema", "Komisija"];
    for (const wh of whIds) {
      for (const zn of zoneNames) {
        const id = uuid();
        zoneIds.push(id);
        zones.push({ id, tenant_id: t, warehouse_id: wh, name: zn, code: `${zn.slice(0, 3).toUpperCase()}-${wh.slice(0, 4)}`, zone_type: pick(["receiving", "reserve", "forward_pick", "packing", "shipping", "quarantine", "returns"]), is_active: true });
      }
    }
    await batchInsert(supabase, "wms_zones", zones);
    log.push("✓ 12 WMS zones");

    const binIds: string[] = [];
    const bins: any[] = [];
    for (let zi = 0; zi < zoneIds.length; zi++) {
      for (let b = 1; b <= 5; b++) {
        const id = uuid();
        binIds.push(id);
        bins.push({
          id, tenant_id: t,
          warehouse_id: whIds[Math.floor(zi / 4)],
          zone_id: zoneIds[zi],
          code: `${zones[zi].code}-R${b}`,
          bin_type: "shelf", level: b, sort_order: b, is_active: true,
        });
      }
    }
    await batchInsert(supabase, "wms_bins", bins);
    log.push(`✓ ${bins.length} WMS bins`);

    // ═══════════════════════════════════════════════════
    // 10. INVENTORY STOCK
    // ═══════════════════════════════════════════════════
    const stockRows: any[] = [];
    for (let p = 0; p < 100; p++) {
      stockRows.push({
        id: uuid(), tenant_id: t, product_id: prodIds[p], warehouse_id: whIds[0],
        quantity_on_hand: randInt(5, 500), quantity_reserved: randInt(0, 20), min_stock_level: randInt(5, 30),
      });
      if (p < 60) {
        stockRows.push({
          id: uuid(), tenant_id: t, product_id: prodIds[p], warehouse_id: whIds[1],
          quantity_on_hand: randInt(0, 200), quantity_reserved: 0, min_stock_level: randInt(3, 15),
        });
      }
      if (p < 30) {
        stockRows.push({
          id: uuid(), tenant_id: t, product_id: prodIds[p], warehouse_id: whIds[2],
          quantity_on_hand: randInt(0, 100), quantity_reserved: 0, min_stock_level: randInt(2, 10),
        });
      }
    }
    await batchInsert(supabase, "inventory_stock", stockRows);
    log.push(`✓ ${stockRows.length} inventory stock rows`);

    // ═══════════════════════════════════════════════════
    // 11. EMPLOYEES (25) + CONTRACTS
    // ═══════════════════════════════════════════════════
    const empIds: string[] = [];
    const employees: any[] = [];
    const contracts: any[] = [];
    const salaries: any[] = [];
    const positions = ["Senior Developer", "Junior Developer", "Project Manager", "System Administrator", "Sales Manager", "Accountant", "Warehouse Operator", "QA Engineer", "DevOps Engineer", "Business Analyst", "Support Engineer", "UI Designer", "Network Engineer", "HR Specialist", "Financial Analyst"];

    for (let i = 0; i < 25; i++) {
      const id = uuid();
      empIds.push(id);
      const fn = firstNames[i];
      const ln = pick(lastNames);
      const gross = randInt(80000, 350000);
      const net = Math.round(gross * 0.63);
      employees.push({
        id, tenant_id: t,
        full_name: `${fn} ${ln}`,
        first_name: fn, last_name: ln,
        email: `${fn.toLowerCase()}.${ln.toLowerCase().replace(/[ćčžšđ]/g, c => ({ć:"c",č:"c",ž:"z",š:"s",đ:"d"}[c] || c))}@aiitdev.rs`,
        phone: `+381${randInt(60, 69)}${randInt(1000000, 9999999)}`,
        position: positions[i % positions.length],
        department_id: deptIds[i % 5],
        location_id: locIds[i % 3],
        company_id: le,
        start_date: `202${randInt(0, 4)}-${String(randInt(1, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`,
        status: "active",
        employment_type: "full_time",
        annual_leave_days: pick([20, 21, 22, 25]),
        daily_work_hours: 8,
        jmbg: `${String(randInt(1000000, 9999999))}${String(randInt(100000, 999999))}`,
        address: `${pick(streets)} ${randInt(1, 100)}`,
        city: pick(cities),
      });
      contracts.push({
        id: uuid(), tenant_id: t, employee_id: id,
        contract_type: i < 20 ? "permanent" : "fixed_term",
        start_date: employees[i].start_date,
        gross_salary: gross, net_salary: net,
        currency: "RSD", working_hours_per_week: 40, is_active: true,
      });
      salaries.push({
        id: uuid(), tenant_id: t, employee_id: id,
        amount: gross, amount_type: "gross", salary_type: "monthly",
        start_date: employees[i].start_date,
        meal_allowance: pick([0, 3000, 5000]),
        regres: 0,
      });
    }
    await batchInsert(supabase, "employees", employees);
    await batchInsert(supabase, "employee_contracts", contracts);
    await batchInsert(supabase, "employee_salaries", salaries);
    log.push("✓ 25 employees + contracts + salaries");

    // ═══════════════════════════════════════════════════
    // 12. INVOICES (2,000) + INVOICE LINES - dynamic dates
    // ═══════════════════════════════════════════════════
    const invoices: any[] = [];
    const invoiceLines: any[] = [];
    const invoiceIds: string[] = [];
    const perMonth = Math.ceil(2000 / TOTAL_MONTHS);

    for (let i = 0; i < 2000; i++) {
      const invId = uuid();
      invoiceIds.push(invId);
      const month = Math.min(Math.floor(i / perMonth), TOTAL_MONTHS - 1);
      const invDate = dateInRange(month);
      const invYear = yearFromDate(invDate);
      const numLines = randInt(1, 4);
      let subtotal = 0;
      let taxAmount = 0;

      for (let li = 0; li < numLines; li++) {
        const pi = randInt(0, 99);
        const qty = randInt(1, 20);
        const price = products[pi].default_sale_price;
        const lineTotal = Math.round(qty * price * 100) / 100;
        const taxRate = pi < 75 ? 20 : pi < 90 ? 10 : 0;
        const lineTax = Math.round(lineTotal * taxRate / 100 * 100) / 100;
        subtotal += lineTotal;
        taxAmount += lineTax;
        invoiceLines.push({
          id: uuid(), invoice_id: invId,
          product_id: prodIds[pi], description: productNames[pi],
          quantity: qty, unit_price: price, line_total: lineTotal,
          tax_rate_id: pi < 75 ? TAX_20 : pi < 90 ? TAX_10 : TAX_0,
          tax_rate_value: taxRate, tax_amount: lineTax,
          total_with_tax: Math.round((lineTotal + lineTax) * 100) / 100,
          sort_order: li + 1,
        });
      }

      const statusRoll = Math.random();
      const status = statusRoll < 0.7 ? "paid" : statusRoll < 0.9 ? "sent" : "draft";
      const partnerId = pick(clientIds);
      const partnerData = partners.find(p => p.id === partnerId)!;
      const paidAt = status === "paid" 
        ? dateStr(new Date(new Date(invDate).getTime() + randInt(5, 45) * 86400000).toISOString())
        : null;

      invoices.push({
        id: invId, tenant_id: t,
        invoice_number: `FACT-${invYear}-${String(i + 1).padStart(5, "0")}`,
        invoice_date: dateStr(invDate),
        due_date: dateStr(new Date(new Date(invDate).getTime() + 30 * 86400000).toISOString()),
        partner_id: partnerId, partner_name: partnerData.name, partner_pib: partnerData.pib,
        status,
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: Math.round((subtotal + taxAmount) * 100) / 100,
        currency: "RSD", legal_entity_id: le,
        invoice_type: "regular", sale_type: "domestic",
        sef_status: status === "paid" ? "accepted" : "not_sent",
        paid_at: paidAt, created_at: invDate,
      });
    }
    await batchInsert(supabase, "invoices", invoices);
    log.push("✓ 2,000 invoices");
    await batchInsert(supabase, "invoice_lines", invoiceLines);
    log.push(`✓ ${invoiceLines.length} invoice lines`);

    // ═══════════════════════════════════════════════════
    // 13. FISCAL RECEIPTS (1,000)
    // ═══════════════════════════════════════════════════
    const receipts: any[] = [];
    const perMonthReceipts = Math.ceil(1000 / TOTAL_MONTHS);
    for (let i = 0; i < 1000; i++) {
      const month = Math.min(Math.floor(i / perMonthReceipts), TOTAL_MONTHS - 1);
      const dt = dateInRange(month);
      const yr = yearFromDate(dt);
      const total = randAmount(500, 50000);
      const taxRate = 20;
      const baseAmount = Math.round(total / 1.2 * 100) / 100;
      const taxAmt = Math.round((total - baseAmount) * 100) / 100;
      receipts.push({
        id: uuid(), tenant_id: t,
        fiscal_device_id: pick(fdIds),
        receipt_number: `FR-${yr}-${String(i + 1).padStart(6, "0")}`,
        total_amount: total,
        payment_method: pick(["cash", "card", "card", "cash"]),
        receipt_type: "normal", transaction_type: "sale",
        verification_status: pick(["verified", "verified", "verified", "pending"]),
        tax_items: [{ label: "Ђ", rate: taxRate, base: baseAmount, tax: taxAmt }],
        invoice_id: i < 800 ? invoiceIds[i] : null,
        signed_at: dt, created_at: dt,
      });
    }
    await batchInsert(supabase, "fiscal_receipts", receipts);
    log.push("✓ 1,000 fiscal receipts");

    // ═══════════════════════════════════════════════════
    // 14. SUPPLIER INVOICES (500)
    // ═══════════════════════════════════════════════════
    const suppInvoices: any[] = [];
    const perMonthSI = Math.ceil(500 / TOTAL_MONTHS);
    for (let i = 0; i < 500; i++) {
      const month = Math.min(Math.floor(i / perMonthSI), TOTAL_MONTHS - 1);
      const dt = dateInRange(month);
      const yr = yearFromDate(dt);
      const amount = randAmount(5000, 200000);
      const tax = Math.round(amount * 0.2 * 100) / 100;
      const suppId = pick(supplierIds);
      const suppData = partners.find(p => p.id === suppId)!;
      suppInvoices.push({
        id: uuid(), tenant_id: t,
        invoice_number: `UF-${yr}-${String(i + 1).padStart(5, "0")}`,
        invoice_date: dateStr(dt),
        due_date: dateStr(new Date(new Date(dt).getTime() + 45 * 86400000).toISOString()),
        supplier_id: suppId, supplier_name: suppData.name,
        status: pick(["paid", "paid", "paid", "received", "approved"]),
        amount, tax_amount: tax, total: Math.round((amount + tax) * 100) / 100,
        currency: "RSD", legal_entity_id: le, created_at: dt,
      });
    }
    await batchInsert(supabase, "supplier_invoices", suppInvoices);
    log.push("✓ 500 supplier invoices");

    // ═══════════════════════════════════════════════════
    // 15. PURCHASE ORDERS (200)
    // ═══════════════════════════════════════════════════
    const poIds: string[] = [];
    const purchaseOrders: any[] = [];
    const perMonthPO = Math.ceil(200 / TOTAL_MONTHS);
    for (let i = 0; i < 200; i++) {
      const id = uuid();
      poIds.push(id);
      const month = Math.min(Math.floor(i / perMonthPO), TOTAL_MONTHS - 1);
      const dt = dateInRange(month);
      const yr = yearFromDate(dt);
      const suppId = pick(supplierIds);
      const suppData = partners.find(p => p.id === suppId)!;
      const subtotal = randAmount(10000, 300000);
      const tax = Math.round(subtotal * 0.2 * 100) / 100;
      purchaseOrders.push({
        id, tenant_id: t,
        order_number: `PO-${yr}-${String(i + 1).padStart(4, "0")}`,
        order_date: dateStr(dt),
        expected_date: dateStr(new Date(new Date(dt).getTime() + randInt(7, 30) * 86400000).toISOString()),
        supplier_id: suppId, supplier_name: suppData.name,
        status: pick(["received", "received", "received", "approved", "draft"]),
        currency: "RSD", subtotal, tax_amount: tax, total: Math.round((subtotal + tax) * 100) / 100,
        created_at: dt,
      });
    }
    await batchInsert(supabase, "purchase_orders", purchaseOrders);
    log.push("✓ 200 purchase orders");

    // ═══════════════════════════════════════════════════
    // 16. SALES ORDERS (300) + LINES
    // ═══════════════════════════════════════════════════
    const salesOrders: any[] = [];
    const soLines: any[] = [];
    const perMonthSO = Math.ceil(300 / TOTAL_MONTHS);
    for (let i = 0; i < 300; i++) {
      const soId = uuid();
      const month = Math.min(Math.floor(i / perMonthSO), TOTAL_MONTHS - 1);
      const dt = dateInRange(month);
      const yr = yearFromDate(dt);
      const partnerId = pick(clientIds);
      const partnerData = partners.find(p => p.id === partnerId)!;
      let subtotal = 0, taxAmount = 0;
      const numLines = randInt(1, 3);
      for (let li = 0; li < numLines; li++) {
        const pi = randInt(0, 99);
        const qty = randInt(1, 10);
        const price = products[pi].default_sale_price;
        const lineTotal = Math.round(qty * price * 100) / 100;
        const taxRate = pi < 75 ? 20 : pi < 90 ? 10 : 0;
        const lineTax = Math.round(lineTotal * taxRate / 100 * 100) / 100;
        subtotal += lineTotal;
        taxAmount += lineTax;
        soLines.push({
          id: uuid(), sales_order_id: soId,
          product_id: prodIds[pi], description: productNames[pi],
          quantity: qty, unit_price: price, line_total: lineTotal,
          tax_rate_id: pi < 75 ? TAX_20 : pi < 90 ? TAX_10 : TAX_0,
          tax_rate_value: taxRate, tax_amount: lineTax,
          total_with_tax: Math.round((lineTotal + lineTax) * 100) / 100,
          sort_order: li + 1,
        });
      }
      salesOrders.push({
        id: soId, tenant_id: t,
        order_number: `SO-${yr}-${String(i + 1).padStart(5, "0")}`,
        order_date: dateStr(dt),
        partner_id: partnerId, partner_name: partnerData.name,
        status: pick(["pending", "confirmed", "confirmed", "shipped", "delivered"]),
        currency: "RSD",
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: Math.round((subtotal + taxAmount) * 100) / 100,
        created_at: dt,
      });
    }
    await batchInsert(supabase, "sales_orders", salesOrders);
    await batchInsert(supabase, "sales_order_lines", soLines);
    log.push(`✓ 300 sales orders + ${soLines.length} lines`);

    // ═══════════════════════════════════════════════════
    // 17. QUOTES (300) + LINES
    // ═══════════════════════════════════════════════════
    const quotes: any[] = [];
    const quoteLines: any[] = [];
    const perMonthQ = Math.ceil(300 / TOTAL_MONTHS);
    for (let i = 0; i < 300; i++) {
      const qId = uuid();
      const month = Math.min(Math.floor(i / perMonthQ), TOTAL_MONTHS - 1);
      const dt = dateInRange(month);
      const yr = yearFromDate(dt);
      const partnerId = pick(clientIds);
      const partnerData = partners.find(p => p.id === partnerId)!;
      let subtotal = 0, taxAmount = 0;
      const numLines = randInt(1, 5);
      for (let li = 0; li < numLines; li++) {
        const pi = randInt(0, 99);
        const qty = randInt(1, 15);
        const price = products[pi].default_sale_price;
        const lineTotal = Math.round(qty * price * 100) / 100;
        const taxRate = pi < 75 ? 20 : pi < 90 ? 10 : 0;
        const lineTax = Math.round(lineTotal * taxRate / 100 * 100) / 100;
        subtotal += lineTotal;
        taxAmount += lineTax;
        quoteLines.push({
          id: uuid(), quote_id: qId,
          product_id: prodIds[pi], description: productNames[pi],
          quantity: qty, unit_price: price, line_total: lineTotal,
          tax_rate_id: pi < 75 ? TAX_20 : pi < 90 ? TAX_10 : TAX_0,
          tax_rate_value: taxRate, tax_amount: lineTax,
          total_with_tax: Math.round((lineTotal + lineTax) * 100) / 100,
          sort_order: li + 1,
        });
      }
      quotes.push({
        id: qId, tenant_id: t,
        quote_number: `Q-${yr}-${String(i + 1).padStart(4, "0")}`,
        quote_date: dateStr(dt),
        valid_until: dateStr(new Date(new Date(dt).getTime() + 30 * 86400000).toISOString()),
        partner_id: partnerId, partner_name: partnerData.name,
        status: pick(["accepted", "accepted", "sent", "draft", "expired"]),
        currency: "RSD",
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: Math.round((subtotal + taxAmount) * 100) / 100,
        created_at: dt,
      });
    }
    await batchInsert(supabase, "quotes", quotes);
    await batchInsert(supabase, "quote_lines", quoteLines);
    log.push(`✓ 300 quotes + ${quoteLines.length} lines`);

    // ═══════════════════════════════════════════════════
    // 18. PRODUCTION ORDERS (200)
    // ═══════════════════════════════════════════════════
    const prodOrders: any[] = [];
    const perMonthProd = Math.ceil(200 / TOTAL_MONTHS);
    for (let i = 0; i < 200; i++) {
      const month = Math.min(Math.floor(i / perMonthProd), TOTAL_MONTHS - 1);
      const dtStart = dateInRange(month);
      const yr = yearFromDate(dtStart);
      const dtEnd = new Date(new Date(dtStart).getTime() + randInt(3, 14) * 86400000).toISOString();
      const qty = randInt(10, 500);
      const status = pick(["completed", "completed", "completed", "in_progress", "planned"]);
      prodOrders.push({
        id: uuid(), tenant_id: t,
        order_number: `PROD-${yr}-${String(i + 1).padStart(4, "0")}`,
        product_id: prodIds[randInt(0, 29)],
        quantity: qty,
        completed_quantity: status === "completed" ? qty : status === "in_progress" ? randInt(0, qty) : 0,
        status,
        planned_start: dateStr(dtStart), planned_end: dateStr(dtEnd),
        actual_start: status !== "planned" ? dateStr(dtStart) : null,
        actual_end: status === "completed" ? dateStr(dtEnd) : null,
        created_at: dtStart,
      });
    }
    await batchInsert(supabase, "production_orders", prodOrders);
    log.push("✓ 200 production orders");

    // ═══════════════════════════════════════════════════
    // 19. POS SESSIONS + TRANSACTIONS (Jan 2025 through today)
    // ═══════════════════════════════════════════════════
    const sessions: any[] = [];
    const transactions: any[] = [];
    const startDate = new Date(2025, 0, 1);
    const totalDays = Math.floor((NOW.getTime() - startDate.getTime()) / 86400000);
    for (let day = 0; day < totalDays; day++) {
      const sessionDate = new Date(2025, 0, day + 1, 8, 0);
      const closeDate = new Date(2025, 0, day + 1, 20, 0);
      if (sessionDate.getDay() === 0 || sessionDate.getDay() === 6) continue;
      if (sessionDate > NOW) break;

      const sessionId = uuid();
      const locIdx = day % 3;
      const dailyTotal = randAmount(10000, 80000);
      sessions.push({
        id: sessionId, tenant_id: t,
        location_id: locIds[locIdx], fiscal_device_id: fdIds[locIdx], warehouse_id: whIds[locIdx],
        opened_at: sessionDate.toISOString(), closed_at: closeDate.toISOString(),
        opening_balance: 5000, closing_balance: 5000 + dailyTotal,
        status: "closed",
      });

      const numTx = randInt(3, 8);
      for (let tx = 0; tx < numTx; tx++) {
        const txTime = new Date(sessionDate.getTime() + randInt(0, 11 * 3600000)).toISOString();
        const txTotal = randAmount(500, 15000);
        const txTax = Math.round(txTotal / 6 * 100) / 100;
        const pi = randInt(0, 99);
        transactions.push({
          id: uuid(), tenant_id: t, session_id: sessionId,
          transaction_number: `TX-${day + 1}-${tx + 1}`,
          total: txTotal, subtotal: Math.round((txTotal - txTax) * 100) / 100, tax_amount: txTax,
          payment_method: pick(["cash", "card", "card", "cash"]),
          status: "completed", receipt_type: "normal", is_fiscal: true,
          items: [{ product_id: prodIds[pi], name: productNames[pi], quantity: randInt(1, 5), price: txTotal, total: txTotal }],
          location_id: locIds[locIdx], fiscal_device_id: fdIds[locIdx], warehouse_id: whIds[locIdx],
          created_at: txTime,
        });
      }
    }
    await batchInsert(supabase, "pos_sessions", sessions);
    await batchInsert(supabase, "pos_transactions", transactions);
    log.push(`✓ ${sessions.length} POS sessions + ${transactions.length} transactions`);

    // ═══════════════════════════════════════════════════
    // 20. GOODS RECEIPTS (200)
    // ═══════════════════════════════════════════════════
    const goodsReceipts: any[] = [];
    const grLines: any[] = [];
    const perMonthGR = Math.ceil(200 / TOTAL_MONTHS);
    for (let i = 0; i < 200; i++) {
      const grId = uuid();
      const month = Math.min(Math.floor(i / perMonthGR), TOTAL_MONTHS - 1);
      const dt = dateInRange(month);
      const yr = yearFromDate(dt);
      goodsReceipts.push({
        id: grId, tenant_id: t,
        receipt_number: `GR-${yr}-${String(i + 1).padStart(4, "0")}`,
        received_at: dt, warehouse_id: pick(whIds),
        purchase_order_id: i < 500 ? poIds[i % poIds.length] : null,
        status: "confirmed", created_at: dt,
      });
      const numLines = randInt(1, 4);
      for (let li = 0; li < numLines; li++) {
        const pi = randInt(0, 99);
        const qty = randInt(5, 100);
        grLines.push({
          id: uuid(), goods_receipt_id: grId,
          product_id: prodIds[pi],
          quantity_ordered: qty, quantity_received: qty - randInt(0, 3),
        });
      }
    }
    await batchInsert(supabase, "goods_receipts", goodsReceipts);
    await batchInsert(supabase, "goods_receipt_lines", grLines);
    log.push(`✓ 200 goods receipts + ${grLines.length} lines`);

    // ═══════════════════════════════════════════════════
    // 21. INVENTORY MOVEMENTS (3,000)
    // ═══════════════════════════════════════════════════
    const movements: any[] = [];
    const perMonthMov = Math.ceil(3000 / TOTAL_MONTHS);
    for (let i = 0; i < 3000; i++) {
      const month = Math.min(Math.floor(i / perMonthMov), TOTAL_MONTHS - 1);
      const dt = dateInRange(month);
      const yr = yearFromDate(dt);
      const type = pick(["in", "in", "out", "out", "out", "adjustment"]);
      movements.push({
        id: uuid(), tenant_id: t,
        product_id: prodIds[randInt(0, 99)], warehouse_id: pick(whIds),
        movement_type: type, quantity: randInt(1, 50), unit_cost: randAmount(500, 30000),
        reference: type === "in" ? `GR-${yr}-${String(randInt(1, 500)).padStart(4, "0")}` : `SO-${yr}-${String(randInt(1, 1000)).padStart(5, "0")}`,
        notes: null, created_at: dt,
      });
    }
    await batchInsert(supabase, "inventory_movements", movements);
    log.push("✓ 3,000 inventory movements");

    // ═══════════════════════════════════════════════════
    // 22. CRM LEADS (200)
    // ═══════════════════════════════════════════════════
    const leadStatuses = ["new", "new", "contacted", "contacted", "qualified", "converted", "lost"];
    const leadSources = ["website", "referral", "linkedin", "cold_call", "conference", "email"];
    const crmLeads: any[] = [];
    const perMonthLeads = Math.ceil(200 / TOTAL_MONTHS);
    for (let i = 0; i < 200; i++) {
      const month = Math.min(Math.floor(i / perMonthLeads), TOTAL_MONTHS - 1);
      const dt = dateInRange(month);
      const fn = pick(firstNames);
      const ln = pick(lastNames);
      crmLeads.push({
        id: uuid(), tenant_id: t,
        name: `${fn} ${ln}`, first_name: fn, last_name: ln,
        company: pick(companyNames),
        email: `${fn.toLowerCase()}.${ln.toLowerCase().replace(/[ćčžšđ]/g, c => ({ć:"c",č:"c",ž:"z",š:"s",đ:"d"}[c] || c))}@example.rs`,
        phone: `+381${randInt(60, 69)}${randInt(1000000, 9999999)}`,
        status: pick(leadStatuses), source: pick(leadSources),
        notes: pick(["Zainteresovan za IT infrastrukturu", "Potreban ERP sistem", "Cloud migracija", "Nadogradnja mreže", null]),
        created_at: dt, updated_at: dt,
      });
    }
    await batchInsert(supabase, "leads", crmLeads);
    log.push("✓ 200 CRM leads");

    // ═══════════════════════════════════════════════════
    // 23. CRM OPPORTUNITIES (100)
    // ═══════════════════════════════════════════════════
    const oppStages = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"];
    const opportunities: any[] = [];
    const perMonthOpp = Math.ceil(100 / TOTAL_MONTHS);
    for (let i = 0; i < 100; i++) {
      const month = Math.min(Math.floor(i / perMonthOpp), TOTAL_MONTHS - 1);
      const dt = dateInRange(month);
      const stage = pick(oppStages);
      const value = randAmount(50000, 5000000);
      opportunities.push({
        id: uuid(), tenant_id: t,
        title: `${pick(["ERP implementacija", "Cloud migracija", "IT infrastruktura", "Mrežno rešenje", "Softverski razvoj", "Cybersecurity audit", "Server konsolidacija", "VoIP sistem"])} - ${pick(companyNames)}`,
        value, currency: "RSD", stage,
        probability: stage === "closed_won" ? 100 : stage === "closed_lost" ? 0 : randInt(10, 90),
        partner_id: pick(clientIds),
        expected_close_date: dateStr(new Date(new Date(dt).getTime() + randInt(14, 90) * 86400000).toISOString()),
        closed_at: (stage === "closed_won" || stage === "closed_lost") ? dt : null,
        description: "Prilika za poslovnu saradnju",
        created_at: dt, updated_at: dt,
      });
    }
    await batchInsert(supabase, "opportunities", opportunities);
    log.push("✓ 100 CRM opportunities");

    // ═══════════════════════════════════════════════════
    // 24. ANNUAL LEAVE BALANCES (2025 + 2026)
    // ═══════════════════════════════════════════════════
    const leaveBalances: any[] = [];
    for (const empId of empIds) {
      for (const yr of [2025, 2026]) {
        const entitled = pick([20, 21, 22, 25]);
        const used = yr === 2025 ? randInt(0, Math.min(entitled, 15)) : randInt(0, 3);
        leaveBalances.push({
          id: uuid(), tenant_id: t, employee_id: empId,
          year: yr, entitled_days: entitled, used_days: used,
          carried_over_days: yr === 2026 ? randInt(0, 5) : 0,
        });
      }
    }
    await batchInsert(supabase, "annual_leave_balances", leaveBalances);
    log.push(`✓ ${leaveBalances.length} annual leave balances`);

    // ═══════════════════════════════════════════════════
    // 25. WORK LOGS (10 employees x working days through today)
    // ═══════════════════════════════════════════════════
    const workLogs: any[] = [];
    for (const empId of empIds.slice(0, 10)) {
      for (let day = 0; day < totalDays; day++) {
        const d = new Date(2025, 0, day + 1);
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        if (d > NOW) break;
        const dateS = d.toISOString().slice(0, 10);
        workLogs.push({
          id: uuid(), tenant_id: t, employee_id: empId,
          date: dateS,
          type: pick(["regular", "regular", "regular", "regular", "overtime", "sick"]),
          hours: 8, note: null,
        });
      }
    }
    await batchInsert(supabase, "work_logs", workLogs);
    log.push(`✓ ${workLogs.length} work logs`);

    // ═══════════════════════════════════════════════════
    // 26. OPEN ITEMS (AR/AP)
    // ═══════════════════════════════════════════════════
    const openItems: any[] = [];
    for (let i = 0; i < 200; i++) {
      const inv = invoices[i * 10];
      if (!inv) break;
      const paid = inv.status === "paid" ? inv.total : randAmount(0, inv.total);
      openItems.push({
        id: uuid(), tenant_id: t,
        document_type: "invoice", document_number: inv.invoice_number,
        document_id: inv.id, document_date: inv.invoice_date, due_date: inv.due_date,
        partner_id: inv.partner_id, direction: "receivable",
        original_amount: inv.total,
        paid_amount: Math.round(paid * 100) / 100,
        remaining_amount: Math.round((inv.total - paid) * 100) / 100,
        currency: "RSD",
        status: inv.total <= paid ? "closed" : "open",
        closed_at: inv.total <= paid ? inv.created_at : null,
      });
    }
    for (let i = 0; i < 100; i++) {
      const si = suppInvoices[i * 5];
      if (!si) break;
      const paid = si.status === "paid" ? si.total : randAmount(0, si.total);
      openItems.push({
        id: uuid(), tenant_id: t,
        document_type: "supplier_invoice", document_number: si.invoice_number,
        document_id: si.id, document_date: si.invoice_date, due_date: si.due_date,
        partner_id: si.supplier_id, direction: "payable",
        original_amount: si.total,
        paid_amount: Math.round(paid * 100) / 100,
        remaining_amount: Math.round((si.total - paid) * 100) / 100,
        currency: "RSD",
        status: si.total <= paid ? "closed" : "open",
        closed_at: si.total <= paid ? si.created_at : null,
      });
    }
    await batchInsert(supabase, "open_items", openItems);
    log.push(`✓ ${openItems.length} open items`);

    // ═══════════════════════════════════════════════════
    // 27. JOURNAL ENTRIES
    // ═══════════════════════════════════════════════════
    const journalEntries: any[] = [];
    const journalLines: any[] = [];
    
    const ccIds = [uuid(), uuid(), uuid(), uuid(), uuid()];
    const costCenters = [
      { id: ccIds[0], tenant_id: t, code: "CC-IT", name: "IT", is_active: true },
      { id: ccIds[1], tenant_id: t, code: "CC-SALES", name: "Prodaja", is_active: true },
      { id: ccIds[2], tenant_id: t, code: "CC-FIN", name: "Finansije", is_active: true },
      { id: ccIds[3], tenant_id: t, code: "CC-LOG", name: "Logistika", is_active: true },
      { id: ccIds[4], tenant_id: t, code: "CC-PROD", name: "Proizvodnja", is_active: true },
    ];
    await batchInsert(supabase, "cost_centers", costCenters);
    log.push("✓ 5 cost centers");

    for (let i = 0; i < 2000; i += 4) {
      const inv = invoices[i];
      if (!inv) break;
      const jeId = uuid();
      const invDate = new Date(inv.invoice_date);
      const monthIdx = (invDate.getFullYear() - 2025) * 12 + invDate.getMonth();
      journalEntries.push({
        id: jeId, tenant_id: t,
        entry_number: `JE-D-${String(journalEntries.length + 1).padStart(5, "0")}`,
        entry_date: inv.invoice_date,
        description: `Faktura ${inv.invoice_number}`,
        reference: inv.invoice_number,
        status: "posted",
        fiscal_period_id: fpIds[Math.min(monthIdx, fpIds.length - 1)],
        posted_at: inv.created_at, legal_entity_id: le, source: "manual",
      });
      const ccId = pick(ccIds);
      journalLines.push(
        { id: uuid(), journal_entry_id: jeId, account_id: ACC_AR, debit: inv.total, credit: 0, description: "Kupac", sort_order: 1, cost_center_id: ccId },
        { id: uuid(), journal_entry_id: jeId, account_id: ACC_REVENUE, debit: 0, credit: inv.subtotal, description: "Prihod", sort_order: 2, cost_center_id: ccId },
        { id: uuid(), journal_entry_id: jeId, account_id: ACC_VAT, debit: 0, credit: inv.tax_amount, description: "PDV obaveza", sort_order: 3 },
      );
    }
    
    for (let i = 0; i < 500; i += 5) {
      const si = suppInvoices[i];
      if (!si) break;
      const jeId = uuid();
      const siDate = new Date(si.invoice_date);
      const monthIdx = (siDate.getFullYear() - 2025) * 12 + siDate.getMonth();
      journalEntries.push({
        id: jeId, tenant_id: t,
        entry_number: `JE-D-${String(journalEntries.length + 1).padStart(5, "0")}`,
        entry_date: si.invoice_date,
        description: `Ulazna faktura ${si.invoice_number}`,
        reference: si.invoice_number,
        status: "posted",
        fiscal_period_id: fpIds[Math.min(monthIdx, fpIds.length - 1)],
        posted_at: si.created_at, legal_entity_id: le, source: "manual",
      });
      const ccId = pick(ccIds);
      journalLines.push(
        { id: uuid(), journal_entry_id: jeId, account_id: ACC_EXPENSES, debit: si.amount, credit: 0, description: "Trošak", sort_order: 1, cost_center_id: ccId },
        { id: uuid(), journal_entry_id: jeId, account_id: ACC_VAT, debit: si.tax_amount, credit: 0, description: "PDV pretporez", sort_order: 2 },
        { id: uuid(), journal_entry_id: jeId, account_id: ACC_AP, debit: 0, credit: si.total, description: "Dobavljač", sort_order: 3 },
      );
    }
    
    await batchInsert(supabase, "journal_entries", journalEntries);
    await batchInsert(supabase, "journal_lines", journalLines);
    log.push(`✓ ${journalEntries.length} journal entries + ${journalLines.length} lines`);

    // ═══════════════════════════════════════════════════
    // 28. BUDGETS (2025 + 2026)
    // ═══════════════════════════════════════════════════
    const { data: budgetAccounts } = await supabase
      .from("chart_of_accounts").select("id, account_type")
      .eq("tenant_id", t).in("account_type", ["revenue", "expense"]).eq("is_active", true);
    
    const budgetRows: any[] = [];
    for (const acct of (budgetAccounts || [])) {
      for (const yr of [2025, 2026]) {
        const maxMonth = yr === NOW.getFullYear() ? NOW.getMonth() + 1 : 12;
        for (let m = 1; m <= maxMonth; m++) {
          budgetRows.push({
            id: uuid(), tenant_id: t, account_id: acct.id,
            fiscal_year: yr, month: m,
            amount: acct.account_type === "revenue" ? randAmount(500000, 2000000) : randAmount(100000, 800000),
          });
        }
      }
    }
    await batchInsert(supabase, "budgets", budgetRows);
    log.push(`✓ ${budgetRows.length} budget rows`);

    // ═══════════════════════════════════════════════════
    // 29. BANK ACCOUNTS + BANK STATEMENTS (through current month)
    // ═══════════════════════════════════════════════════
    const bankAccId = uuid();
    await batchInsert(supabase, "bank_accounts", [{
      id: bankAccId, tenant_id: t, legal_entity_id: le,
      bank_name: "Komercijalna Banka", account_number: "205-1234567890123-45",
      currency: "RSD", is_primary: true, is_active: true,
    }]);
    
    const bankStatements: any[] = [];
    let balance = 5000000;
    for (let m = 0; m < TOTAL_MONTHS; m++) {
      const opening = balance;
      const netChange = randAmount(-500000, 1500000);
      balance = Math.round((balance + netChange) * 100) / 100;
      const year = 2025 + Math.floor(m / 12);
      const monthInYear = m % 12;
      const stDate = new Date(year, monthInYear + 1, 0);
      bankStatements.push({
        id: uuid(), tenant_id: t, bank_account_id: bankAccId,
        statement_date: stDate.toISOString().slice(0, 10),
        statement_number: `BS-${year}-${String(monthInYear + 1).padStart(2, "0")}`,
        opening_balance: opening, closing_balance: balance,
        currency: "RSD", status: "processed",
      });
    }
    await batchInsert(supabase, "bank_statements", bankStatements);
    log.push(`✓ 1 bank account + ${bankStatements.length} bank statements`);

    // ═══════════════════════════════════════════════════
    // 30. LOANS
    // ═══════════════════════════════════════════════════
    const loanRows: any[] = [];
    const loanConfigs = [
      { type: "payable", desc: "Investicioni kredit", principal: 10000000, rate: 5.5, term: 60 },
      { type: "payable", desc: "Revolving kredit", principal: 3000000, rate: 7.0, term: 12 },
      { type: "payable", desc: "Kredit za opremu", principal: 5000000, rate: 6.0, term: 36 },
    ];
    for (const lc of loanConfigs) {
      loanRows.push({
        id: uuid(), tenant_id: t, partner_id: pick(supplierIds),
        type: lc.type, description: lc.desc,
        principal: lc.principal, interest_rate: lc.rate,
        start_date: "2025-01-15", term_months: lc.term,
        currency: "RSD", status: "active",
      });
    }
    await batchInsert(supabase, "loans", loanRows);
    log.push("✓ 3 loans");

    // ═══════════════════════════════════════════════════
    // 31. AR/AP AGING SNAPSHOTS (through current month)
    // ═══════════════════════════════════════════════════
    const arSnapshots: any[] = [];
    const apSnapshots: any[] = [];
    for (let m = 0; m < TOTAL_MONTHS; m++) {
      const year = 2025 + Math.floor(m / 12);
      const monthInYear = m % 12;
      const snapDate = new Date(year, monthInYear + 1, 0).toISOString().slice(0, 10);
      const arTotal = randAmount(2000000, 8000000);
      arSnapshots.push({
        id: uuid(), tenant_id: t, snapshot_date: snapDate,
        bucket_current: Math.round(arTotal * 0.40), bucket_30: Math.round(arTotal * 0.25),
        bucket_60: Math.round(arTotal * 0.15), bucket_90: Math.round(arTotal * 0.10),
        bucket_over90: Math.round(arTotal * 0.10), total_outstanding: Math.round(arTotal),
      });
      const apTotal = randAmount(1000000, 4000000);
      apSnapshots.push({
        id: uuid(), tenant_id: t, snapshot_date: snapDate,
        bucket_current: Math.round(apTotal * 0.50), bucket_30: Math.round(apTotal * 0.25),
        bucket_60: Math.round(apTotal * 0.15), bucket_90: Math.round(apTotal * 0.07),
        bucket_over90: Math.round(apTotal * 0.03), total_outstanding: Math.round(apTotal),
      });
    }
    await batchInsert(supabase, "ar_aging_snapshots", arSnapshots);
    await batchInsert(supabase, "ap_aging_snapshots", apSnapshots);
    log.push(`✓ ${TOTAL_MONTHS} AR + ${TOTAL_MONTHS} AP aging snapshots`);

    // ═══════════════════════════════════════════════════
    // 32. CURRENCIES
    // ═══════════════════════════════════════════════════
    const currencyRows = [
      { id: uuid(), tenant_id: t, code: "RSD", name: "Srpski dinar", symbol: "RSD", is_base: true, is_active: true },
      { id: uuid(), tenant_id: t, code: "EUR", name: "Evro", symbol: "€", is_base: false, is_active: true },
      { id: uuid(), tenant_id: t, code: "USD", name: "Američki dolar", symbol: "$", is_base: false, is_active: true },
      { id: uuid(), tenant_id: t, code: "CHF", name: "Švajcarski franak", symbol: "CHF", is_base: false, is_active: true },
      { id: uuid(), tenant_id: t, code: "GBP", name: "Britanska funta", symbol: "£", is_base: false, is_active: true },
    ];
    await batchInsert(supabase, "currencies", currencyRows);
    log.push("✓ 5 currencies");

    // ═══════════════════════════════════════════════════
    // 33. EXCHANGE RATES (monthly for all months through today)
    // ═══════════════════════════════════════════════════
    const exRates: any[] = [];
    const baseRates: Record<string, number> = { EUR: 117.2, USD: 108.5, CHF: 121.0, GBP: 136.5 };
    for (const [code, base] of Object.entries(baseRates)) {
      for (let m = 0; m < TOTAL_MONTHS; m++) {
        const year = 2025 + Math.floor(m / 12);
        const monthInYear = m % 12;
        const rd = new Date(year, monthInYear, 15).toISOString().slice(0, 10);
        exRates.push({
          id: uuid(), tenant_id: t,
          from_currency: code, to_currency: "RSD",
          rate: Math.round((base + randAmount(-2, 2)) * 10000) / 10000,
          rate_date: rd, source: "nbs",
        });
      }
    }
    await batchInsert(supabase, "exchange_rates", exRates);
    log.push(`✓ ${exRates.length} exchange rates`);

    // ═══════════════════════════════════════════════════
    // 34. HOLIDAYS (2025 + 2026)
    // ═══════════════════════════════════════════════════
    const holidayRows: any[] = [];
    for (const yr of [2025, 2026]) {
      holidayRows.push(
        { id: uuid(), tenant_id: null as any, company_id: null, name: "Nova godina", date: `${yr}-01-01`, is_recurring: true },
        { id: uuid(), tenant_id: null as any, company_id: null, name: "Nova godina 2", date: `${yr}-01-02`, is_recurring: true },
        { id: uuid(), tenant_id: null as any, company_id: null, name: "Božić", date: `${yr}-01-07`, is_recurring: true },
        { id: uuid(), tenant_id: null as any, company_id: null, name: "Sretenje", date: `${yr}-02-15`, is_recurring: true },
        { id: uuid(), tenant_id: null as any, company_id: null, name: "Sretenje 2", date: `${yr}-02-16`, is_recurring: true },
        { id: uuid(), tenant_id: null as any, company_id: null, name: "Praznik rada", date: `${yr}-05-01`, is_recurring: true },
        { id: uuid(), tenant_id: null as any, company_id: null, name: "Praznik rada 2", date: `${yr}-05-02`, is_recurring: true },
        { id: uuid(), tenant_id: null as any, company_id: null, name: "Dan primirja", date: `${yr}-11-11`, is_recurring: true },
      );
    }
    // 2025 specific
    holidayRows.push(
      { id: uuid(), tenant_id: null as any, company_id: null, name: "Veliki petak", date: "2025-04-18", is_recurring: false },
      { id: uuid(), tenant_id: null as any, company_id: null, name: "Uskrs ponedeljak", date: "2025-04-21", is_recurring: false },
    );
    // 2026 specific (Orthodox Easter 2026)
    holidayRows.push(
      { id: uuid(), tenant_id: null as any, company_id: null, name: "Veliki petak", date: "2026-04-10", is_recurring: false },
      { id: uuid(), tenant_id: null as any, company_id: null, name: "Uskrs ponedeljak", date: "2026-04-13", is_recurring: false },
    );
    await batchInsert(supabase, "holidays", holidayRows);
    log.push(`✓ ${holidayRows.length} holidays`);

    // ═══════════════════════════════════════════════════
    // 35. POSITION TEMPLATES
    // ═══════════════════════════════════════════════════
    const posTemplates = [
      "Senior Developer", "Junior Developer", "Project Manager",
      "System Administrator", "Sales Manager", "Accountant",
      "Warehouse Operator", "QA Engineer", "DevOps Engineer", "Business Analyst",
    ].map((name, i) => ({
      id: uuid(), tenant_id: t, name, code: `POS-${String(i + 1).padStart(3, "0")}`, is_active: true,
    }));
    await batchInsert(supabase, "position_templates", posTemplates);
    log.push("✓ 10 position templates");

    // ═══════════════════════════════════════════════════
    // 36. SALESPEOPLE
    // ═══════════════════════════════════════════════════
    const spIds: string[] = [];
    const salespeople = empIds.slice(0, 5).map(empId => {
      const id = uuid();
      spIds.push(id);
      const emp = employees.find((e: any) => e.id === empId)!;
      return {
        id, tenant_id: t, employee_id: empId,
        first_name: emp.first_name, last_name: emp.last_name,
        code: `SP-${String(spIds.length).padStart(3, "0")}`,
        email: emp.email, is_active: true, commission_rate: randAmount(3, 10),
      };
    });
    await batchInsert(supabase, "salespeople", salespeople);
    log.push("✓ 5 salespeople");

    // ═══════════════════════════════════════════════════
    // 37. SALES CHANNELS
    // ═══════════════════════════════════════════════════
    const scIds: string[] = [];
    const salesChannels = [
      { name: "Direktna prodaja", type: "direct" },
      { name: "Web prodavnica", type: "web" },
      { name: "Partnerska mreža", type: "partner" },
      { name: "Telefonska prodaja", type: "phone" },
    ].map(sc => {
      const id = uuid();
      scIds.push(id);
      return { id, tenant_id: t, name: sc.name, type: sc.type, is_active: true };
    });
    await batchInsert(supabase, "sales_channels", salesChannels);
    log.push("✓ 4 sales channels");

    // ═══════════════════════════════════════════════════
    // 38. SALES TARGETS (2025 + 2026)
    // ═══════════════════════════════════════════════════
    const salesTargets: any[] = [];
    for (const spId of spIds) {
      for (const yr of [2025, 2026]) {
        const maxMonth = yr === NOW.getFullYear() ? NOW.getMonth() + 1 : 12;
        for (let m = 1; m <= maxMonth; m++) {
          salesTargets.push({
            id: uuid(), tenant_id: t, salesperson_id: spId,
            month: m, year: yr,
            target_amount: randAmount(500000, 2000000), target_type: "revenue",
          });
        }
      }
    }
    await batchInsert(supabase, "sales_targets", salesTargets);
    log.push(`✓ ${salesTargets.length} sales targets`);

    // ═══════════════════════════════════════════════════
    // 39. PDV PERIODS (dynamic, matching fiscal periods)
    // ═══════════════════════════════════════════════════
    const pdvPeriodIds: string[] = [];
    const pdvPeriods = [];
    for (let m = 0; m < TOTAL_MONTHS; m++) {
      const id = uuid();
      pdvPeriodIds.push(id);
      const year = 2025 + Math.floor(m / 12);
      const monthInYear = m % 12;
      const start = new Date(year, monthInYear, 1);
      const end = new Date(year, monthInYear + 1, 0);
      pdvPeriods.push({
        id, tenant_id: t,
        period_name: `PDV ${String(monthInYear + 1).padStart(2, "0")}/${year}`,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        status: m < TOTAL_MONTHS - 2 ? "filed" : "open",
      });
    }
    await batchInsert(supabase, "pdv_periods", pdvPeriods);
    log.push(`✓ ${TOTAL_MONTHS} PDV periods`);

    // ═══════════════════════════════════════════════════
    // 40. PDV ENTRIES
    // ═══════════════════════════════════════════════════
    const pdvEntries: any[] = [];
    for (let i = 0; i < 2000; i += 7) {
      const inv = invoices[i];
      if (!inv) break;
      const invDate = new Date(inv.invoice_date);
      const monthIdx = (invDate.getFullYear() - 2025) * 12 + invDate.getMonth();
      pdvEntries.push({
        id: uuid(), tenant_id: t,
        pdv_period_id: pdvPeriodIds[Math.min(monthIdx, pdvPeriodIds.length - 1)],
        document_type: "invoice", document_number: inv.invoice_number,
        document_date: inv.invoice_date,
        partner_name: inv.partner_name, partner_pib: inv.partner_pib,
        base_amount: inv.subtotal, vat_amount: inv.tax_amount,
        vat_rate: 20, direction: "output", popdv_section: "3.1",
      });
    }
    for (let i = 0; i < 500; i += 5) {
      const si = suppInvoices[i];
      if (!si) break;
      const siDate = new Date(si.invoice_date);
      const monthIdx = (siDate.getFullYear() - 2025) * 12 + siDate.getMonth();
      pdvEntries.push({
        id: uuid(), tenant_id: t,
        pdv_period_id: pdvPeriodIds[Math.min(monthIdx, pdvPeriodIds.length - 1)],
        document_type: "supplier_invoice", document_number: si.invoice_number,
        document_date: si.invoice_date,
        partner_name: si.supplier_name, partner_pib: null,
        base_amount: si.amount, vat_amount: si.tax_amount,
        vat_rate: 20, direction: "input", popdv_section: "8.1",
      });
    }
    await batchInsert(supabase, "pdv_entries", pdvEntries);
    log.push(`✓ ${pdvEntries.length} PDV entries`);

    // ═══════════════════════════════════════════════════
    // 41. PURCHASE ORDER LINES
    // ═══════════════════════════════════════════════════
    const poLines: any[] = [];
    for (let i = 0; i < poIds.length; i++) {
      const numLines = randInt(1, 3);
      for (let li = 0; li < numLines; li++) {
        const pi = randInt(0, 99);
        const qty = randInt(5, 50);
        const price = products[pi].default_purchase_price;
        const lineTotal = Math.round(qty * price * 100) / 100;
        poLines.push({
          id: uuid(), purchase_order_id: poIds[i],
          product_id: prodIds[pi], description: productNames[pi],
          quantity: qty, unit_price: price, total: lineTotal,
          sort_order: li + 1,
        });
      }
    }
    await batchInsert(supabase, "purchase_order_lines", poLines);
    log.push(`✓ ${poLines.length} PO lines`);

    // ═══════════════════════════════════════════════════
    // 42. BOM TEMPLATES + LINES
    // ═══════════════════════════════════════════════════
    const bomIds: string[] = [];
    const bomTemplates: any[] = [];
    const bomLines: any[] = [];
    for (let i = 0; i < 20; i++) {
      const id = uuid();
      bomIds.push(id);
      bomTemplates.push({
        id, tenant_id: t, product_id: prodIds[i],
        name: `BOM - ${productNames[i]}`, version: 1, is_active: true,
        notes: `Sastavnica za ${productNames[i]}`,
      });
      const numMats = randInt(3, 5);
      for (let li = 0; li < numMats; li++) {
        bomLines.push({
          id: uuid(), bom_template_id: id,
          material_product_id: prodIds[randInt(20, 99)],
          quantity: randAmount(1, 10), unit: "kom", sort_order: li,
        });
      }
    }
    await batchInsert(supabase, "bom_templates", bomTemplates);
    await batchInsert(supabase, "bom_lines", bomLines);
    log.push(`✓ 20 BOM templates + ${bomLines.length} lines`);

    // ═══════════════════════════════════════════════════
    // 43. LINK PRODUCTION ORDERS TO BOMs
    // ═══════════════════════════════════════════════════
    for (let i = 0; i < prodOrders.length; i++) {
      const bomId = bomIds[i % bomIds.length];
      await supabase.from("production_orders").update({ bom_template_id: bomId }).eq("id", prodOrders[i].id);
    }
    log.push("✓ 200 production orders linked to BOMs");

    // ═══════════════════════════════════════════════════
    // 44. PRODUCTION CONSUMPTION
    // ═══════════════════════════════════════════════════
    const prodConsumption: any[] = [];
    for (let i = 0; i < prodOrders.length; i++) {
      if (prodOrders[i].status === "planned") continue;
      const numMats = randInt(1, 3);
      for (let li = 0; li < numMats; li++) {
        prodConsumption.push({
          id: uuid(), production_order_id: prodOrders[i].id,
          product_id: prodIds[randInt(20, 99)],
          quantity_consumed: randAmount(1, 20), warehouse_id: pick(whIds),
        });
      }
    }
    await batchInsert(supabase, "production_consumption", prodConsumption);
    log.push(`✓ ${prodConsumption.length} production consumption`);

    // ═══════════════════════════════════════════════════
    // 45. FIXED ASSETS
    // ═══════════════════════════════════════════════════
    const assetNames = [
      "Laptop Dell Latitude 5540", "Laptop Lenovo T14", "Server Dell R750", "UPS APC 1500VA",
      "Kancelarijski nameštaj set", "Ergonomska stolica x10", "Projektor Epson", "Switch Cisco 2960",
      "Klima uređaj Daikin", "Kombi vozilo Fiat Ducato", "Printer HP LaserJet", "Skener Epson DS-530",
      "Rack kabinet 42U", "Softver SAP B1 licenca", "Desktop HP ProDesk x5", "Monitor Dell 27\" x10",
      "NAS Synology", "Firewall FortiGate", "Telefonska centrala", "Alarmni sistem",
    ];
    const faRows: any[] = [];
    const { data: assetAccounts } = await supabase
      .from("chart_of_accounts").select("id").eq("tenant_id", t)
      .eq("account_type", "asset").eq("is_active", true).limit(1);
    const faAccountId = assetAccounts?.[0]?.id || null;
    for (let i = 0; i < 20; i++) {
      const cost = randAmount(50000, 2000000);
      faRows.push({
        id: uuid(), tenant_id: t, name: assetNames[i],
        description: `Osnovno sredstvo: ${assetNames[i]}`,
        acquisition_date: `2025-${String(randInt(1, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`,
        acquisition_cost: cost, useful_life_months: pick([36, 48, 60, 120]),
        depreciation_method: "straight_line", salvage_value: Math.round(cost * 0.1),
        status: "active", account_id: faAccountId, legal_entity_id: le,
      });
    }
    await batchInsert(supabase, "fixed_assets", faRows);
    log.push("✓ 20 fixed assets");

    // ═══════════════════════════════════════════════════
    // 46. LEAVE REQUESTS (2025 + 2026)
    // ═══════════════════════════════════════════════════
    const leaveRequests: any[] = [];
    for (let i = 0; i < 50; i++) {
      const empId = pick(empIds);
      const yr = i < 40 ? 2025 : 2026;
      const startMonth = yr === 2026 ? randInt(1, 2) : randInt(1, 11);
      const startDay = randInt(1, 25);
      const days = randInt(1, 10);
      const startDate = `${yr}-${String(startMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
      const endD = new Date(yr, startMonth - 1, startDay + days);
      leaveRequests.push({
        id: uuid(), tenant_id: t, employee_id: empId,
        leave_type: pick(["vacation", "vacation", "vacation", "sick", "personal"]),
        start_date: startDate, end_date: endD.toISOString().slice(0, 10),
        days_count: days,
        reason: pick(["Godišnji odmor", "Porodični razlozi", "Bolovanje", "Lični razlozi", null]),
        status: pick(["approved", "approved", "approved", "pending", "rejected"]),
        vacation_year: yr,
      });
    }
    await batchInsert(supabase, "leave_requests", leaveRequests);
    log.push("✓ 50 leave requests");

    // ═══════════════════════════════════════════════════
    // 47. ATTENDANCE RECORDS (through today)
    // ═══════════════════════════════════════════════════
    const attendanceRows: any[] = [];
    for (const empId of empIds.slice(0, 10)) {
      for (let day = 0; day < totalDays; day++) {
        const d = new Date(2025, 0, day + 1);
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        if (d > NOW) break;
        const dateS = d.toISOString().slice(0, 10);
        const checkIn = `0${randInt(7, 9)}:${String(randInt(0, 59)).padStart(2, "0")}:00`;
        const checkOut = `${randInt(16, 18)}:${String(randInt(0, 59)).padStart(2, "0")}:00`;
        attendanceRows.push({
          id: uuid(), tenant_id: t, employee_id: empId,
          date: dateS, check_in: checkIn, check_out: checkOut,
          hours_worked: 8, status: "present",
        });
      }
    }
    await batchInsert(supabase, "attendance_records", attendanceRows);
    log.push(`✓ ${attendanceRows.length} attendance records`);

    // ═══════════════════════════════════════════════════
    // 48. PAYROLL RUNS (2025 full + 2026 Jan-Feb)
    // ═══════════════════════════════════════════════════
    const payrollRuns: any[] = [];
    const payrollItems: any[] = [];
    const payrollMonths: Array<{m: number, yr: number}> = [];
    for (let m = 1; m <= 12; m++) payrollMonths.push({ m, yr: 2025 });
    for (let m = 1; m <= NOW.getMonth() + 1; m++) payrollMonths.push({ m, yr: 2026 });

    for (const { m, yr } of payrollMonths) {
      const prId = uuid();
      let totalGross = 0, totalNet = 0, totalTax = 0, totalContrib = 0;
      for (const empId of empIds) {
        const contract = contracts.find((c: any) => c.employee_id === empId);
        const gross = contract?.gross_salary || randInt(80000, 350000);
        const taxBase = Math.round(gross * 0.85);
        const incomeTax = Math.round(taxBase * 0.10);
        const pension = Math.round(gross * 0.14);
        const health = Math.round(gross * 0.0515);
        const unemployment = Math.round(gross * 0.0075);
        const net = gross - incomeTax - pension - health - unemployment;
        const pensionEmp = Math.round(gross * 0.10);
        const healthEmp = Math.round(gross * 0.0515);
        const totalCost = gross + pensionEmp + healthEmp;
        totalGross += gross; totalNet += net;
        totalTax += incomeTax; totalContrib += pension + health + unemployment;
        payrollItems.push({
          id: uuid(), payroll_run_id: prId, employee_id: empId,
          gross_salary: gross, taxable_base: taxBase,
          income_tax: incomeTax, pension_contribution: pension,
          health_contribution: health, unemployment_contribution: unemployment,
          net_salary: net, total_cost: totalCost,
          pension_employer: pensionEmp, health_employer: healthEmp,
          working_days: 22, actual_working_days: randInt(18, 22),
        });
      }
      // Status logic
      let status: string;
      if (yr === 2025) {
        status = m < 11 ? "paid" : m === 11 ? "approved" : "draft";
      } else {
        status = m < NOW.getMonth() + 1 ? "paid" : "draft";
      }
      payrollRuns.push({
        id: prId, tenant_id: t,
        period_month: m, period_year: yr,
        status,
        total_gross: totalGross, total_net: totalNet,
        total_taxes: totalTax, total_contributions: totalContrib,
      });
    }
    await batchInsert(supabase, "payroll_runs", payrollRuns);
    await batchInsert(supabase, "payroll_items", payrollItems);
    log.push(`✓ ${payrollRuns.length} payroll runs + ${payrollItems.length} payroll items`);

    // ═══════════════════════════════════════════════════
    // 48b. PAYROLL JOURNAL ENTRIES (salary expenses)
    // ═══════════════════════════════════════════════════
    const payrollJE: any[] = [];
    const payrollJL: any[] = [];
    for (const pr of payrollRuns) {
      if (pr.status !== "paid" && pr.status !== "approved") continue;
      const jeId = uuid();
      const entryDate = `${pr.period_year}-${String(pr.period_month).padStart(2, "0")}-28`;
      const monthIdx = (pr.period_year - 2025) * 12 + (pr.period_month - 1);

      payrollJE.push({
        id: jeId, tenant_id: t,
        entry_number: `JE-PL-${pr.period_year}-${String(pr.period_month).padStart(2, "0")}`,
        entry_date: entryDate,
        description: `Plate ${String(pr.period_month).padStart(2, "0")}/${pr.period_year}`,
        reference: `PAYROLL-${pr.period_year}-${pr.period_month}`,
        status: "posted",
        fiscal_period_id: fpIds[Math.min(monthIdx, fpIds.length - 1)],
        posted_at: entryDate + "T12:00:00Z",
        legal_entity_id: le, source: "payroll",
      });

      // Employer contributions (PIO 10% + Health 5.15%)
      const employerContrib = Math.round(pr.total_gross * 0.1515);

      payrollJL.push(
        { id: uuid(), journal_entry_id: jeId, account_id: ACC_EXPENSES,
          debit: pr.total_gross, credit: 0, description: "Bruto plate", sort_order: 1 },
        { id: uuid(), journal_entry_id: jeId, account_id: ACC_EXPENSES,
          debit: employerContrib, credit: 0, description: "Doprinosi na teret poslodavca", sort_order: 2 },
        { id: uuid(), journal_entry_id: jeId, account_id: ACC_AP,
          debit: 0, credit: pr.total_net, description: "Neto plate za isplatu", sort_order: 3 },
        { id: uuid(), journal_entry_id: jeId, account_id: ACC_AP,
          debit: 0, credit: pr.total_taxes + pr.total_contributions, description: "Porez i doprinosi", sort_order: 4 },
        { id: uuid(), journal_entry_id: jeId, account_id: ACC_AP,
          debit: 0, credit: employerContrib, description: "Doprinosi poslodavac", sort_order: 5 },
      );
    }
    await batchInsert(supabase, "journal_entries", payrollJE);
    await batchInsert(supabase, "journal_lines", payrollJL);
    log.push(`✓ ${payrollJE.length} payroll journal entries + ${payrollJL.length} journal lines`);

    // ═══════════════════════════════════════════════════
    // 49. ALLOWANCE TYPES + ALLOWANCES
    // ═══════════════════════════════════════════════════
    const atIds: string[] = [];
    const allowanceTypes = [
      { name: "Topli obrok", code: "MEAL" },
      { name: "Prevoz", code: "TRANSPORT" },
      { name: "Regres", code: "REGRES" },
      { name: "Minuli rad", code: "SENIORITY" },
      { name: "Terenski dodatak", code: "FIELD" },
    ].map(at => {
      const id = uuid();
      atIds.push(id);
      return { id, tenant_id: t, name: at.name, code: at.code, is_active: true };
    });
    await batchInsert(supabase, "allowance_types", allowanceTypes);
    const allowances: any[] = [];
    for (let i = 0; i < 50; i++) {
      const yr = i < 40 ? 2025 : 2026;
      allowances.push({
        id: uuid(), tenant_id: t, employee_id: pick(empIds),
        allowance_type_id: pick(atIds),
        amount: randAmount(3000, 15000),
        month: yr === 2026 ? randInt(1, 2) : randInt(1, 12), year: yr,
      });
    }
    await batchInsert(supabase, "allowances", allowances);
    log.push("✓ 5 allowance types + 50 allowances");

    // ═══════════════════════════════════════════════════
    // 50. DEDUCTIONS
    // ═══════════════════════════════════════════════════
    const deductionRows: any[] = [];
    for (let i = 0; i < 30; i++) {
      const totalAmt = randAmount(50000, 500000);
      deductionRows.push({
        id: uuid(), tenant_id: t, employee_id: pick(empIds),
        type: pick(["loan", "loan", "advance", "union_fee", "other"]),
        description: pick(["Kredit za stan", "Pozajmica", "Sindikalna članarina", "Alimentacija", "Administrativna zabrana"]),
        total_amount: totalAmt, paid_amount: randAmount(0, totalAmt * 0.7),
        start_date: `2025-${String(randInt(1, 6)).padStart(2, "0")}-01`,
        end_date: `2026-${String(randInt(1, 12)).padStart(2, "0")}-01`,
        is_active: true,
      });
    }
    await batchInsert(supabase, "deductions", deductionRows);
    log.push("✓ 30 deductions");

    // ═══════════════════════════════════════════════════
    // 51. OVERTIME HOURS (2025 + 2026)
    // ═══════════════════════════════════════════════════
    const otRows: any[] = [];
    for (let i = 0; i < 40; i++) {
      const yr = i < 30 ? 2025 : 2026;
      otRows.push({
        id: uuid(), tenant_id: t, employee_id: pick(empIds),
        year: yr, month: yr === 2026 ? randInt(1, 2) : randInt(1, 12),
        hours: randInt(2, 20),
        tracking_type: pick(["monthly", "monthly", "weekly"]),
      });
    }
    await batchInsert(supabase, "overtime_hours", otRows);
    log.push("✓ 40 overtime hours");

    // ═══════════════════════════════════════════════════
    // 52. INSURANCE RECORDS
    // ═══════════════════════════════════════════════════
    const insRows: any[] = [];
    for (let i = 0; i < empIds.length; i++) {
      const emp = employees[i];
      insRows.push({
        id: uuid(), tenant_id: t, employee_id: empIds[i],
        first_name: emp.first_name, last_name: emp.last_name,
        jmbg: emp.jmbg,
        lbo: String(randInt(10000000000, 99999999999)),
        insurance_start: emp.start_date, registration_date: emp.start_date,
      });
    }
    await batchInsert(supabase, "insurance_records", insRows);
    log.push("✓ 25 insurance records");

    // ═══════════════════════════════════════════════════
    // 53. CRM ACTIVITIES + MEETINGS
    // ═══════════════════════════════════════════════════
    const activityRows: any[] = [];
    for (let i = 0; i < 200; i++) {
      const dt = dateInRange();
      activityRows.push({
        id: uuid(), tenant_id: t,
        type: pick(["call", "email", "meeting", "note", "task"]),
        description: pick([
          "Razgovor o ponudi", "Follow-up email", "Prezentacija proizvoda",
          "Dogovor o isporuci", "Reklamacija", "Ugovaranje sastanka",
          "Slanje kataloga", "Tehnička podrška", "Demo poziv", "Pregovori o ceni",
        ]),
        company_id: pick(crmCompanyIds), contact_id: pick(contactIds),
        lead_id: i < 100 ? crmLeads[i]?.id || null : null,
        opportunity_id: i < 100 ? opportunities[i]?.id || null : null,
        created_at: dt,
      });
    }
    await batchInsert(supabase, "activities", activityRows);
    log.push("✓ 200 CRM activities");

    const meetingRows: any[] = [];
    for (let i = 0; i < 30; i++) {
      const dt = dateInRange();
      meetingRows.push({
        id: uuid(), tenant_id: t,
        title: pick(["Sastanak sa klijentom", "Prezentacija ERP-a", "Pregovori o ugovoru", "Tehnički konsalting", "Kvartalni pregled"]),
        description: "Poslovni sastanak",
        scheduled_at: dt, duration_minutes: pick([30, 60, 90, 120]),
        location: pick(["Kancelarija BG", "Online", "Kod klijenta", "Konferencijska sala"]),
        communication_channel: pick(["in_person", "video_call", "phone"]),
        status: pick(["completed", "completed", "scheduled", "cancelled"]),
      });
    }
    await batchInsert(supabase, "meetings", meetingRows);
    log.push("✓ 30 meetings");

    // ═══════════════════════════════════════════════════
    // 54. POS DAILY REPORTS
    // ═══════════════════════════════════════════════════
    const posReports: any[] = [];
    for (const sess of sessions) {
      const sessionTxs = transactions.filter((tx: any) => tx.session_id === sess.id);
      const totalSales = sessionTxs.reduce((s: number, tx: any) => s + tx.total, 0);
      const cashSales = sessionTxs.filter((tx: any) => tx.payment_method === "cash").reduce((s: number, tx: any) => s + tx.total, 0);
      const cardSales = totalSales - cashSales;
      posReports.push({
        id: uuid(), tenant_id: t,
        session_id: sess.id, location_id: sess.location_id,
        fiscal_device_id: sess.fiscal_device_id,
        report_date: sess.opened_at.slice(0, 10),
        total_sales: Math.round(totalSales * 100) / 100,
        net_sales: Math.round(totalSales * 100) / 100,
        cash_total: Math.round(cashSales * 100) / 100,
        card_total: Math.round(cardSales * 100) / 100,
        other_total: 0, total_refunds: 0,
        transaction_count: sessionTxs.length, refund_count: 0,
      });
    }
    await batchInsert(supabase, "pos_daily_reports", posReports);
    log.push(`✓ ${posReports.length} POS daily reports`);

    // ═══════════════════════════════════════════════════
    // DONE
    // ═══════════════════════════════════════════════════
    return new Response(
      JSON.stringify({ success: true, log }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("seed-demo-data error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
