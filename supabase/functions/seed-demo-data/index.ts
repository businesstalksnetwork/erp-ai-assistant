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
// Chart of accounts IDs
const ACC_CASH = "c99cd8a6-5bc1-4e87-b4a3-32696d96f000";
const ACC_AR = "ed5dc8cc-2d7a-4f15-8232-70e9900e59bf";
const ACC_AP = "29c0edec-81b4-4c70-bd54-6c8cffabc8f2";
const ACC_REVENUE = "b2ad54e3-9f5c-4c29-9658-710a3ceca24c";
const ACC_COGS = "f6bbf951-e8cb-4415-bdaf-98d942a3aa39";
const ACC_VAT = "d0fb101a-7342-40d6-b863-c139f3e328a1";
const ACC_EXPENSES = "09cb5b01-88d9-46f0-a5bd-f260d4b94dd3";

// ── Helpers ──
function uuid() {
  return crypto.randomUUID();
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randAmount(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}
function dateIn2025(month?: number) {
  const m = month ?? randInt(0, 11);
  const d = randInt(1, 28);
  const h = randInt(8, 17);
  return new Date(2025, m, d, h, randInt(0, 59)).toISOString();
}
function dateStr(d: string) {
  return d.slice(0, 10);
}

async function batchInsert(supabase: any, table: string, rows: any[], batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`Error inserting ${table} batch ${i}:`, error.message);
      throw error;
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
  // IT oprema (30)
  "Laptop Dell Latitude 5540","Laptop Lenovo ThinkPad T14","Desktop HP ProDesk 400","Monitor Dell 27\" U2723QE","Monitor Samsung 24\" S24C","Tastatura Logitech MX Keys","Miš Logitech MX Master 3","Slušalice Jabra Evolve2 75","Web kamera Logitech Brio","Docking Station Dell WD19",
  "Server Dell PowerEdge R750","UPS APC Smart-UPS 1500VA","Switch Cisco Catalyst 2960","Router MikroTik RB4011","Firewall FortiGate 60F","NAS Synology DS920+","SSD Samsung 980 Pro 1TB","RAM Kingston 16GB DDR5","USB Hub Anker 7-port","Kabel UTP Cat6 305m",
  "Printer HP LaserJet Pro M404","Skener Epson DS-530","Projektor Epson EB-W49","Tablet Samsung Galaxy Tab S9","Telefon Samsung Galaxy S24","External SSD 2TB Portable","Adapter USB-C Multiport","Toner HP 59A","Papir A4 500 listova","Fascikla plastična A4",
  // Softver (20)
  "Microsoft 365 Business Premium","Windows 11 Pro licenca","Adobe Creative Cloud","Autodesk AutoCAD licenca","VMware vSphere Standard","Kaspersky Endpoint Security","Veeam Backup & Replication","Slack Business+ licenca","Zoom Workplace Pro","Atlassian Jira licenca",
  "GitHub Enterprise licenca","Docker Business licenca","Cloudflare Pro plan","AWS Reserved Instance","Azure VM B2s mesečno","Google Workspace Enterprise","SAP Business One licenca","Salesforce CRM licenca","HubSpot Marketing Hub","Notion Team licenca",
  // IT usluge (25)
  "Sistemska administracija mesečno","Helpdesk podrška Tier 1","Helpdesk podrška Tier 2","Mrežna infrastruktura setup","Cloud migracija","Penetration testing","IT konsalting sat","DevOps implementacija","CI/CD pipeline setup","Kubernetes deployment",
  "Web development sat","Mobile app development sat","UI/UX dizajn sat","QA testiranje sat","Data analytics konzultacije","Cybersecurity audit","Backup & DR planning","Network monitoring mesečno","SLA Premium podrška","Training IT security",
  "Instalacija radne stanice","Konfiguracija servera","Održavanje mreže mesečno","VPN setup","Email migracija",
  // Kancelarijski materijal (15)
  "Stolica ergonomska","Sto kancelarijski 160x80","Monitor arm dual","Podloga za miša gel","Whiteboard 120x90","Marker set za whiteboard","Post-it blok 76x76","Olovka hemijska plava","Spajalice kutija 1000","Selotejp providni",
  "Koverta C4 bela","Registrator A4 široki","Kalkulator Casio","Etikete samolepljive A4","Kesa za uništavač papira",
  // Mrežna oprema (10)
  "Access Point UniFi U6+","PoE Injektor 48V","Patch Panel 24-port","Rack kabinet 42U","Organizator kablova","Optički kabel SM 50m","SFP+ modul 10G","Media konvertor","Krimper RJ45","Tester mrežnih kablova"
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is super_admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: isSA } = await supabase.rpc("is_super_admin", { _user_id: caller.id });
    if (!isSA) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const log: string[] = [];
    const t = TENANT_ID;
    const le = LEGAL_ENTITY_ID;

    // ═══════════════════════════════════════════════════
    // 1. UPDATE LEGAL ENTITY
    // ═══════════════════════════════════════════════════
    await supabase.from("legal_entities").update({
      pib: "112345678",
      maticni_broj: "21876543",
      address: "Bulevar Mihajla Pupina 10a",
      city: "Beograd",
      country: "RS",
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
    // 4. FISCAL PERIODS (12 months 2025)
    // ═══════════════════════════════════════════════════
    const fpIds: string[] = [];
    const fiscalPeriods = [];
    for (let m = 0; m < 12; m++) {
      const id = uuid();
      fpIds.push(id);
      const start = new Date(2025, m, 1);
      const end = new Date(2025, m + 1, 0);
      fiscalPeriods.push({
        id, tenant_id: t,
        name: `${String(m + 1).padStart(2, "0")}/2025`,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        status: "open",
      });
    }
    await batchInsert(supabase, "fiscal_periods", fiscalPeriods);
    log.push("✓ 12 fiscal periods");

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
        type: pick(["lead", "customer", "partner"]),
      });
    }
    await batchInsert(supabase, "contacts", contacts);
    log.push("✓ 80 contacts");

    // Contact ↔ Company assignments
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
        name: productNames[i],
        name_sr: productNames[i],
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

    // WMS Zones
    const zoneIds: string[] = [];
    const zones: any[] = [];
    const zoneNames = ["Prijem", "Skladištenje", "Otprema", "Komisija"];
    for (const wh of whIds) {
      for (const zn of zoneNames) {
        const id = uuid();
        zoneIds.push(id);
        zones.push({ id, tenant_id: t, warehouse_id: wh, name: zn, code: `${zn.slice(0, 3).toUpperCase()}-${wh.slice(0, 4)}`, zone_type: "general", is_active: true });
      }
    }
    await batchInsert(supabase, "wms_zones", zones);
    log.push("✓ 12 WMS zones");

    // WMS Bins
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
          bin_type: "shelf",
          level: b, sort_order: b, is_active: true,
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
      // Main warehouse gets all products
      stockRows.push({
        id: uuid(), tenant_id: t, product_id: prodIds[p], warehouse_id: whIds[0],
        quantity_on_hand: randInt(5, 500), quantity_reserved: randInt(0, 20), min_stock_level: randInt(5, 30),
      });
      // Some products in other warehouses
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
    // 12. INVOICES (10,000) + INVOICE LINES
    // ═══════════════════════════════════════════════════
    const invoices: any[] = [];
    const invoiceLines: any[] = [];
    const invoiceIds: string[] = [];

    for (let i = 0; i < 10000; i++) {
      const invId = uuid();
      invoiceIds.push(invId);
      const month = Math.floor(i / 834); // ~834 per month
      const invDate = dateIn2025(Math.min(month, 11));
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
          product_id: prodIds[pi],
          description: productNames[pi],
          quantity: qty, unit_price: price,
          line_total: lineTotal,
          tax_rate_id: pi < 75 ? TAX_20 : pi < 90 ? TAX_10 : TAX_0,
          tax_rate_value: taxRate,
          tax_amount: lineTax,
          total_with_tax: Math.round((lineTotal + lineTax) * 100) / 100,
          sort_order: li + 1,
        });
      }

      const statusRoll = Math.random();
      const status = statusRoll < 0.7 ? "paid" : statusRoll < 0.9 ? "sent" : "draft";
      const partnerId = pick(clientIds);
      const partnerData = partners.find(p => p.id === partnerId)!;

      invoices.push({
        id: invId, tenant_id: t,
        invoice_number: `FACT-2025-${String(i + 1).padStart(5, "0")}`,
        invoice_date: dateStr(invDate),
        due_date: dateStr(new Date(new Date(invDate).getTime() + 30 * 86400000).toISOString()),
        partner_id: partnerId,
        partner_name: partnerData.name,
        partner_pib: partnerData.pib,
        status,
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: Math.round((subtotal + taxAmount) * 100) / 100,
        currency: "RSD",
        legal_entity_id: le,
        invoice_type: "regular",
        sale_type: "domestic",
        sef_status: status === "paid" ? "accepted" : "not_sent",
        created_at: invDate,
      });
    }
    await batchInsert(supabase, "invoices", invoices);
    log.push("✓ 10,000 invoices");
    await batchInsert(supabase, "invoice_lines", invoiceLines);
    log.push(`✓ ${invoiceLines.length} invoice lines`);

    // ═══════════════════════════════════════════════════
    // 13. FISCAL RECEIPTS (5,000)
    // ═══════════════════════════════════════════════════
    const receipts: any[] = [];
    for (let i = 0; i < 5000; i++) {
      const month = Math.floor(i / 417);
      const dt = dateIn2025(Math.min(month, 11));
      const total = randAmount(500, 50000);
      const taxRate = 20;
      const baseAmount = Math.round(total / 1.2 * 100) / 100;
      const taxAmt = Math.round((total - baseAmount) * 100) / 100;
      receipts.push({
        id: uuid(), tenant_id: t,
        fiscal_device_id: pick(fdIds),
        receipt_number: `FR-2025-${String(i + 1).padStart(6, "0")}`,
        total_amount: total,
        payment_method: pick(["cash", "card", "card", "cash"]),
        receipt_type: "normal",
        transaction_type: "sale",
        verification_status: pick(["verified", "verified", "verified", "pending"]),
        tax_items: [{ label: "Ђ", rate: taxRate, base: baseAmount, tax: taxAmt }],
        invoice_id: i < 3000 ? invoiceIds[i] : null,
        signed_at: dt,
        created_at: dt,
      });
    }
    await batchInsert(supabase, "fiscal_receipts", receipts);
    log.push("✓ 5,000 fiscal receipts");

    // ═══════════════════════════════════════════════════
    // 14. SUPPLIER INVOICES (2,000)
    // ═══════════════════════════════════════════════════
    const suppInvoices: any[] = [];
    for (let i = 0; i < 2000; i++) {
      const month = Math.floor(i / 167);
      const dt = dateIn2025(Math.min(month, 11));
      const amount = randAmount(5000, 200000);
      const tax = Math.round(amount * 0.2 * 100) / 100;
      const suppId = pick(supplierIds);
      const suppData = partners.find(p => p.id === suppId)!;
      suppInvoices.push({
        id: uuid(), tenant_id: t,
        invoice_number: `UF-2025-${String(i + 1).padStart(5, "0")}`,
        invoice_date: dateStr(dt),
        due_date: dateStr(new Date(new Date(dt).getTime() + 45 * 86400000).toISOString()),
        supplier_id: suppId,
        supplier_name: suppData.name,
        status: pick(["paid", "paid", "paid", "received", "approved"]),
        amount, tax_amount: tax, total: Math.round((amount + tax) * 100) / 100,
        currency: "RSD",
        legal_entity_id: le,
        created_at: dt,
      });
    }
    await batchInsert(supabase, "supplier_invoices", suppInvoices);
    log.push("✓ 2,000 supplier invoices");

    // ═══════════════════════════════════════════════════
    // 15. PURCHASE ORDERS (500)
    // ═══════════════════════════════════════════════════
    const poIds: string[] = [];
    const purchaseOrders: any[] = [];
    for (let i = 0; i < 500; i++) {
      const id = uuid();
      poIds.push(id);
      const month = Math.floor(i / 42);
      const dt = dateIn2025(Math.min(month, 11));
      const suppId = pick(supplierIds);
      const suppData = partners.find(p => p.id === suppId)!;
      const subtotal = randAmount(10000, 300000);
      const tax = Math.round(subtotal * 0.2 * 100) / 100;
      purchaseOrders.push({
        id, tenant_id: t,
        order_number: `PO-2025-${String(i + 1).padStart(4, "0")}`,
        order_date: dateStr(dt),
        expected_date: dateStr(new Date(new Date(dt).getTime() + randInt(7, 30) * 86400000).toISOString()),
        supplier_id: suppId, supplier_name: suppData.name,
        status: pick(["received", "received", "received", "approved", "draft"]),
        currency: "RSD", subtotal, tax_amount: tax, total: Math.round((subtotal + tax) * 100) / 100,
        created_at: dt,
      });
    }
    await batchInsert(supabase, "purchase_orders", purchaseOrders);
    log.push("✓ 500 purchase orders");

    // ═══════════════════════════════════════════════════
    // 16. SALES ORDERS (1,000) + LINES
    // ═══════════════════════════════════════════════════
    const salesOrders: any[] = [];
    const soLines: any[] = [];
    for (let i = 0; i < 1000; i++) {
      const soId = uuid();
      const month = Math.floor(i / 84);
      const dt = dateIn2025(Math.min(month, 11));
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
        order_number: `SO-2025-${String(i + 1).padStart(5, "0")}`,
        order_date: dateStr(dt),
        partner_id: partnerId, partner_name: partnerData.name,
        status: pick(["confirmed", "confirmed", "confirmed", "shipped", "draft"]),
        currency: "RSD",
        subtotal: Math.round(subtotal * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: Math.round((subtotal + taxAmount) * 100) / 100,
        created_at: dt,
      });
    }
    await batchInsert(supabase, "sales_orders", salesOrders);
    await batchInsert(supabase, "sales_order_lines", soLines);
    log.push(`✓ 1,000 sales orders + ${soLines.length} lines`);

    // ═══════════════════════════════════════════════════
    // 17. QUOTES (300) + LINES
    // ═══════════════════════════════════════════════════
    const quotes: any[] = [];
    const quoteLines: any[] = [];
    for (let i = 0; i < 300; i++) {
      const qId = uuid();
      const month = Math.floor(i / 25);
      const dt = dateIn2025(Math.min(month, 11));
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
        quote_number: `Q-2025-${String(i + 1).padStart(4, "0")}`,
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
    for (let i = 0; i < 200; i++) {
      const month = Math.floor(i / 17);
      const dtStart = dateIn2025(Math.min(month, 11));
      const dtEnd = new Date(new Date(dtStart).getTime() + randInt(3, 14) * 86400000).toISOString();
      const qty = randInt(10, 500);
      const status = pick(["completed", "completed", "completed", "in_progress", "planned"]);
      prodOrders.push({
        id: uuid(), tenant_id: t,
        order_number: `PROD-2025-${String(i + 1).padStart(4, "0")}`,
        product_id: prodIds[randInt(0, 29)], // IT hardware products
        quantity: qty,
        completed_quantity: status === "completed" ? qty : status === "in_progress" ? randInt(0, qty) : 0,
        status,
        planned_start: dateStr(dtStart),
        planned_end: dateStr(dtEnd),
        actual_start: status !== "planned" ? dateStr(dtStart) : null,
        actual_end: status === "completed" ? dateStr(dtEnd) : null,
        created_at: dtStart,
      });
    }
    await batchInsert(supabase, "production_orders", prodOrders);
    log.push("✓ 200 production orders");

    // ═══════════════════════════════════════════════════
    // 19. POS SESSIONS (365) + TRANSACTIONS
    // ═══════════════════════════════════════════════════
    const sessions: any[] = [];
    const transactions: any[] = [];
    for (let day = 0; day < 365; day++) {
      const sessionDate = new Date(2025, 0, day + 1, 8, 0);
      const closeDate = new Date(2025, 0, day + 1, 20, 0);
      // Skip weekends
      if (sessionDate.getDay() === 0 || sessionDate.getDay() === 6) continue;

      const sessionId = uuid();
      const locIdx = day % 3;
      const dailyTotal = randAmount(10000, 80000);
      sessions.push({
        id: sessionId, tenant_id: t,
        location_id: locIds[locIdx],
        fiscal_device_id: fdIds[locIdx],
        warehouse_id: whIds[locIdx],
        opened_at: sessionDate.toISOString(),
        closed_at: closeDate.toISOString(),
        opening_balance: 5000,
        closing_balance: 5000 + dailyTotal,
        status: "closed",
      });

      // 3-8 transactions per session
      const numTx = randInt(3, 8);
      for (let tx = 0; tx < numTx; tx++) {
        const txTime = new Date(sessionDate.getTime() + randInt(0, 11 * 3600000)).toISOString();
        const txTotal = randAmount(500, 15000);
        const txTax = Math.round(txTotal / 6 * 100) / 100;
        const pi = randInt(0, 99);
        transactions.push({
          id: uuid(), tenant_id: t,
          session_id: sessionId,
          transaction_number: `TX-${day + 1}-${tx + 1}`,
          total: txTotal,
          subtotal: Math.round((txTotal - txTax) * 100) / 100,
          tax_amount: txTax,
          payment_method: pick(["cash", "card", "card", "cash"]),
          status: "completed",
          receipt_type: "normal",
          is_fiscal: true,
          items: [{ product_id: prodIds[pi], name: productNames[pi], quantity: randInt(1, 5), price: txTotal, total: txTotal }],
          location_id: locIds[locIdx],
          fiscal_device_id: fdIds[locIdx],
          warehouse_id: whIds[locIdx],
          created_at: txTime,
        });
      }
    }
    await batchInsert(supabase, "pos_sessions", sessions);
    await batchInsert(supabase, "pos_transactions", transactions);
    log.push(`✓ ${sessions.length} POS sessions + ${transactions.length} transactions`);

    // ═══════════════════════════════════════════════════
    // 20. GOODS RECEIPTS (500)
    // ═══════════════════════════════════════════════════
    const goodsReceipts: any[] = [];
    const grLines: any[] = [];
    for (let i = 0; i < 500; i++) {
      const grId = uuid();
      const month = Math.floor(i / 42);
      const dt = dateIn2025(Math.min(month, 11));
      goodsReceipts.push({
        id: grId, tenant_id: t,
        receipt_number: `GR-2025-${String(i + 1).padStart(4, "0")}`,
        received_at: dt,
        warehouse_id: pick(whIds),
        purchase_order_id: i < 500 ? poIds[i % poIds.length] : null,
        status: "confirmed",
        created_at: dt,
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
    log.push(`✓ 500 goods receipts + ${grLines.length} lines`);

    // ═══════════════════════════════════════════════════
    // 21. INVENTORY MOVEMENTS (15,000)
    // ═══════════════════════════════════════════════════
    const movements: any[] = [];
    for (let i = 0; i < 15000; i++) {
      const month = Math.floor(i / 1250);
      const dt = dateIn2025(Math.min(month, 11));
      const type = pick(["in", "in", "out", "out", "out", "adjustment"]);
      movements.push({
        id: uuid(), tenant_id: t,
        product_id: prodIds[randInt(0, 99)],
        warehouse_id: pick(whIds),
        movement_type: type,
        quantity: randInt(1, 50),
        unit_cost: randAmount(500, 30000),
        reference: type === "in" ? `GR-2025-${String(randInt(1, 500)).padStart(4, "0")}` : `SO-2025-${String(randInt(1, 1000)).padStart(5, "0")}`,
        notes: null,
        created_at: dt,
      });
    }
    await batchInsert(supabase, "inventory_movements", movements);
    log.push("✓ 15,000 inventory movements");

    // ═══════════════════════════════════════════════════
    // 22. CRM LEADS (200)
    // ═══════════════════════════════════════════════════
    const leadStatuses = ["new", "new", "contacted", "contacted", "qualified", "converted", "lost"];
    const leadSources = ["website", "referral", "linkedin", "cold_call", "conference", "email"];
    const crmLeads: any[] = [];
    for (let i = 0; i < 200; i++) {
      const month = Math.floor(i / 17);
      const dt = dateIn2025(Math.min(month, 11));
      const fn = pick(firstNames);
      const ln = pick(lastNames);
      crmLeads.push({
        id: uuid(), tenant_id: t,
        name: `${fn} ${ln}`,
        first_name: fn, last_name: ln,
        company: pick(companyNames),
        email: `${fn.toLowerCase()}.${ln.toLowerCase().replace(/[ćčžšđ]/g, c => ({ć:"c",č:"c",ž:"z",š:"s",đ:"d"}[c] || c))}@example.rs`,
        phone: `+381${randInt(60, 69)}${randInt(1000000, 9999999)}`,
        status: pick(leadStatuses),
        source: pick(leadSources),
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
    for (let i = 0; i < 100; i++) {
      const month = Math.floor(i / 9);
      const dt = dateIn2025(Math.min(month, 11));
      const stage = pick(oppStages);
      const value = randAmount(50000, 5000000);
      opportunities.push({
        id: uuid(), tenant_id: t,
        title: `${pick(["ERP implementacija", "Cloud migracija", "IT infrastruktura", "Mrežno rešenje", "Softverski razvoj", "Cybersecurity audit", "Server konsolidacija", "VoIP sistem"])} - ${pick(companyNames)}`,
        value, currency: "RSD",
        stage,
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
    // 24. ANNUAL LEAVE BALANCES
    // ═══════════════════════════════════════════════════
    const leaveBalances: any[] = [];
    for (const empId of empIds) {
      const entitled = pick([20, 21, 22, 25]);
      const used = randInt(0, Math.min(entitled, 15));
      leaveBalances.push({
        id: uuid(), tenant_id: t, employee_id: empId,
        year: 2025, entitled_days: entitled, used_days: used,
        carried_over_days: randInt(0, 5),
      });
    }
    await batchInsert(supabase, "annual_leave_balances", leaveBalances);
    log.push("✓ 25 annual leave balances");

    // ═══════════════════════════════════════════════════
    // 25. WORK LOGS (25 employees x ~250 working days)
    // ═══════════════════════════════════════════════════
    const workLogs: any[] = [];
    for (const empId of empIds) {
      for (let day = 0; day < 365; day++) {
        const d = new Date(2025, 0, day + 1);
        if (d.getDay() === 0 || d.getDay() === 6) continue;
        const dateS = d.toISOString().slice(0, 10);
        workLogs.push({
          id: uuid(), tenant_id: t, employee_id: empId,
          date: dateS,
          type: pick(["regular", "regular", "regular", "regular", "overtime", "sick_leave"]),
          hours: 8,
          note: null,
        });
      }
    }
    await batchInsert(supabase, "work_logs", workLogs);
    log.push(`✓ ${workLogs.length} work logs`);

    // ═══════════════════════════════════════════════════
    // 26. OPEN ITEMS (AR/AP)
    // ═══════════════════════════════════════════════════
    const openItems: any[] = [];
    // AR from some invoices
    for (let i = 0; i < 500; i++) {
      const inv = invoices[i * 20]; // every 20th invoice
      if (!inv) break;
      const paid = inv.status === "paid" ? inv.total : randAmount(0, inv.total);
      openItems.push({
        id: uuid(), tenant_id: t,
        document_type: "invoice", document_number: inv.invoice_number,
        document_id: inv.id,
        document_date: inv.invoice_date,
        due_date: inv.due_date,
        partner_id: inv.partner_id,
        direction: "receivable",
        original_amount: inv.total,
        paid_amount: Math.round(paid * 100) / 100,
        remaining_amount: Math.round((inv.total - paid) * 100) / 100,
        currency: "RSD",
        status: inv.total <= paid ? "closed" : "open",
        closed_at: inv.total <= paid ? inv.created_at : null,
      });
    }
    // AP from supplier invoices
    for (let i = 0; i < 200; i++) {
      const si = suppInvoices[i * 10];
      if (!si) break;
      const paid = si.status === "paid" ? si.total : randAmount(0, si.total);
      openItems.push({
        id: uuid(), tenant_id: t,
        document_type: "supplier_invoice", document_number: si.invoice_number,
        document_id: si.id,
        document_date: si.invoice_date,
        due_date: si.due_date,
        partner_id: si.supplier_id,
        direction: "payable",
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
    // 27. JOURNAL ENTRIES (sample: 100 for key invoices)
    // ═══════════════════════════════════════════════════
    const journalEntries: any[] = [];
    const journalLines: any[] = [];
    for (let i = 0; i < 100; i++) {
      const inv = invoices[i * 100];
      if (!inv) break;
      const jeId = uuid();
      const month = new Date(inv.invoice_date).getMonth();
      journalEntries.push({
        id: jeId, tenant_id: t,
        entry_number: `JE-2025-${String(i + 1).padStart(5, "0")}`,
        entry_date: inv.invoice_date,
        description: `Faktura ${inv.invoice_number}`,
        reference: inv.invoice_number,
        status: "posted",
        fiscal_period_id: fpIds[Math.min(month, 11)],
        posted_at: inv.created_at,
        legal_entity_id: le,
        source: "manual",
      });
      // Debit AR, Credit Revenue + VAT
      journalLines.push(
        { id: uuid(), journal_entry_id: jeId, account_id: ACC_AR, debit: inv.total, credit: 0, description: "Kupac", sort_order: 1 },
        { id: uuid(), journal_entry_id: jeId, account_id: ACC_REVENUE, debit: 0, credit: inv.subtotal, description: "Prihod", sort_order: 2 },
        { id: uuid(), journal_entry_id: jeId, account_id: ACC_VAT, debit: 0, credit: inv.tax_amount, description: "PDV obaveza", sort_order: 3 },
      );
    }
    await batchInsert(supabase, "journal_entries", journalEntries);
    await batchInsert(supabase, "journal_lines", journalLines);
    log.push(`✓ ${journalEntries.length} journal entries + ${journalLines.length} lines`);

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
