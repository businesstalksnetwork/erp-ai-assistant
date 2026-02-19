import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore — JSZip via esm.sh works at runtime in Deno
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ──────────────────────────────────────────────────────────────────────────────
// Layer 1 — Exact dbo.TableName lookup (Uniprom MS SQL Server export)
// All files follow dbo.EXACT_TABLE_NAME.csv — we match on table name directly.
// ──────────────────────────────────────────────────────────────────────────────
const DBO_TABLE_LOOKUP: Record<string, {
  target: string;
  confidence: "exact" | "high" | "medium";
  label: string;
  skipReason?: string;
  requiresParent?: string;
  dedupField?: string;
}> = {
  // ── EXACT KNOWN FILES (read from actual CSV data) ──────────────────────────
  "A_UnosPodataka":         { target: "products",           confidence: "exact", label: "Exact: Uniprom products table (confirmed col layout)", dedupField: "sku" },
  "A_UnosPodataka_Partner": { target: "partners",           confidence: "exact", label: "Exact: Uniprom partners table (confirmed col layout)", dedupField: "pib" },
  "A_aPodaci":              { target: "contacts",           confidence: "exact", label: "Exact: Uniprom contacts table (confirmed col layout)", dedupField: "email" },

  // ── MASTER DATA — products / articles ──────────────────────────────────────
  "A_Artikal":              { target: "products",           confidence: "high",  label: "Artikal = article/product", dedupField: "sku" },
  "A_Roba":                 { target: "products",           confidence: "high",  label: "Roba = goods/products", dedupField: "sku" },
  "A_Proizvod":             { target: "products",           confidence: "high",  label: "Proizvod = product", dedupField: "sku" },
  "A_Katalog":              { target: "products",           confidence: "high",  label: "Katalog = product catalog", dedupField: "sku" },
  "A_CenovnikArtikla":      { target: "products",           confidence: "high",  label: "Cenovnik artikla = product price list", dedupField: "sku" },
  "A_Kalkulacija":          { target: "products",           confidence: "high",  label: "Kalkulacija = pricing calculation (updates product cost)", dedupField: "sku" },
  "A_KalkulacijaStavka":    { target: "products",           confidence: "medium",label: "Kalkulacija stavka = pricing line items", requiresParent: "products", dedupField: "sku" },

  // ── MASTER DATA — partners ──────────────────────────────────────────────────
  "A_Kupac":                { target: "partners",           confidence: "high",  label: "Kupac = customer partner", dedupField: "pib" },
  "A_Dobavljac":            { target: "partners",           confidence: "high",  label: "Dobavljac = supplier partner", dedupField: "pib" },
  "A_PoslovniPartner":      { target: "partners",           confidence: "high",  label: "Poslovni partner = business partner", dedupField: "pib" },
  "A_Partner":              { target: "partners",           confidence: "high",  label: "Partner = partner", dedupField: "pib" },

  // ── MASTER DATA — contacts ──────────────────────────────────────────────────
  "A_Kontakt":              { target: "contacts",           confidence: "high",  label: "Kontakt = contact person", dedupField: "email" },
  "A_KontaktOsoba":         { target: "contacts",           confidence: "high",  label: "Kontakt osoba = contact person", dedupField: "email" },

  // ── MASTER DATA — warehouses / locations ───────────────────────────────────
  "A_Magacin":              { target: "warehouses",         confidence: "high",  label: "Magacin = warehouse", dedupField: "name" },
  "A_Skladiste":            { target: "warehouses",         confidence: "high",  label: "Skladiste = storage/warehouse", dedupField: "name" },
  "A_Lokacija":             { target: "locations",          confidence: "high",  label: "Lokacija = location", dedupField: "name" },

  // ── MASTER DATA — currencies / tax ─────────────────────────────────────────
  "A_Valuta":               { target: "currencies",         confidence: "high",  label: "Valuta = currency", dedupField: "code" },
  "A_Porez":                { target: "tax_rates",          confidence: "high",  label: "Porez = tax/VAT rates", dedupField: "name" },
  "A_PDV":                  { target: "tax_rates",          confidence: "high",  label: "PDV = VAT rates", dedupField: "name" },
  "A_PoreznaStopaOsnove":   { target: "tax_rates",          confidence: "high",  label: "Poreska stopa osnove = tax rate bases", dedupField: "name" },
  "A_StopaPDV":             { target: "tax_rates",          confidence: "high",  label: "Stopa PDV = VAT rate", dedupField: "name" },

  // ── MASTER DATA — chart of accounts ────────────────────────────────────────
  "A_KontniPlan":           { target: "chart_of_accounts",  confidence: "high",  label: "Kontni plan = chart of accounts", dedupField: "code" },
  "A_KontoPlan":            { target: "chart_of_accounts",  confidence: "high",  label: "Konto plan = chart of accounts (alt)", dedupField: "code" },
  "A_Konto":                { target: "chart_of_accounts",  confidence: "high",  label: "Konto = GL account", dedupField: "code" },

  // ── MASTER DATA — org structure ────────────────────────────────────────────
  "A_Odeljenje":            { target: "departments",        confidence: "high",  label: "Odeljenje = department", dedupField: "name" },
  "A_Sektor":               { target: "departments",        confidence: "high",  label: "Sektor = sector/department", dedupField: "name" },
  "A_CentarTroska":         { target: "cost_centers",       confidence: "high",  label: "Centar troska = cost center", dedupField: "code" },
  "A_MestoTroska":          { target: "cost_centers",       confidence: "high",  label: "Mesto troska = cost center", dedupField: "code" },

  // ── TRANSACTIONAL — invoices (outgoing) ────────────────────────────────────
  "A_Faktura":              { target: "invoices",           confidence: "high",  label: "Faktura = outgoing sales invoice", dedupField: "invoice_number" },
  "A_FakturaStavka":        { target: "invoices",           confidence: "high",  label: "Faktura stavka = invoice line items", requiresParent: "invoices", dedupField: "invoice_number" },
  "A_FakturaLinija":        { target: "invoices",           confidence: "high",  label: "Faktura linija = invoice lines", requiresParent: "invoices", dedupField: "invoice_number" },
  "A_Racun":                { target: "invoices",           confidence: "high",  label: "Racun = sales receipt/invoice", dedupField: "invoice_number" },
  "A_RacunStavka":          { target: "invoices",           confidence: "high",  label: "Racun stavka = receipt line items", requiresParent: "invoices", dedupField: "invoice_number" },
  "A_Otpremnica":           { target: "invoices",           confidence: "high",  label: "Otpremnica = delivery note (maps to invoice)", dedupField: "invoice_number" },
  "A_OtpremnicaStavka":     { target: "invoices",           confidence: "medium",label: "Otpremnica stavka = delivery line items", requiresParent: "invoices", dedupField: "invoice_number" },
  "A_IzlazniFaktura":       { target: "invoices",           confidence: "high",  label: "Izlazni faktura = outgoing invoice", dedupField: "invoice_number" },

  // ── TRANSACTIONAL — supplier invoices (incoming) ────────────────────────────
  "A_UlaznaFaktura":        { target: "supplier_invoices",  confidence: "high",  label: "Ulazna faktura = supplier/incoming invoice", dedupField: "invoice_number" },
  "A_UlaznaFakturaStavka":  { target: "supplier_invoices",  confidence: "high",  label: "Ulazna faktura stavka = supplier invoice lines", requiresParent: "supplier_invoices", dedupField: "invoice_number" },
  "A_UlazniRacun":          { target: "supplier_invoices",  confidence: "high",  label: "Ulazni racun = supplier receipt/invoice", dedupField: "invoice_number" },
  "A_UlazniRacunStavka":    { target: "supplier_invoices",  confidence: "high",  label: "Ulazni racun stavka = supplier receipt lines", requiresParent: "supplier_invoices", dedupField: "invoice_number" },

  // ── TRANSACTIONAL — purchase orders ────────────────────────────────────────
  "A_Narudzbenica":         { target: "purchase_orders",    confidence: "high",  label: "Narudzbenica = purchase order", dedupField: "order_number" },
  "A_NarudzbenicaStavka":   { target: "purchase_orders",    confidence: "high",  label: "Narudzbenica stavka = PO line items", requiresParent: "purchase_orders", dedupField: "order_number" },
  "A_NarudzbenicaDobavljac":{ target: "purchase_orders",    confidence: "high",  label: "Narudzbenica dobavljac = supplier PO", dedupField: "order_number" },
  "A_InternaNarudzbenica":  { target: "purchase_orders",    confidence: "medium",label: "Interna narudzbenica = internal order", dedupField: "order_number" },

  // ── TRANSACTIONAL — sales orders ───────────────────────────────────────────
  "A_ProdajniNalog":        { target: "sales_orders",       confidence: "high",  label: "Prodajni nalog = sales order", dedupField: "order_number" },
  "A_ProdajniNalogStavka":  { target: "sales_orders",       confidence: "high",  label: "Prodajni nalog stavka = SO line items", requiresParent: "sales_orders", dedupField: "order_number" },
  "A_Ponuda":               { target: "sales_orders",       confidence: "medium",label: "Ponuda = offer/quote (maps to sales order)", dedupField: "order_number" },

  // ── TRANSACTIONAL — goods receipts ─────────────────────────────────────────
  "A_Primka":               { target: "goods_receipts",     confidence: "high",  label: "Primka = goods receipt", dedupField: "receipt_number" },
  "A_PrimkaStavka":         { target: "goods_receipts",     confidence: "high",  label: "Primka stavka = goods receipt lines", requiresParent: "goods_receipts", dedupField: "receipt_number" },
  "A_PrijemRobe":           { target: "goods_receipts",     confidence: "high",  label: "Prijem robe = goods receipt", dedupField: "receipt_number" },

  // ── TRANSACTIONAL — inventory ──────────────────────────────────────────────
  "A_Lager":                { target: "inventory_stock",    confidence: "high",  label: "Lager = current stock levels per product/warehouse", dedupField: "id" },
  "A_LagerStanje":          { target: "inventory_stock",    confidence: "high",  label: "Lager stanje = stock balance", dedupField: "id" },
  "A_LagerPromet":          { target: "inventory_movements",confidence: "high",  label: "Lager promet = stock movements/transactions", dedupField: "id" },
  "A_InventurniList":       { target: "inventory_stock",    confidence: "medium",label: "Inventurni list = inventory count sheet", dedupField: "id" },
  "A_MedjumagacinskiPromet":{ target: "inventory_movements",confidence: "medium",label: "Medjumagacinski promet = inter-warehouse transfers", dedupField: "id" },

  // ── TRANSACTIONAL — retail prices ──────────────────────────────────────────
  "A_Nivelacija":           { target: "retail_prices",      confidence: "high",  label: "Nivelacija = retail price level adjustment", dedupField: "id" },
  "A_NivelacijaStavka":     { target: "retail_prices",      confidence: "high",  label: "Nivelacija stavka = price adjustment lines", requiresParent: "retail_prices", dedupField: "id" },
  "A_CenovnikMaloprodajni": { target: "retail_prices",      confidence: "high",  label: "Cenovnik maloprodajni = retail price list", dedupField: "id" },
  "A_MaloprodajniCenovnik": { target: "retail_prices",      confidence: "high",  label: "Maloprodajni cenovnik = retail price list", dedupField: "id" },

  // ── TRANSACTIONAL — bank ───────────────────────────────────────────────────
  "A_BankovniIzvod":        { target: "bank_statements",    confidence: "high",  label: "Bankovni izvod = bank statement", dedupField: "statement_number" },
  "A_BankovniIzvodStavka":  { target: "bank_statements",    confidence: "high",  label: "Bankovni izvod stavka = bank statement lines", requiresParent: "bank_statements", dedupField: "statement_number" },
  "A_Izvod":                { target: "bank_statements",    confidence: "high",  label: "Izvod = bank extract/statement", dedupField: "statement_number" },

  // ── HR — employees ─────────────────────────────────────────────────────────
  "A_Zaposleni":            { target: "employees",          confidence: "high",  label: "Zaposleni = employees", dedupField: "email" },
  "A_Radnik":               { target: "employees",          confidence: "high",  label: "Radnik = worker/employee", dedupField: "email" },
  "A_Osoblje":              { target: "employees",          confidence: "high",  label: "Osoblje = personnel/staff", dedupField: "email" },

  // ── HR — contracts / payroll / leave ───────────────────────────────────────
  "A_Ugovor":               { target: "employee_contracts", confidence: "high",  label: "Ugovor = employee contract", requiresParent: "employees", dedupField: "id" },
  "A_UgovorORadu":          { target: "employee_contracts", confidence: "high",  label: "Ugovor o radu = employment contract", requiresParent: "employees", dedupField: "id" },
  "A_ObracunPlata":         { target: "payroll_runs",       confidence: "high",  label: "Obracun plata = payroll run", dedupField: "id" },
  "A_ObracunPlataStavka":   { target: "payroll_runs",       confidence: "high",  label: "Obracun plata stavka = payroll items", requiresParent: "payroll_runs", dedupField: "id" },
  "A_Odsustvo":             { target: "leave_requests",     confidence: "high",  label: "Odsustvo = leave/absence request", requiresParent: "employees", dedupField: "id" },
  "A_Bolovanje":            { target: "leave_requests",     confidence: "high",  label: "Bolovanje = sick leave", requiresParent: "employees", dedupField: "id" },
  "A_GodisnjOdmor":         { target: "leave_requests",     confidence: "high",  label: "Godisnji odmor = annual leave", requiresParent: "employees", dedupField: "id" },
  "A_Prekovremeni":         { target: "overtime_hours",     confidence: "high",  label: "Prekovremeni = overtime hours", requiresParent: "employees", dedupField: "id" },
  "A_NocniRad":             { target: "night_work_records", confidence: "high",  label: "Nocni rad = night work records", requiresParent: "employees", dedupField: "id" },

  // ── AUTO-SKIP — lookup/config tables ───────────────────────────────────────
  "A_TipDokumenta":    { target: "skip", confidence: "exact", label: "Document type lookup — auto-skip",    skipReason: "Lookup table (document types)" },
  "A_StatusDokumenta": { target: "skip", confidence: "exact", label: "Document status lookup — auto-skip",  skipReason: "Lookup table (document status)" },
  "A_TipPartnera":     { target: "skip", confidence: "exact", label: "Partner type lookup — auto-skip",     skipReason: "Lookup table (partner types)" },
  "A_Drzava":          { target: "skip", confidence: "exact", label: "Country lookup — auto-skip",          skipReason: "Lookup table (countries)" },
  "A_Grad":            { target: "skip", confidence: "exact", label: "City lookup — auto-skip",             skipReason: "Lookup table (cities)" },
  "A_JedinicaMere":    { target: "skip", confidence: "exact", label: "Unit of measure lookup — auto-skip",  skipReason: "Lookup table (UoM)" },
  "A_TipRobe":         { target: "skip", confidence: "exact", label: "Product type lookup — auto-skip",     skipReason: "Lookup table (product types)" },
  "A_Kategorija":      { target: "skip", confidence: "exact", label: "Category lookup — auto-skip",         skipReason: "Lookup table (categories)" },
  "A_StatusNaloga":    { target: "skip", confidence: "exact", label: "Order status lookup — auto-skip",     skipReason: "Lookup table (order status)" },
  "A_TipNaloga":       { target: "skip", confidence: "exact", label: "Order type lookup — auto-skip",       skipReason: "Lookup table (order types)" },
  "A_Banka":           { target: "skip", confidence: "exact", label: "Bank lookup — auto-skip",             skipReason: "Lookup table (banks)" },
  "A_PostanskiBroj":   { target: "skip", confidence: "exact", label: "Postal code lookup — auto-skip",      skipReason: "Lookup table (postal codes)" },
  "A_Opstina":         { target: "skip", confidence: "exact", label: "Municipality lookup — auto-skip",     skipReason: "Lookup table (municipalities)" },
  "A_Regija":          { target: "skip", confidence: "exact", label: "Region lookup — auto-skip",           skipReason: "Lookup table (regions)" },
  "A_TipKupca":        { target: "skip", confidence: "exact", label: "Customer type lookup — auto-skip",    skipReason: "Lookup table (customer types)" },
  "A_TipDobavljaca":   { target: "skip", confidence: "exact", label: "Supplier type lookup — auto-skip",    skipReason: "Lookup table (supplier types)" },
  "A_TipArtikla":      { target: "skip", confidence: "exact", label: "Article type lookup — auto-skip",     skipReason: "Lookup table (article types)" },
  "A_GrupaArtikla":    { target: "skip", confidence: "exact", label: "Article group lookup — auto-skip",    skipReason: "Lookup table (article groups)" },
  "A_GrupaPartnera":   { target: "skip", confidence: "exact", label: "Partner group lookup — auto-skip",    skipReason: "Lookup table (partner groups)" },
  "A_Zanimanje":       { target: "skip", confidence: "exact", label: "Occupation lookup — auto-skip",       skipReason: "Lookup table (occupations)" },
  "A_Strucnost":       { target: "skip", confidence: "exact", label: "Qualification lookup — auto-skip",    skipReason: "Lookup table (qualifications)" },
  "A_TipNalogaKnjiz":  { target: "skip", confidence: "exact", label: "Journal order type — auto-skip",     skipReason: "Lookup table" },
  "A_StatusPrimke":    { target: "skip", confidence: "exact", label: "Receipt status lookup — auto-skip",   skipReason: "Lookup table" },
  "A_StatusFakture":   { target: "skip", confidence: "exact", label: "Invoice status lookup — auto-skip",   skipReason: "Lookup table" },
  "A_Parametar":       { target: "skip", confidence: "exact", label: "System parameters — auto-skip",       skipReason: "System config table" },
  "A_Parametri":       { target: "skip", confidence: "exact", label: "System parameters — auto-skip",       skipReason: "System config table" },
  "A_Korisnik":        { target: "skip", confidence: "exact", label: "User accounts — auto-skip",           skipReason: "Legacy user table (not imported)" },
  "A_Uloga":           { target: "skip", confidence: "exact", label: "Role lookup — auto-skip",             skipReason: "Lookup table (roles)" },
  "A_Prava":           { target: "skip", confidence: "exact", label: "Permissions — auto-skip",             skipReason: "Legacy permissions (not imported)" },
  "A_Log":             { target: "skip", confidence: "exact", label: "System log — auto-skip",              skipReason: "Audit log (not imported)" },
  "A_Sesija":          { target: "skip", confidence: "exact", label: "Session log — auto-skip",             skipReason: "Legacy session table" },

  // ── ENGLISH-NAMED TABLES (newer Uniprom schema) ───────────────────────────
  "Item":                    { target: "products",    confidence: "high",  label: "Item = product catalog (English table name)", dedupField: "sku" },
  "Partner":                 { target: "partners",    confidence: "high",  label: "Partner = business partner (English table name)", dedupField: "pib" },
  "PartnerContact":          { target: "contacts",    confidence: "high",  label: "PartnerContact = contact persons linked to partners", dedupField: "email" },
  "PartnerLocation":         { target: "locations",   confidence: "high",  label: "PartnerLocation = partner delivery/billing addresses", dedupField: "name" },
  "Department":              { target: "departments", confidence: "high",  label: "Department = department (English table name)", dedupField: "name" },
  "CurrencyISO":             { target: "currencies",  confidence: "high",  label: "CurrencyISO = ISO 4217 currency list", dedupField: "code" },
  "Employee":                { target: "employees",   confidence: "high",  label: "Employee = employees (English table name)", dedupField: "email" },
  "Product":                 { target: "products",    confidence: "high",  label: "Product = products (English table name)", dedupField: "sku" },
  "Warehouse":               { target: "warehouses",  confidence: "high",  label: "Warehouse = warehouses (English table name)", dedupField: "name" },

  // ── AUTO-SKIP: Legacy permission/ACL tables ───────────────────────────────
  "AppObjectsRolesRights":   { target: "skip", confidence: "exact", label: "Legacy role permissions — auto-skip",     skipReason: "Legacy ACL table (not imported)" },
  "AppObjectsUserRights":    { target: "skip", confidence: "exact", label: "Legacy user permissions — auto-skip",     skipReason: "Legacy ACL table (not imported)" },

  // ── AUTO-SKIP: Geo lookup tables ──────────────────────────────────────────
  "City":                    { target: "skip", confidence: "exact", label: "Global city lookup — auto-skip",          skipReason: "Geo lookup table (102k rows, not imported)" },

  // ── AUTO-SKIP: FK junction tables ────────────────────────────────────────
  "ItemGroups":              { target: "skip", confidence: "exact", label: "Product-group junction table — auto-skip", skipReason: "FK junction table only" },
  "ProjectPartner":          { target: "skip", confidence: "exact", label: "Project-partner FK junction — auto-skip",  skipReason: "FK junction table only" },
  "PartnerContactParticipants":              { target: "skip", confidence: "exact", label: "Contact participants junction — auto-skip",      skipReason: "FK junction table, corrupt binary data" },
  "PartnerContactInteraction":               { target: "skip", confidence: "exact", label: "HTML email interaction log — auto-skip",         skipReason: "Contains raw HTML content, not importable" },
  "PartnerContactInteractionParticipants":   { target: "skip", confidence: "exact", label: "Interaction participants — auto-skip",            skipReason: "FK junction with corrupt binary data" },
  "PartnerInteractionTemplates":             { target: "skip", confidence: "exact", label: "HTML email templates — auto-skip",               skipReason: "Contains raw HTML content, not importable" },

  // ── AUTO-SKIP: Production order config (no system table) ──────────────────
  "ProductionOrderProperty":     { target: "skip", confidence: "exact", label: "Production order properties — auto-skip",     skipReason: "Production config, no import target" },
  "ProductionOrderPropertyMeta": { target: "skip", confidence: "exact", label: "Production order property metadata — auto-skip", skipReason: "Production config metadata" },

  // ── AUTO-SKIP: Small lookup/enum tables ──────────────────────────────────
  "PurchaseOrderStatus":             { target: "skip", confidence: "exact", label: "PO status lookup — auto-skip",              skipReason: "Lookup table (10 rows)" },
  "EmployeePresenceLegislationType": { target: "skip", confidence: "exact", label: "Presence legislation types — auto-skip",   skipReason: "Lookup table (22 rows)" },
  "EmployeePresenceType":            { target: "skip", confidence: "exact", label: "Presence type lookup — auto-skip",          skipReason: "Lookup table (14 rows)" },
  "EmployeeForeignQualification":    { target: "skip", confidence: "exact", label: "Employee qualification junction — auto-skip", skipReason: "FK junction table" },
  "EmployeeQualification":           { target: "skip", confidence: "exact", label: "Qualification lookup — auto-skip",          skipReason: "Lookup table (117 rows of qualification types)" },

  // ── AUTO-SKIP: Corrupt/binary data ───────────────────────────────────────
  "Dobavljaci":              { target: "skip", confidence: "exact", label: "Corrupt binary data — auto-skip",          skipReason: "Binary data export (all null bytes, unreadable)" },
};

interface MappingRule {
  pattern: RegExp;
  target: string;
  confidence: "exact" | "high" | "medium";
  dedupField: string;
  label: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Layer 2 — Regex fallback for dbo.* files not in lookup + non-dbo files
// ──────────────────────────────────────────────────────────────────────────────
const MAPPING_RULES: MappingRule[] = [
  // ── HIGH — Supplier invoices (must come before generic invoice/faktura) ─────
  { pattern: /ulazn[ae]?.*faktur|faktur.*ulaz|supplier.*inv|ulazni.*racun/i, target: "supplier_invoices", confidence: "high", dedupField: "invoice_number", label: "Filename: supplier invoice pattern" },
  { pattern: /nabavn.*faktur|vendor.*inv|dobavljac.*faktur/i, target: "supplier_invoices", confidence: "high", dedupField: "invoice_number", label: "Filename: vendor/purchase invoice pattern" },
  // ── HIGH — Purchase orders ──────────────────────────────────────────────────
  { pattern: /narudzbenica|narudžbenica|purchase.?order|narudzb.*dobavljac|po_order/i, target: "purchase_orders", confidence: "high", dedupField: "order_number", label: "Filename: purchase order pattern" },
  // ── HIGH — Sales orders ─────────────────────────────────────────────────────
  { pattern: /prodajni.*nalog|sales.?order|izlazni.*nalog/i, target: "sales_orders", confidence: "high", dedupField: "order_number", label: "Filename: sales order pattern" },
  // ── HIGH — Invoices (outgoing) ──────────────────────────────────────────────
  { pattern: /faktur|invoice|racun/i, target: "invoices", confidence: "high", dedupField: "invoice_number", label: "Filename: invoice/faktura pattern" },
  // ── HIGH — Employees ────────────────────────────────────────────────────────
  { pattern: /zaposleni|employee|radnik|osoblje/i, target: "employees", confidence: "high", dedupField: "email", label: "Filename: employee pattern" },
  // ── HIGH — Warehouses ───────────────────────────────────────────────────────
  { pattern: /magacin|warehouse|skladiste|skladište/i, target: "warehouses", confidence: "high", dedupField: "name", label: "Filename: warehouse pattern" },
  // ── HIGH — Chart of accounts ────────────────────────────────────────────────
  { pattern: /kontni.*plan|konto.*plan|chart.*account|account.*chart|kontni/i, target: "chart_of_accounts", confidence: "high", dedupField: "code", label: "Filename: chart of accounts pattern" },
  // ── HIGH — Bank statements ───────────────────────────────────────────────────
  { pattern: /izvod.*banke|bank.*statement|bank.*izvod|izvod$/i, target: "bank_statements", confidence: "high", dedupField: "statement_number", label: "Filename: bank statement pattern" },
  // ── HIGH — Goods receipts ────────────────────────────────────────────────────
  { pattern: /primka|goods.*receipt|prijem.*robe|ulaz.*robe/i, target: "goods_receipts", confidence: "high", dedupField: "receipt_number", label: "Filename: goods receipt pattern" },
  // ── HIGH — Payments ─────────────────────────────────────────────────────────
  { pattern: /placanje|plaćanje|payment|uplata|isplata/i, target: "payments", confidence: "high", dedupField: "id", label: "Filename: payment pattern" },
  // ── HIGH — Retail prices ─────────────────────────────────────────────────────
  { pattern: /cenovnik.*maloprodaj|retail.*price|maloprodajn.*cen|nivelacija/i, target: "retail_prices", confidence: "high", dedupField: "id", label: "Filename: retail price/nivelacija pattern" },
  // ── HIGH — Kalkulacija ───────────────────────────────────────────────────────
  { pattern: /kalkulacij[ae]/i, target: "products", confidence: "high", dedupField: "sku", label: "Filename: kalkulacija pattern → products" },
  // ── HIGH — Partners ─────────────────────────────────────────────────────────
  { pattern: /kupac|dobavljac|dobavljač|poslovni.*partner/i, target: "partners", confidence: "high", dedupField: "pib", label: "Filename: partner (kupac/dobavljac) pattern" },
  // ── HIGH — Inventory stock ──────────────────────────────────────────────────
  { pattern: /lager|zaliha|stock/i, target: "inventory_stock", confidence: "high", dedupField: "id", label: "Filename: lager/stock pattern" },
  // ── MEDIUM — Products ────────────────────────────────────────────────────────
  { pattern: /artikal|proizvod|product|roba/i, target: "products", confidence: "medium", dedupField: "sku", label: "Filename: product/artikal pattern" },
  // ── MEDIUM — Partners (generic) ──────────────────────────────────────────────
  { pattern: /partner|customer|client|klijent/i, target: "partners", confidence: "medium", dedupField: "pib", label: "Filename: partner/customer pattern" },
  // ── MEDIUM — Contacts ────────────────────────────────────────────────────────
  { pattern: /contact|kontakt/i, target: "contacts", confidence: "medium", dedupField: "email", label: "Filename: contact/kontakt pattern" },
  // ── MEDIUM — Payroll ─────────────────────────────────────────────────────────
  { pattern: /plata|platni.*spisak|payroll|obracun.*plat|obračun/i, target: "payroll_runs", confidence: "medium", dedupField: "id", label: "Filename: payroll/plata pattern" },
  // ── MEDIUM — Contracts ───────────────────────────────────────────────────────
  { pattern: /ugovor|contract/i, target: "employee_contracts", confidence: "medium", dedupField: "id", label: "Filename: contract/ugovor pattern" },
  // ── MEDIUM — Tax / VAT ────────────────────────────────────────────────────────
  { pattern: /pdv|porez|tax.*rate|vat/i, target: "tax_rates", confidence: "medium", dedupField: "name", label: "Filename: PDV/tax pattern" },
  // ── MEDIUM — Locations ───────────────────────────────────────────────────────
  { pattern: /lokacija|location/i, target: "locations", confidence: "medium", dedupField: "name", label: "Filename: location/lokacija pattern" },
  // ── MEDIUM — Departments ──────────────────────────────────────────────────────
  { pattern: /odeljenje|odjel|department/i, target: "departments", confidence: "medium", dedupField: "name", label: "Filename: department/odeljenje pattern" },
  // ── MEDIUM — Currencies ────────────────────────────────────────────────────────
  { pattern: /valut[ae]|currency|deviz/i, target: "currencies", confidence: "medium", dedupField: "code", label: "Filename: currency/valuta pattern" },
  // ── MEDIUM — Leave/absence ─────────────────────────────────────────────────────
  { pattern: /odsustvo|bolovanje|godisnji|godišnji|leave|absence/i, target: "leave_requests", confidence: "medium", dedupField: "id", label: "Filename: leave/absence pattern" },
  // ── MEDIUM — Inventory movements ───────────────────────────────────────────────
  { pattern: /promet.*robi|inventory.*mov|lagern.*kret|kretanje.*lagera/i, target: "inventory_movements", confidence: "medium", dedupField: "id", label: "Filename: inventory movement pattern" },
];

// ──────────────────────────────────────────────────────────────────────────────
// Layer 3 — Header-based fallback
// ──────────────────────────────────────────────────────────────────────────────
function classifyByHeaders(headers: string[]): { target: string | null; dedupField: string; label: string } {
  const h = headers.map((x) => x.toLowerCase().replace(/[_\s-]+/g, ""));
  const has = (...terms: string[]) => terms.some((t) => h.some((col) => col.includes(t)));

  if (has("jmbg", "licnakarta", "maticanbroj")) return { target: "employees", dedupField: "email", label: "Header 'JMBG' detected → employees" };
  if (has("email") && has("ime", "prezime", "firstname", "lastname")) return { target: "contacts", dedupField: "email", label: "Header 'email' + name field → contacts" };
  if (has("pib", "taxid", "vatin")) return { target: "partners", dedupField: "pib", label: "Header 'pib/taxid' detected → partners" };
  if (has("ulaznibroj", "suppliernumber", "dobavljacfaktura")) return { target: "supplier_invoices", dedupField: "invoice_number", label: "Header supplier invoice field → supplier_invoices" };
  if (has("brojfakture", "invoicenumber", "fakturabr", "racunbr")) return { target: "invoices", dedupField: "invoice_number", label: "Header 'broj fakture' → invoices" };
  if (has("narudzbenica", "purchaseorder")) return { target: "purchase_orders", dedupField: "order_number", label: "Header 'narudzbenica' → purchase_orders" };
  if (has("sku", "sifraartikla", "barcode", "artiklsifra")) return { target: "products", dedupField: "sku", label: "Header 'sku/sifra artikla' → products" };
  if (has("konto", "accountcode", "sifrakonta")) return { target: "chart_of_accounts", dedupField: "code", label: "Header 'konto' → chart_of_accounts" };
  if (has("brutoplatа", "netoplata", "brutoplata", "payroll")) return { target: "payroll_runs", dedupField: "id", label: "Header payroll/plata → payroll_runs" };
  if (has("izvodbr", "statementno", "bankstatement")) return { target: "bank_statements", dedupField: "statement_number", label: "Header bank statement → bank_statements" };
  if (has("nalogknjizenja", "duguje", "potrazuje")) return { target: "journal_entries", dedupField: "entry_number", label: "Header 'duguje/potrazuje' → journal_entries" };
  if (has("centartroska", "costcenter")) return { target: "cost_centers", dedupField: "code", label: "Header cost center → cost_centers" };
  if (has("kolicina", "kolichinalagera", "stanjezaliha")) return { target: "inventory_stock", dedupField: "id", label: "Header stock quantity → inventory_stock" };
  if (has("email")) return { target: "contacts", dedupField: "email", label: "Header 'email' → contacts (fallback)" };

  return { target: null, dedupField: "", label: "" };
}

function classifyFile(filename: string, headers: string[], rowCount: number): {
  target: string | null;
  confidence: "exact" | "high" | "medium" | "none";
  dedupField: string;
  humanLabel: string;
  autoSkip: boolean;
  skipReason?: string;
  requiresParent?: string;
} {
  const basename = filename.split("/").pop() || filename;

  // ── STEP 0: Null-byte corruption detection ────────────────────────────────
  // SQL Server binary/blob columns exported as CSV produce rows full of \u0000.
  // If >50% of header cells contain null bytes, the file is unreadable.
  const nullByteRatio = headers.filter(h => h.includes('\u0000') || h === '\u0000').length / Math.max(headers.length, 1);
  if (nullByteRatio > 0.5) {
    return {
      target: null,
      confidence: "none",
      dedupField: "",
      humanLabel: "Binary/corrupt data detected (null bytes in CSV cells)",
      autoSkip: true,
      skipReason: "Binary data detected — SQL Server blob columns exported as CSV (unreadable)",
    };
  }

  // ── STEP 1: Exact dbo.TableName lookup ────────────────────────────────────
  const dboMatch = basename.match(/^dbo\.(.+?)\.csv$/i);
  if (dboMatch) {
    const tableName = dboMatch[1];
    const entry = DBO_TABLE_LOOKUP[tableName];
    if (entry) {
      const isSkip = entry.target === "skip";
      return {
        target: isSkip ? null : entry.target,
        confidence: entry.confidence,
        dedupField: entry.dedupField || "id",
        humanLabel: entry.label,
        autoSkip: isSkip,
        skipReason: entry.skipReason,
        requiresParent: entry.requiresParent,
      };
    }
    // Auto-skip very small dbo.* files not in lookup (≤5 rows → almost certainly a lookup table)
    if (rowCount <= 5 && rowCount >= 0) {
      return {
        target: null,
        confidence: "none",
        dedupField: "",
        humanLabel: `Unrecognized dbo table '${tableName}' with only ${rowCount} rows — likely a lookup table`,
        autoSkip: true,
        skipReason: `Unrecognized table with ≤5 rows (probable lookup/config table)`,
      };
    }
  }

  // ── STEP 2: Regex filename matching ───────────────────────────────────────
  for (const rule of MAPPING_RULES) {
    if (rule.pattern.test(basename)) {
      return {
        target: rule.target,
        confidence: rule.confidence,
        dedupField: rule.dedupField,
        humanLabel: rule.label,
        autoSkip: false,
      };
    }
  }

  // ── STEP 3: Header-based fallback ─────────────────────────────────────────
  const headerMatch = classifyByHeaders(headers);
  if (headerMatch.target) {
    return {
      target: headerMatch.target,
      confidence: "medium",
      dedupField: headerMatch.dedupField,
      humanLabel: headerMatch.label,
      autoSkip: false,
    };
  }

  return { target: null, confidence: "none", dedupField: "", humanLabel: "No matching pattern or header signal found", autoSkip: false };
}

function parseCSVHeaders(csvSample: string): { headers: string[]; sampleRows: string[][] } {
  const lines = csvSample.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], sampleRows: [] };

  const firstCols = parseCSVLine(lines[0]);
  const looksLikeHeader = firstCols.some((c) => isNaN(Number(c)) && c.length > 0 && c.length < 60);

  let headers: string[];
  let dataLines: string[];

  if (looksLikeHeader) {
    headers = firstCols;
    dataLines = lines.slice(1, 4);
  } else {
    headers = firstCols.map((_, i) => `col_${i + 1}`);
    dataLines = lines.slice(0, 3);
  }

  const sampleRows = dataLines.map((l) => parseCSVLine(l));
  return { headers, sampleRows };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { storagePath, sessionId } = body;

    if (!storagePath) {
      return new Response(JSON.stringify({ error: "storagePath is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: zipBlob, error: dlError } = await supabase.storage
      .from("legacy-imports")
      .download(storagePath);

    if (dlError || !zipBlob) throw new Error(`Storage download error: ${dlError?.message || "No data"}`);

    const zipBuffer = await zipBlob.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);

    const fileResults: any[] = [];

    const csvEntries = Object.entries(zip.files).filter(
      ([name, file]) => !file.dir && name.toLowerCase().endsWith(".csv")
    );

    for (const [filename, zipFile] of csvEntries) {
      try {
        const fullContent = await zipFile.async("string");
        const sample = fullContent.slice(0, 4000);

        const allLines = fullContent.split("\n").filter((l) => l.trim().length > 0);
        const totalLines = allLines.length;
        // Empty = 0 lines or 1 line (header only, no data)
        const isEmpty = totalLines <= 1;
        const rowCount = Math.max(0, totalLines - 1);

        const { headers, sampleRows } = parseCSVHeaders(sample);
        const { target, confidence, dedupField, humanLabel, autoSkip, skipReason, requiresParent } =
          classifyFile(filename, headers, rowCount);

        fileResults.push({
          filename: filename.split("/").pop() || filename,
          fullPath: filename,
          rowCount,
          headers,
          sampleRows,
          suggestedTarget: target,
          confidence,
          dedupField,
          humanLabel,
          isEmpty,
          autoSkip: autoSkip || isEmpty,
          skipReason: skipReason || (isEmpty ? "Empty file (0 data rows)" : undefined),
          requiresParent,
        });
      } catch (fileErr: any) {
        fileResults.push({
          filename: filename.split("/").pop() || filename,
          fullPath: filename,
          rowCount: 0,
          headers: [],
          sampleRows: [],
          suggestedTarget: null,
          confidence: "none",
          dedupField: "",
          humanLabel: `Parse error: ${fileErr.message}`,
          isEmpty: true,
          autoSkip: true,
          skipReason: "Parse error",
          parseError: fileErr.message,
        });
      }
    }

    // Sort: exact → high → medium → none; empty/auto-skip sink to bottom
    const confidenceOrder = { exact: 0, high: 1, medium: 2, none: 3 };
    fileResults.sort((a, b) => {
      // Auto-skipped / empty go last
      if (a.autoSkip !== b.autoSkip) return a.autoSkip ? 1 : -1;
      if (a.isEmpty !== b.isEmpty) return a.isEmpty ? 1 : -1;
      const ao = confidenceOrder[a.confidence as keyof typeof confidenceOrder] ?? 3;
      const bo = confidenceOrder[b.confidence as keyof typeof confidenceOrder] ?? 3;
      if (ao !== bo) return ao - bo;
      return b.rowCount - a.rowCount;
    });

    if (sessionId) {
      await supabase
        .from("legacy_import_sessions")
        .update({ analysis: fileResults, status: "analyzed" })
        .eq("id", sessionId);
    }

    return new Response(
      JSON.stringify({ success: true, files: fileResults, totalCsvFiles: csvEntries.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("analyze-legacy-zip error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
