# ERP-AI Full Application Architecture Documentation

**Version:** 3.0  
**Date:** February 23, 2026 (Updated — AI End-to-End Upgrade)  
**System:** ProERP AI — Multi-Tenant SaaS ERP for Serbian Market  
**Production URL:** https://proerpai.lovable.app

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Module Dependency Map](#3-module-dependency-map)
4. [Database Schema Reference](#4-database-schema-reference)
5. [API / Edge Functions Reference](#5-api--edge-functions-reference)
6. [Frontend Route Map](#6-frontend-route-map)
7. [State Management](#7-state-management)
8. [Feature Deep-Dives](#8-feature-deep-dives)
9. [Integration Points](#9-integration-points)
10. [Security Architecture](#10-security-architecture)
11. [Event System](#11-event-system)
12. [Postman Collection Structure](#12-postman-collection-structure)

---

## 1. Executive Summary

### 1.1 Purpose

ProERP AI is a comprehensive, multi-tenant SaaS ERP system purpose-built for the **Serbian market**. It provides integrated modules for accounting (compliant with Serbian Accounting Laws 2026), CRM, sales, purchasing, inventory/WMS, HR/payroll, production, POS, document management, and advanced analytics — all with full Serbian language (Cyrillic/Latin) support.

### 1.2 Target Market

- Serbian SMBs and enterprises requiring compliant accounting, VAT (PDV), SEF e-invoicing, and fiscal receipt integration
- Companies needing multi-entity (multiple PIB/legal entity) support under a single tenant

### 1.3 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18.3 + TypeScript 5.8 + Vite |
| **Styling** | Tailwind CSS + shadcn/ui (Radix primitives) |
| **State** | TanStack Query 5.83 (server state), React Context (auth/tenant/language) |
| **Routing** | React Router DOM 6.30 |
| **Charts** | Recharts 2.15 |
| **Animation** | Framer Motion 12.34 |
| **Backend** | Supabase (PostgreSQL 15, Auth, Edge Functions, Storage, Realtime) |
| **Edge Functions** | Deno runtime (69+ functions) |
| **Auth** | Supabase Auth (email/password, magic link) |
| **Markdown** | react-markdown 10.1 |
| **i18n** | Custom LanguageContext (EN/SR toggle) |

### 1.4 Multi-Tenant Architecture Summary

```
┌──────────────────────────────────────────────────┐
│                  Supabase Auth                    │
│  (email/password → JWT with user_id)             │
└──────────┬───────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────┐
│  user_roles table: super_admin | admin | ...     │
│  tenant_members table: user ↔ tenant + role      │
└──────────┬───────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────┐
│  Row-Level Security (RLS)                        │
│  Every table: WHERE tenant_id IN                 │
│    (SELECT tenant_id FROM tenant_members          │
│     WHERE user_id = auth.uid())                  │
└──────────────────────────────────────────────────┘
```

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React SPA (Vite)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  QueryClientProvider                                      │  │
│  │  └─ LanguageProvider (EN/SR)                              │  │
│  │     └─ AuthProvider (user, session, roles, isSuperAdmin)  │  │
│  │        └─ TenantProvider (tenantId, role, switchTenant)    │  │
│  │           └─ BrowserRouter                                │  │
│  │              ├─ /login, /register, /reset-password         │  │
│  │              ├─ /super-admin/* → SuperAdminLayout          │  │
│  │              └─ /* → TenantLayout (ProtectedRoute)         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTPS (Supabase JS SDK)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Platform                             │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │ PostgreSQL │  │ Auth (GoTrue)│  │ Edge Functions (Deno) │    │
│  │ + RLS      │  │ JWT tokens   │  │ 65+ functions         │    │
│  │ + Triggers │  └──────────────┘  └──────────────────────┘    │
│  │ + RPC      │  ┌──────────────┐  ┌──────────────────────┐    │
│  │ Functions  │  │ Storage      │  │ Realtime (pg_notify)  │    │
│  └────────────┘  └──────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Provider Hierarchy

```
<QueryClientProvider>          // TanStack Query cache
  <LanguageProvider>           // i18n context (en/sr)
    <AuthProvider>             // Supabase auth state + user_roles
      <TenantProvider>         // Active tenant selection + tenant_members role
        <TooltipProvider>
          <BrowserRouter>
            <Routes>...</Routes>
          </BrowserRouter>
        </TooltipProvider>
      </TenantProvider>
    </AuthProvider>
  </LanguageProvider>
</QueryClientProvider>
```

### 2.3 Authentication Flow

1. User submits email/password → `supabase.auth.signInWithPassword()`
2. Supabase Auth returns JWT with `user.id`
3. `AuthProvider` listens to `onAuthStateChange` → sets `user`, `session`
4. Separate `useEffect` fetches `user_roles` from DB → determines `isSuperAdmin`
5. `TenantProvider` fetches `tenant_members` where `user_id = auth.uid()` and `status = 'active'`
6. Active tenant stored in `localStorage('selectedTenantId')` for persistence across refreshes
7. All subsequent DB queries scoped by `tenant_id` via RLS

### 2.4 Multi-Tenancy Data Model

```
tenants (id, name, slug, ...)
  └── tenant_members (tenant_id, user_id, role, status)
  └── tenant_modules (tenant_id, module_id, is_enabled)
        └── module_definitions (id, key, name, ...)
  └── tenant_settings (tenant_id, sef_*, fiscal_*, ...)
```

- **Isolation**: Every business table has `tenant_id` column with RLS policies
- **Module gating**: `usePermissions()` hook checks both role permissions AND `tenant_modules` enablement
- **User switching**: Users can belong to multiple tenants; `switchTenant()` updates localStorage and triggers re-fetch

---

## 3. Module Dependency Map

### 3.1 Module Overview

| Module | Key | DB Tables | Edge Functions | Pages |
|--------|-----|-----------|---------------|-------|
| **Dashboard** | `dashboard` | (aggregates from all) | — | 1 |
| **CRM** | `crm` | partners, companies, contacts, leads, opportunities, meetings, activities, crm_tasks, company_categories | crm-tier-refresh | 12 |
| **Sales** | `sales` | quotes, quote_lines, quote_versions, sales_orders, sales_order_lines, salespeople | — | 6 |
| **Web Channel** | `web` | web_settings, web_prices | web-sync, web-order-import | 2 |
| **Purchasing** | `purchasing` | purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines, supplier_invoices, supplier_invoice_lines | — | 3 |
| **Inventory** | `inventory` | products, inventory_stock, inventory_movements, warehouses, locations, internal_transfers, internal_transfer_items, internal_goods_receipts, kalkulacije, kalkulacija_lines, nivelacije, nivelacija_lines, wms_zones, wms_bins, wms_tasks, wms_cycle_counts, inventory_cost_layers, **dispatch_notes**, **dispatch_note_lines**, **dispatch_receipts** | wms-slotting, eotpremnica-submit | 21 |
| **Accounting** | `accounting` | chart_of_accounts, journal_entries, journal_lines, invoices, invoice_lines, fiscal_periods, pdv_periods, pdv_entries, tax_rates, bank_statements, bank_statement_lines, bank_accounts, fixed_assets, deferrals, deferral_schedules, loans, open_items, budgets, posting_rules, fx_rates | generate-pdf, nbs-exchange-rates | 22 |
| **Analytics** | `analytics` | ar_aging_snapshots, ap_aging_snapshots, budgets | ai-analytics-narrative, ai-insights | 13 |
| **HR** | `hr` | employees, employee_contracts, departments, attendance_records, leave_requests, payroll_runs, payroll_items, payroll_parameters, overtime_hours, night_work_records, annual_leave_balances, holidays, deduction_types, deductions, allowance_types, allowances, external_workers, insurance_records, position_templates, work_logs | ebolovanje-submit | 17 |
| **Production** | `production` | bom_templates, bom_lines, production_orders, production_order_lines, **production_scenarios** | production-ai-planning | 7 |
| **Documents** | `documents` | documents, document_categories, document_access, archive_book, archiving_requests, archiving_request_items, dms_projects | storage-upload, storage-download, storage-delete | 9 |
| **POS** | `pos` | pos_sessions, pos_transactions, pos_transaction_items, fiscal_devices, fiscal_receipts | fiscalize-receipt, fiscalize-retry-offline | 4 |
| **Returns** | `returns` | returns, return_lines | — | 1 |

### 3.2 Cross-Module Dependencies

```
Invoices ──────► Chart of Accounts (posting accounts: 2040, 6000, 4700)
    │           ► Fiscal Periods (check_fiscal_period_open)
    │           ► Partners (partner_id, partner_name)
    │           ► Legal Entities (legal_entity_id)
    │           ► Products (invoice_lines → product_id)
    │           ► PDV Periods (blocks posting if submitted/closed)
    │           ► Inventory Stock (deduction on post via process_invoice_post)
    │
POS ────────────► Chart of Accounts (2430/2431, 6010, 2470, 5010, 1320, 1329, 1340)
    │           ► Fiscal Devices (fiscal receipt generation)
    │           ► Inventory Stock (stock deduction)
    │           ► Fiscal Periods
    │
Sales Orders ──► Products, Partners, Inventory (reserve_stock_for_order)
    │
Quotes ────────► Partners, Products, Opportunities, Approval Workflows (discount approval)
    │
Purchasing ────► Partners (supplier), Products, Warehouses
    │           ► Inventory (goods_receipts → adjust_inventory_stock)
    │           ► Accounting (supplier_invoices → journal entries)
    │
Payroll ───────► Employees, Employee Contracts
    │           ► Payroll Parameters (tax rates, contribution bases)
    │           ► Overtime Hours, Night Work, Leave Requests
    │           ► Posting Rules → Journal Entries
    │
Production ────► BOM Templates → Products (materials)
    │           ► Inventory Stock (material consumption, finished goods)
    │           ► Journal Entries (WIP → Finished Goods accounting)
    │
CRM ───────────► Partners (tier calculation, dormancy detection)
    │           ► Invoices (revenue for tier calculation)
    │           ► Quotes, Opportunities, Meetings, Activities
```

### 3.3 Role-Permission Matrix

| Module | admin | manager | accountant | sales | hr | store | user |
|--------|:-----:|:-------:|:----------:|:-----:|:--:|:-----:|:----:|
| dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| crm | ✅ | ✅ | — | ✅ | — | ✅ | — |
| sales | ✅ | ✅ | — | ✅ | — | ✅ | — |
| web | ✅ | ✅ | — | ✅ | — | — | — |
| purchasing | ✅ | ✅ | — | — | — | — | — |
| inventory | ✅ | ✅ | — | ✅ | — | ✅ | — |
| accounting | ✅ | — | ✅ | — | — | — | — |
| analytics | ✅ | ✅ | ✅ | — | — | — | — |
| hr | ✅ | — | — | — | ✅ | — | — |
| production | ✅ | ✅ | — | — | — | — | — |
| documents | ✅ | ✅ | — | ✅ | ✅ | — | ✅ |
| pos | ✅ | ✅ | — | — | — | ✅ | ✅ |
| returns | ✅ | ✅ | — | — | — | ✅ | — |
| settings (full) | ✅ | — | — | — | — | — | — |
| settings-tax-rates | ✅ | — | ✅ | — | — | — | — |
| settings-currencies | ✅ | — | ✅ | — | — | — | — |

---

## 4. Database Schema Reference

### 4.1 Core Tables by Module

#### 4.1.1 Tenancy & Auth

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `tenants` | Tenant organizations | id, name, slug, is_active |
| `tenant_members` | User-tenant membership | tenant_id, user_id, role, status |
| `tenant_modules` | Module enablement per tenant | tenant_id, module_id, is_enabled |
| `module_definitions` | Available modules | id, key, name, description |
| `tenant_settings` | Tenant configuration | tenant_id, sef_api_url, sef_api_key, fiscal_*, company_* |
| `tenant_invitations` | Pending user invitations | tenant_id, email, role, status, expires_at |
| `profiles` | User profiles | id (= auth.users.id), full_name, avatar_url |
| `user_roles` | Global roles | user_id, role (app_role enum) |

#### 4.1.2 Accounting

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `chart_of_accounts` | Serbian kontni plan | code, name, name_sr, account_type, parent_id, level, is_system |
| `journal_entries` | Double-entry header | entry_number, entry_date, status (draft/posted/reversed), fiscal_period_id, legal_entity_id, source, storno_of_id, storno_by_id |
| `journal_lines` | Debit/credit lines | journal_entry_id, account_id, debit, credit, description |
| `invoices` | Sales invoices | invoice_number, partner_id, subtotal, tax_amount, total, status, sef_status, journal_entry_id |
| `invoice_lines` | Invoice line items | invoice_id, product_id, quantity, unit_price, tax_rate |
| `fiscal_periods` | Accounting periods | start_date, end_date, status (open/closed/locked), is_closed |
| `pdv_periods` | VAT periods | period_name, start_date, end_date, status (draft/submitted/closed), popdv sections |
| `pdv_entries` | VAT entries | pdv_period_id, invoice_id/supplier_invoice_id, section, tax_base, tax_amount |
| `posting_rules` | Auto-posting config | rule_type, debit_account_code, credit_account_code |
| `bank_accounts` | Company bank accounts | account_number, bank_name, currency, legal_entity_id |
| `bank_statements` | Imported statements | bank_account_id, statement_date, opening/closing_balance |
| `bank_statement_lines` | Statement lines | amount, direction, match_status, matched_invoice_id |
| `fixed_assets` | Asset register | name, purchase_date, purchase_value, depreciation_method, accumulated_depreciation |
| `deferrals` | Prepaid expense/revenue | total_amount, start_date, end_date, periods, per_period_amount |
| `deferral_schedules` | Deferral amortization | deferral_id, period_date, amount, journal_entry_id |
| `loans` | Loan tracking | principal, interest_rate, start_date, maturity_date |
| `budgets` | Budget amounts | account_id, fiscal_year, month, amount |

#### 4.1.3 CRM

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `partners` | Business partners | name, pib, is_customer, is_supplier, account_tier (A/B/C/D), dormancy_status, tier_revenue_12m |
| `companies` | Company entities | legal_name, pib, maticni_broj, partner_id, legal_entity_id |
| `contacts` | Contact persons | first_name, last_name, email, phone, company_id, partner_id |
| `leads` | Sales leads | name, source, status, score, assigned_to |
| `opportunities` | Sales pipeline | title, partner_id, stage, value, probability, expected_close_date, won_value |
| `opportunity_stages` | Custom stages | name, position, is_won, is_lost |
| `meetings` | Scheduled meetings | title, meeting_date, partner_id, company_id, contact_id |
| `activities` | Activity log | type, description, partner_id, company_id, contact_id, lead_id, opportunity_id |
| `crm_tasks` | CRM tasks | title, task_type, priority, status, partner_id, due_date |
| `company_categories` | Category taxonomy | code, name, parent_id, color |
| `company_category_assignments` | Category links | company_id, category_id |

#### 4.1.4 Sales

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `quotes` | Price quotes | quote_number, partner_id, total, status (draft/sent/accepted/expired), valid_until, current_version, opportunity_id |
| `quote_lines` | Quote items | quote_id, product_id, quantity, unit_price, discount_percent |
| `quote_versions` | Version history | quote_id, version_number, snapshot (JSONB), created_by |
| `sales_orders` | Confirmed orders | order_number, partner_id, status, total |
| `sales_order_lines` | Order items | sales_order_id, product_id, quantity |
| `salespeople` | Sales reps | first_name, last_name, email, commission_rate |

#### 4.1.5a Dispatch Notes (e-Otpremnice)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `dispatch_notes` | Dispatch note documents | document_number, dispatch_date, sender_name, sender_pib, sender_address, sender_city, receiver_name, receiver_pib, receiver_address, receiver_city, transport_reason, vehicle_plate, driver_name, status (draft/confirmed/in_transit/delivered), eotpremnica_status, eotpremnica_sent_at |
| `dispatch_note_lines` | Line items per dispatch note | dispatch_note_id, product_id, description, quantity, unit, weight, lot_number, serial_number |
| `dispatch_receipts` | Receipt confirmations (prijemnica) | dispatch_note_id, receipt_number, receipt_date, received_by, warehouse_id, status, notes |

#### 4.1.5b Purchasing

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `purchase_orders` | Purchase orders | order_number, supplier_name, status, total |
| `purchase_order_lines` | PO items | purchase_order_id, product_id, quantity, unit_price |
| `goods_receipts` | Receiving | receipt_number, purchase_order_id, warehouse_id, status |
| `goods_receipt_lines` | Receipt items | goods_receipt_id, product_id, quantity_received |
| `supplier_invoices` | Vendor invoices | invoice_number, partner_id, total, status, sef_invoice_id |
| `supplier_invoice_lines` | Invoice items | supplier_invoice_id, description, amount |

#### 4.1.6 Inventory & WMS

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `products` | Product catalog | sku, name, purchase_price, selling_price, product_type (goods/service/raw_material/finished) |
| `inventory_stock` | Current stock | product_id, warehouse_id, quantity_on_hand, quantity_reserved, unit_cost |
| `inventory_movements` | Stock movements | product_id, warehouse_id, movement_type (in/out/adjustment/sale), quantity, reference |
| `warehouses` | Warehouses | name, code, location_id, is_active |
| `internal_transfers` | Inter-warehouse | transfer_number, from_warehouse_id, to_warehouse_id, status (draft/in_transit/delivered) |
| `internal_transfer_items` | Transfer items | product_id, quantity_sent, quantity_received |
| `internal_goods_receipts` | Transfer receipts | internal_transfer_id, receiving_warehouse_id, status |
| `kalkulacije` | Retail pricing | document_number, legal_entity_id, status (draft/posted), journal_entry_id |
| `kalkulacija_lines` | Pricing lines | product_id, purchase_price, retail_price, markup_percent, tax_rate |
| `nivelacije` | Price revaluation | document_number, status, journal_entry_id |
| `nivelacija_lines` | Revaluation lines | product_id, old_price, new_price, price_difference |
| `wms_zones` | Warehouse zones | warehouse_id, name, zone_type |
| `wms_bins` | Storage bins | zone_id, code, max_weight, current_product_id |
| `wms_tasks` | WMS tasks | task_type (pick/put/count), status, bin_id, product_id |
| `wms_cycle_counts` | Cycle counting | warehouse_id, status, counted_at |
| `inventory_cost_layers` | FIFO/LIFO layers | product_id, warehouse_id, quantity, unit_cost, layer_date |

#### 4.1.7 HR & Payroll

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `employees` | Employee records | first_name, last_name, jmbg, status (active/inactive/terminated) |
| `employee_contracts` | Employment contracts | employee_id, contract_type, start_date, end_date, gross_salary, working_hours_per_week |
| `departments` | Org departments | name, manager_id |
| `attendance_records` | Daily attendance | employee_id, date, check_in, check_out, status, hours_worked |
| `leave_requests` | Leave management | employee_id, leave_type, start_date, end_date, status |
| `payroll_runs` | Payroll batches | period_month, period_year, status (draft/calculated/approved/posted), total_gross, total_net |
| `payroll_items` | Per-employee payroll | employee_id, gross_salary, net_salary, income_tax, pension/health/unemployment contributions |
| `payroll_parameters` | Serbian tax params | effective_from, tax_rate, nontaxable_amount, min/max_contribution_base, PIO/health/unemployment rates |
| `overtime_hours` | Overtime records | employee_id, month, year, hours |
| `night_work_records` | Night work | employee_id, month, year, hours |
| `annual_leave_balances` | Leave balances | employee_id, year, entitled_days, used_days, carried_over_days |
| `holidays` | Public holidays | date, name |
| `work_logs` | Work time entries | employee_id, date, hours, project, description |

#### 4.1.8 Production

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `bom_templates` | Bill of materials | name, product_id, version, is_active |
| `bom_lines` | BOM components | bom_template_id, material_product_id, quantity, unit |
| `production_orders` | Manufacturing | order_number, product_id, bom_template_id, planned_quantity, status (draft/in_progress/completed), **priority** (1-5, default 3) |
| `production_order_lines` | Material consumption | production_order_id, product_id, planned_quantity, actual_quantity |
| `production_scenarios` | Saved AI scenarios (simulation, schedule, bottleneck) | name, scenario_type, params (JSONB), result (JSONB), created_by, tenant_id |

#### 4.1.9 POS & Fiscal

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `pos_sessions` | POS shifts | cashier_id, opened_at, closed_at, opening_balance, closing_balance |
| `pos_transactions` | POS sales | transaction_number, session_id, payment_method, subtotal, tax_amount, total, items (JSONB), warehouse_id |
| `fiscal_devices` | Fiscal hardware | name, api_url, pac, location_id, tax_label_map |
| `fiscal_receipts` | Fiscal receipts | pos_transaction_id, fiscal_device_id, receipt_number, status (pending/fiscalized/failed) |

#### 4.1.10 Documents (DMS)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `documents` | Document registry | protocol_number, title, category_id, status (draft/active/archived), file_path |
| `document_categories` | Doc categories | name, code, retention_years |
| `document_access` | Access control | document_id, user_id, access_level |
| `archive_book` | Archive register | entry_number, content_description, year_of_creation, retention_period, transferred_to_archive |
| `archiving_requests` | Destruction requests | request_number, status (pending/approved/rejected/executed), reason |
| `archiving_request_items` | Items to destroy | request_id, archive_book_id |
| `dms_projects` | DMS projects | name, description, status |

#### 4.1.11 Platform

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `approval_workflows` | Approval rules | entity_type, min_approvers, required_roles, threshold_amount |
| `approval_requests` | Pending approvals | workflow_id, entity_type, entity_id, status |
| `approval_steps` | Approval actions | request_id, approver_user_id, action (approved/rejected), comment |
| `audit_log` | Audit trail | action, entity_type, entity_id, user_id, details (JSONB) |
| `module_events` | Event bus | event_type, source_module, entity_type, entity_id, payload, status, retry_count |
| `notifications` | User notifications | user_id, title, message, is_read, link |
| `legal_entities` | Legal entities (PIBs) | name, pib, maticni_broj, address |
| `currencies` | Currency definitions | code, name, symbol, exchange_rate |
| `fx_rates` | Exchange rate history | currency_code, rate_date, rate |
| `ai_action_log` | AI audit trail | module, action_type, ai_output, user_decision, confidence_score |
| `ai_conversations` | AI chat history | user_id, messages (JSONB) |
| `ai_insights_cache` | Cached AI insights | insight_type, title, description, severity, expires_at |

### 4.2 Key Database Functions & Triggers

#### Critical RPC Functions

| Function | Purpose | Security |
|----------|---------|----------|
| `create_journal_entry_with_lines(p_tenant_id, p_entry_number, p_entry_date, p_lines JSONB)` | Atomic journal entry creation with balance validation | SECURITY DEFINER + assert_tenant_member |
| `process_invoice_post(p_invoice_id, p_default_warehouse_id)` | Posts invoice → creates journal entry + COGS + inventory deduction | SECURITY DEFINER + assert_tenant_member |
| `process_pos_sale(p_transaction_id, p_tenant_id)` | POS sale → journal entry with retail accounting (1320/1329/1340) | SECURITY DEFINER |
| `storno_journal_entry(p_journal_entry_id)` | Reversal entry (swaps debit/credit), marks original as 'reversed' | SECURITY DEFINER + assert_tenant_member |
| `check_fiscal_period_open(p_tenant_id, p_entry_date)` | Validates fiscal + PDV period are open for posting | STABLE SECURITY DEFINER |
| `calculate_payroll_for_run(p_payroll_run_id)` | Full Serbian payroll calculation with all contributions | SECURITY DEFINER |
| `calculate_partner_tiers(p_tenant_id)` | A/B/C/D tier assignment by 12-month revenue percentiles | SECURITY DEFINER |
| `detect_partner_dormancy(p_tenant_id)` | Dormancy detection with tier-specific thresholds + CRM task creation | SECURITY DEFINER |
| `expire_overdue_quotes(p_tenant_id)` | Auto-expires quotes past valid_until date | SECURITY DEFINER |
| `adjust_inventory_stock(...)` | Stock adjustment with movement record and upsert | SECURITY DEFINER |
| `confirm_internal_transfer(p_transfer_id)` | Processes outbound stock movements for transfers | SECURITY DEFINER |
| `confirm_internal_receipt(p_receipt_id)` | Processes inbound stock at destination warehouse | SECURITY DEFINER |
| `post_kalkulacija(p_kalkulacija_id)` | Posts retail pricing calculation with journal entry (1320/1300/1329/1340) | SECURITY DEFINER |
| `post_nivelacija(p_nivelacija_id)` | Posts price revaluation with journal entry | SECURITY DEFINER |
| `reserve_stock_for_order(p_tenant_id, p_sales_order_id)` | Reserves inventory for sales orders | SECURITY DEFINER |
| `emit_module_event(...)` | Emits event to module_events table + pg_notify | SECURITY DEFINER |
| `force_delete_journal_entries(p_tenant_id)` | Admin cleanup (disables triggers temporarily) | SECURITY DEFINER |
| `perform_year_end_closing(p_tenant_id, p_year)` | Closes revenue/expense accounts → retained earnings (3000) | SECURITY DEFINER |

#### Trigger Functions

| Trigger | On Table | Purpose |
|---------|----------|---------|
| `check_journal_balance` | journal_entries (BEFORE UPDATE) | Ensures SUM(debit) = SUM(credit) when status → 'posted' |
| `protect_posted_journal_entry` | journal_entries (BEFORE UPDATE) | Blocks modification of posted entries (allows only → 'reversed') |
| `protect_posted_journal_lines` | journal_lines (BEFORE UPDATE/DELETE) | Blocks line changes on posted entries |
| `log_audit_event` | Various tables (AFTER INSERT/UPDATE/DELETE) | Writes to audit_log with old/new JSONB |
| `update_updated_at_column` | Various tables (BEFORE UPDATE) | Auto-updates `updated_at` timestamp |
| `handle_new_user` | auth.users (AFTER INSERT) | Creates profile + default 'user' role |
| `accept_pending_invitations` | auth.users (AFTER INSERT) | Auto-accepts pending tenant_invitations by email |
| `seed_tenant_settings` | tenants (AFTER INSERT) | Creates tenant_settings row |
| `trigger_seed_chart_of_accounts` | tenants (AFTER INSERT) | Seeds Serbian kontni plan |
| `trigger_seed_tax_rates` | tenants (AFTER INSERT) | Seeds default PDV rates (20%, 10%, 0%) |
| `purchasing_event_trigger` | purchase_orders, goods_receipts, supplier_invoices | Emits module events on status changes |

### 4.3 RLS Strategy

All business tables follow this pattern:

```sql
-- SELECT: user must be active member of the row's tenant
CREATE POLICY "tenant_isolation_select" ON public.table_name
FOR SELECT USING (
  tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
);

-- INSERT: user must be active member AND tenant_id must match
CREATE POLICY "tenant_isolation_insert" ON public.table_name
FOR INSERT WITH CHECK (
  tenant_id IN (SELECT get_user_tenant_ids(auth.uid()))
);

-- UPDATE/DELETE: same pattern
```

Super admins bypass via `is_super_admin(auth.uid())` in some policies.

---

## 5. API / Edge Functions Reference

**Base URL:** `https://hfvoehsrsimvgyyxirwj.supabase.co/functions/v1/`

### 5.1 AI Functions *(Upgraded in v3.0)*

| Function | Method | JWT | Purpose |
|----------|--------|-----|---------|
| `ai-assistant` | POST | ❌ | Conversational AI copilot with **7 tools** (`query_tenant_data`, `analyze_trend`, `create_reminder`, `compare_periods`, `what_if_scenario`, `get_kpi_scorecard`, `explain_account`), **5 tool-calling rounds**, **true SSE streaming**, **dynamic schema context** from `information_schema.columns` (cached 1hr), **audit logging** to `ai_action_log` |
| `ai-insights` | POST | ❌ | **Hybrid rules + AI enrichment**: 7 rule-based anomaly checks + Gemini AI prioritization, cross-module correlation, strategic recommendations, executive summary. **Audit logging** |
| `ai-analytics-narrative` | POST | ❌ | AI-generated analytics narrative with **DB tool-calling** (`query_tenant_data` for drill-down), **response caching** in `ai_narrative_cache` (30min TTL), **audit logging**. **Supported narratives:** dashboard, ratios, cashflow, planning, budget, breakeven, profitability, expenses, working_capital, customer_risk, supplier_risk, margin_bridge, payroll_benchmark, vat_trap, inventory_health, early_warning, **production**, **crm_pipeline**, **hr_overview**, **pos_performance**, **purchasing** |
| `ai-executive-briefing` | POST | ❌ | **Role-based AI briefing** with date range filtering (`date_from`/`date_to`). Queries KPIs from invoices, POS, production, leave requests within selected period. Gemini AI generates executive summary with recommendations. |
| `production-ai-planning` | POST | ❌ | AI production planning: 6 actions (`generate-schedule`, `predict-bottlenecks`, `simulate-scenario`, `local-fallback-schedule`, `save-scenario`, `list-scenarios`). Locked/excluded order filtering, post-AI date validation, **scenario persistence** in `production_scenarios`, **audit logging** |
| `wms-slotting` | POST | ❌ | AI/local warehouse slot optimization with **bin capacity validation**, **SQL-filtered data** (top 100 bins, 5000 picks limit), **batch task generation**, **scenario comparison view**, **audit logging** |

**Request format (ai-assistant):**
```json
{
  "messages": [{"role": "user", "content": "..."}],
  "tenantId": "uuid",
  "module": "accounting",
  "context": { /* module-specific data */ },
  "conversationId": "uuid (optional — for persistence)"
}
```

### 5.2 SEF (E-Invoice) Functions

| Function | Method | JWT | Purpose |
|----------|--------|-----|---------|
| `sef-submit` | POST | ❌ | Submit invoice to Serbian e-invoice system (UBL 2.1) |
| `sef-poll-status` | POST | ❌ | Check SEF submission status |
| `sef-fetch-invoices` | POST | ❌ | Fetch invoices from SEF |
| `sef-fetch-sales-invoices` | POST | ❌ | Import sales invoices from SEF |
| `sef-fetch-purchase-invoices` | POST | ❌ | Import purchase invoices from SEF |
| `sef-send-invoice` | POST | ✅ | Send specific invoice to SEF |
| `sef-get-invoice-xml` | POST | ✅ | Get UBL XML for invoice |
| `sef-accept-reject-invoice` | POST | ✅ | Accept/reject received invoice |
| `sef-cancel-sales-invoice` | POST | ✅ | Cancel submitted sales invoice |
| `sef-background-sync` | POST | ✅ | Background synchronization with SEF |
| `sef-continue-sync` | POST | ✅ | Continue interrupted sync |
| `sef-long-sync` | POST | ✅ | Full historical sync |
| `sef-enrich-invoices` | POST | ✅ | Enrich invoices with SEF data |
| `sef-registry-import` | POST | ✅ | Import company registry from SEF |
| `sef-registry-auto-update` | POST | ✅ | Auto-update registry data |

**Request format (sef-submit):**
```json
{
  "invoiceId": "uuid",
  "tenantId": "uuid"
}
```

### 5.3 Fiscal Functions

| Function | Method | JWT | Purpose |
|----------|--------|-----|---------|
| `fiscalize-receipt` | POST | ❌ | Send receipt to fiscal device for fiscalization |
| `fiscalize-retry-offline` | POST | ❌ | Retry failed fiscal receipts |

### 5.4 Email Functions

| Function | Method | JWT | Purpose |
|----------|--------|-----|---------|
| `send-invoice-email` | POST | ✅ | Email invoice PDF to customer |
| `send-notification-emails` | POST | ✅ | Batch notification emails |
| `send-verification-email` | POST | ✅ | Email verification |
| `send-admin-bulk-email` | POST | ✅ | Admin bulk email |
| `verify-email` | POST | ✅ | Verify email token |

### 5.5 Storage Functions

| Function | Method | JWT | Purpose |
|----------|--------|-----|---------|
| `storage-upload` | POST | ✅ | Upload file to Supabase Storage |
| `storage-download` | POST | ✅ | Download file |
| `storage-delete` | POST | ✅ | Delete file |
| `storage-get-base64` | POST | ✅ | Get file as base64 (for PDF embedding) |
| `storage-cleanup` | POST | ✅ | Clean orphaned files |
| `storage-fix-logos` | POST | ✅ | Fix logo paths |
| `storage-migrate` | POST | ✅ | Migrate storage paths |

### 5.6 Admin Functions

| Function | Method | JWT | Purpose |
|----------|--------|-----|---------|
| `admin-create-user` | POST | ❌ | Create user with role (super-admin use) |
| `delete-user` | POST | ✅ | Delete user account |
| `create-tenant` | POST | ❌ | Create new tenant with initial setup |
| `create-notification` | POST | ❌ | Create notification record |
| `get-vapid-public-key` | GET | ✅ | Get VAPID key for push notifications |

### 5.7 Import/Migration Functions

| Function | Method | JWT | Purpose |
|----------|--------|-----|---------|
| `import-legacy-products` | POST | ❌ | Import products from legacy system CSV |
| `import-legacy-partners` | POST | ❌ | Import partners from legacy CSV |
| `import-legacy-contacts` | POST | ❌ | Import contacts from legacy CSV |
| `analyze-legacy-zip` | POST | ❌ | Analyze uploaded legacy data ZIP |
| `import-legacy-zip` | POST | ❌ | Process legacy ZIP import |

### 5.8 Data Seeding Functions

| Function | Method | JWT | Purpose |
|----------|--------|-----|---------|
| `seed-demo-data` | POST | ❌ | Phase 1 demo data |
| `seed-demo-data-phase2` | POST | ❌ | Phase 2 demo data |
| `seed-demo-data-phase3` | POST | ❌ | Phase 3 demo data |
| `daily-data-seed` | POST | ❌ | Daily automated data generation |

### 5.9 Utility Functions

| Function | Method | JWT | Purpose |
|----------|--------|-----|---------|
| `generate-pdf` | POST | ❌ | Generate PDF (invoices, reports) |
| `company-lookup` | POST | ❌ | APR company registry lookup by PIB/MB |
| `apr-lookup` | POST | ✅ | APR (Agency for Business Registers) lookup |
| `validate-pib` | POST | ✅ | Validate Serbian PIB (tax ID) |
| `nbs-exchange-rates` | POST | ❌ | Fetch NBS (National Bank of Serbia) exchange rates |
| `nbs-exchange-rate` | POST | ✅ | Get specific exchange rate |

### 5.10 Web Channel Functions

| Function | Method | JWT | Purpose |
|----------|--------|-----|---------|
| `web-sync` | POST | ❌ | Sync products/prices to web channel |
| `web-order-import` | POST | ❌ | Import orders from web channel |

### 5.11 Other Functions

| Function | Method | JWT | Purpose |
|----------|--------|-----|---------|
| `process-module-event` | POST | ❌ | Process events from module event bus |
| `crm-tier-refresh` | POST | ❌ | Refresh partner tiers and dormancy |
| `ebolovanje-submit` | POST | ❌ | Submit sick leave (eBolovanje) |
| `eotpremnica-submit` | POST | ✅ | Submit dispatch note (eOtpremnica). Supports both `dispatch_note_id` (new schema) and legacy `eotpremnica_id`. Updates `eotpremnica_status` and `eotpremnica_sent_at` on success. |
| `wms-slotting` | POST | ❌ | AI/local WMS bin slotting optimization (see Section 5.1 for details) |
| `track-invoice-view` | POST | ✅ | Track when customer views invoice |
| `parse-pausalni-pdf` | POST | ✅ | Parse flat-rate tax PDF |

---

## 6. Frontend Route Map

### 6.1 Public Routes

| Path | Component | Auth Required |
|------|-----------|:------------:|
| `/` | Redirect → `/login` | ❌ |
| `/login` | Login | ❌ |
| `/register` | Register | ❌ |
| `/reset-password` | ResetPassword | ❌ |

### 6.2 Super Admin Routes

All under `/super-admin/*` with `SuperAdminLayout`. Requires `isSuperAdmin = true`.

| Path | Component |
|------|-----------|
| `/super-admin/dashboard` | SuperAdminDashboard |
| `/super-admin/tenants` | TenantManagement |
| `/super-admin/modules` | ModuleManagement |
| `/super-admin/users` | UserManagement |
| `/super-admin/monitoring` | PlatformMonitoring |
| `/super-admin/integrations` | IntegrationSupport |
| `/super-admin/analytics` | SuperAdminAnalytics |

### 6.3 Tenant Routes

All under `/` with `TenantLayout`. Requires authenticated user with active tenant membership.

#### Dashboard & Profile
| Path | Module | Component |
|------|--------|-----------|
| `/dashboard` | dashboard | TenantDashboard |
| `/profile` | — | Profile |

#### Settings (25 routes)
| Path | Module | Component |
|------|--------|-----------|
| `/settings` | settings | TenantSettings |
| `/settings/users` | settings-users | TenantUsers |
| `/settings/audit-log` | settings-audit-log | AuditLog |
| `/settings/legal-entities` | settings | LegalEntities |
| `/settings/locations` | settings | Locations |
| `/settings/warehouses` | settings | Warehouses |
| `/settings/cost-centers` | settings | CostCenters |
| `/settings/bank-accounts` | settings | BankAccounts |
| `/settings/integrations` | settings-integrations | TenantIntegrations |
| `/settings/posting-rules` | settings-business-rules | PostingRules |
| `/settings/accounting-architecture` | settings | AccountingArchitecture |
| `/settings/business-rules` | settings-business-rules | BusinessRules |
| `/settings/legacy-import` | settings | LegacyImport |
| `/settings/payroll-parameters` | settings | PayrollParameters |
| `/settings/ai-audit-log` | settings | AiAuditLog |
| `/settings/partner-categories` | settings | CompanyCategoriesSettings |
| `/settings/opportunity-stages` | settings | OpportunityStagesSettings |
| `/settings/discount-rules` | settings-approvals | DiscountApprovalRules |
| `/settings/tax-rates` | settings-tax-rates | TaxRates |
| `/settings/events` | settings-events | EventMonitor |
| `/settings/approvals` | settings-approvals | ApprovalWorkflows |
| `/settings/pending-approvals` | settings-approvals | PendingApprovals |
| `/settings/currencies` | settings-currencies | Currencies |

#### Accounting (17 routes)
| Path | Module | Component |
|------|--------|-----------|
| `/accounting/chart-of-accounts` | accounting | ChartOfAccounts |
| `/accounting/journal` | accounting | JournalEntries |
| `/accounting/invoices` | accounting | Invoices |
| `/accounting/invoices/new` | accounting | InvoiceForm |
| `/accounting/invoices/:id` | accounting | InvoiceForm |
| `/accounting/fiscal-periods` | accounting | FiscalPeriods |
| `/accounting/ledger` | accounting | GeneralLedger |
| `/accounting/expenses` | accounting | Expenses |
| `/accounting/reports` | accounting | Reports |
| `/accounting/reports/trial-balance` | accounting | TrialBalance |
| `/accounting/reports/income-statement` | accounting | IncomeStatement |
| `/accounting/reports/balance-sheet` | accounting | BalanceSheet |
| `/accounting/reports/bilans-uspeha` | accounting | BilansUspeha |
| `/accounting/reports/bilans-stanja` | accounting | BilansStanja |
| `/accounting/reports/aging` | accounting | AgingReports |
| `/accounting/fixed-assets` | accounting | FixedAssets |
| `/accounting/deferrals` | accounting | Deferrals |
| `/accounting/loans` | accounting | Loans |
| `/accounting/bank-statements` | accounting | BankStatements |
| `/accounting/open-items` | accounting | OpenItems |
| `/accounting/pdv` | accounting | PdvPeriods |
| `/accounting/year-end` | accounting | YearEndClosing |
| `/accounting/fx-revaluation` | accounting | FxRevaluation |
| `/accounting/kompenzacija` | accounting | Kompenzacija |

#### CRM (10 routes)
| Path | Module | Component |
|------|--------|-----------|
| `/crm` | crm | CrmDashboard |
| `/crm/partners` | crm | Partners |
| `/crm/companies` | crm | Companies |
| `/crm/companies/:id` | crm | CompanyDetail |
| `/crm/contacts` | crm | Contacts |
| `/crm/contacts/:id` | crm | ContactDetail |
| `/crm/leads` | crm | Leads |
| `/crm/opportunities` | crm | Opportunities |
| `/crm/opportunities/:id` | crm | OpportunityDetail |
| `/crm/meetings` | crm | Meetings |
| `/crm/meetings/calendar` | crm | MeetingsCalendar |

#### Sales (5 routes)
| Path | Module | Component |
|------|--------|-----------|
| `/sales/quotes` | sales | Quotes |
| `/sales/sales-orders` | sales | SalesOrders |
| `/sales/sales-channels` | sales | SalesChannels |
| `/sales/salespeople` | sales | Salespeople |
| `/sales/sales-performance` | sales | SalesPerformance |
| `/sales/retail-prices` | sales | RetailPrices |

#### Purchasing (3 routes)
| Path | Module | Component |
|------|--------|-----------|
| `/purchasing/orders` | purchasing | PurchaseOrders |
| `/purchasing/goods-receipts` | purchasing | GoodsReceipts |
| `/purchasing/supplier-invoices` | purchasing | SupplierInvoices |

#### Inventory & WMS (17 routes)
| Path | Module | Component |
|------|--------|-----------|
| `/inventory/products` | inventory | Products |
| `/inventory/products/:id` | inventory | ProductDetail |
| `/inventory/stock` | inventory | InventoryStock |
| `/inventory/movements` | inventory | InventoryMovements |
| `/inventory/dispatch-notes` | inventory | Eotpremnica |
| `/inventory/dispatch-notes/:id` | inventory | **DispatchNoteDetail** *(new)* |
| `/inventory/cost-layers` | inventory | InventoryCostLayers |
| `/inventory/internal-orders` | inventory | InternalOrders |
| `/inventory/internal-transfers` | inventory | InternalTransfers |
| `/inventory/internal-receipts` | inventory | InternalGoodsReceipts |
| `/inventory/kalkulacija` | inventory | Kalkulacija |
| `/inventory/nivelacija` | inventory | Nivelacija |
| `/inventory/warehouses/:id` | inventory | WarehouseDetail |
| `/inventory/wms/dashboard` | inventory | WmsDashboard |
| `/inventory/wms/zones` | inventory | WmsZones |
| `/inventory/wms/bins/:id` | inventory | WmsBinDetail |
| `/inventory/wms/tasks` | inventory | WmsTasks |
| `/inventory/wms/receiving` | inventory | WmsReceiving |
| `/inventory/wms/picking` | inventory | WmsPicking |
| `/inventory/wms/cycle-counts` | inventory | WmsCycleCounts |
| `/inventory/wms/slotting` | inventory | WmsSlotting |

#### HR & Payroll (17 routes)
| Path | Module | Component |
|------|--------|-----------|
| `/hr/employees` | hr | Employees |
| `/hr/employees/:id` | hr | EmployeeDetail |
| `/hr/contracts` | hr | EmployeeContracts |
| `/hr/departments` | hr | Departments |
| `/hr/attendance` | hr | Attendance |
| `/hr/leave-requests` | hr | LeaveRequests |
| `/hr/payroll` | hr | Payroll |
| `/hr/work-logs` | hr | WorkLogs |
| `/hr/work-logs/bulk` | hr | WorkLogsBulkEntry |
| `/hr/work-logs/calendar` | hr | WorkLogsCalendar |
| `/hr/overtime` | hr | OvertimeHours |
| `/hr/night-work` | hr | NightWork |
| `/hr/annual-leave` | hr | AnnualLeaveBalances |
| `/hr/holidays` | hr | HolidaysPage |
| `/hr/deductions` | hr | Deductions |
| `/hr/allowances` | hr | Allowances |
| `/hr/external-workers` | hr | ExternalWorkers |
| `/hr/salaries` | hr | EmployeeSalaries |
| `/hr/insurance` | hr | InsuranceRecords |
| `/hr/position-templates` | hr | PositionTemplates |
| `/hr/reports` | hr | HrReports |
| `/hr/ebolovanje` | hr | EBolovanje |

#### Production (7 routes)
| Path | Module | Component |
|------|--------|-----------|
| `/production/bom` | production | BomTemplates |
| `/production/orders` | production | ProductionOrders |
| `/production/orders/:id` | production | ProductionOrderDetail |
| `/production/ai-planning` | production | AiPlanningDashboard |
| `/production/ai-planning/schedule` | production | AiPlanningSchedule |
| `/production/ai-planning/bottlenecks` | production | AiBottleneckPrediction |
| `/production/ai-planning/scenarios` | production | AiCapacitySimulation |
| `/production/ai-planning/calendar` | production | AiPlanningCalendar |

#### Documents (9 routes)
| Path | Module | Component |
|------|--------|-----------|
| `/documents` | documents | Documents |
| `/documents/:id` | documents | DocumentDetail |
| `/documents/archive-book` | documents | ArchiveBook |
| `/documents/archiving` | documents | Archiving |
| `/documents/projects` | documents | DmsProjects |
| `/documents/projects/:id` | documents | DmsProjectDetail |
| `/documents/browser` | documents | DocumentBrowser |
| `/documents/reports` | documents | DmsReports |
| `/documents/settings` | documents | DmsSettings |

#### POS (4 routes)
| Path | Module | Component |
|------|--------|-----------|
| `/pos/terminal` | pos | PosTerminal |
| `/pos/sessions` | pos | PosSessions |
| `/pos/fiscal-devices` | pos | FiscalDevices |
| `/pos/daily-report` | pos | PosDailyReport |

#### Web Channel (2 routes)
| Path | Module | Component |
|------|--------|-----------|
| `/web/settings` | web | WebSettings |
| `/web/prices` | web | WebPrices |

#### Analytics (13 routes)
| Path | Module | Component |
|------|--------|-----------|
| `/analytics` | analytics | AnalyticsDashboard |
| `/analytics/ratios` | analytics | FinancialRatios |
| `/analytics/profitability` | analytics | ProfitabilityAnalysis |
| `/analytics/cashflow-forecast` | analytics | CashFlowForecast |
| `/analytics/budget` | analytics | BudgetVsActuals |
| `/analytics/break-even` | analytics | BreakEvenAnalysis |
| `/analytics/planning` | analytics | BusinessPlanning |
| `/analytics/working-capital` | analytics | WorkingCapitalStress |
| `/analytics/customer-risk` | analytics | CustomerRiskScoring |
| `/analytics/supplier-risk` | analytics | SupplierDependency |
| `/analytics/margin-bridge` | analytics | MarginBridge |
| `/analytics/payroll-benchmark` | analytics | PayrollBenchmark |
| `/analytics/vat-trap` | analytics | VatCashTrap |
| `/analytics/inventory-health` | analytics | InventoryHealth |
| `/analytics/early-warning` | analytics | EarlyWarningSystem |

#### AI Intelligence Hub
| Path | Module | Component |
|------|--------|-----------|
| `/ai/briefing` | analytics | **AiBriefing** *(new)* — Brzi AI Izveštaj / Quick AI Report with date range presets (Today, 7d, 30d, 90d, Custom) |

#### Other
| Path | Module | Component |
|------|--------|-----------|
| `/returns` | returns | Returns |

**Total: ~155+ routes**

---

## 7. State Management

### 7.1 Context Providers

| Provider | File | State | Purpose |
|----------|------|-------|---------|
| `AuthProvider` | `src/hooks/useAuth.tsx` | user, session, roles, isSuperAdmin, loading | Supabase auth state + role lookups |
| `TenantProvider` | `src/hooks/useTenant.ts` | tenantId, role, tenants, isLoading, switchTenant() | Active tenant management, persisted in localStorage |
| `LanguageProvider` | `src/i18n/LanguageContext.tsx` | language (en/sr), t() translation function | Bilingual UI (English/Serbian) |

### 7.2 TanStack Query Patterns

All data fetching uses TanStack Query with consistent patterns:

```typescript
// Query key convention: [entity, tenantId, ...filters]
const { data } = useQuery({
  queryKey: ["invoices", tenantId, status],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", status);
    if (error) throw error;
    return data;
  },
  enabled: !!tenantId,
});

// Invalidation after mutation
const mutation = useMutation({
  mutationFn: async (values) => { /* insert/update */ },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["invoices", tenantId] });
    toast({ title: "Success" });
  },
});
```

### 7.3 Custom Hooks Inventory

| Hook | File | Purpose |
|------|------|---------|
| `useAuth()` | `src/hooks/useAuth.tsx` | Access auth context (user, session, roles, signOut) |
| `useTenant()` | `src/hooks/useTenant.ts` | Access tenant context (tenantId, role, switchTenant) |
| `usePermissions()` | `src/hooks/usePermissions.ts` | Check module access: `canAccess(module)`, combines role permissions + tenant_modules |
| `useMobile()` | `src/hooks/use-mobile.tsx` | Responsive breakpoint detection |
| `useToast()` | `src/hooks/use-toast.ts` | Toast notification system |
| `useAiStream()` | `src/hooks/useAiStream.ts` | Streaming AI responses from edge functions |
| `useApprovalCheck()` | `src/hooks/useApprovalCheck.ts` | Check if entity needs approval |
| `useDiscountApproval()` | `src/hooks/useDiscountApproval.ts` | Quote discount approval workflow |
| `useLegalEntities()` | `src/hooks/useLegalEntities.ts` | Fetch legal entities for current tenant |
| `useNotifications()` | `src/hooks/useNotifications.ts` | Real-time notification management |
| `useOpportunityStages()` | `src/hooks/useOpportunityStages.ts` | Custom opportunity stage configuration |
| `useStatusWorkflow()` | `src/hooks/useStatusWorkflow.ts` | **Reusable status mutation hook** — encapsulates draft→confirmed→in_transit→delivered pattern. Accepts `{ table, queryKey }`, returns a mutation. Eliminates ~20 lines of boilerplate per page. |

---

## 8. Feature Deep-Dives

### 8.1 Accounting Module

#### Journal Entry Lifecycle

```
    ┌─────────┐     post()      ┌─────────┐    storno()    ┌──────────┐
    │  DRAFT  │ ──────────────► │ POSTED  │ ─────────────► │ REVERSED │
    └─────────┘                 └─────────┘                └──────────┘
         │                           │                          │
    Can edit lines            Immutable (trigger)         Storno entry
    Can delete                Creates fiscal period       created as
                              link automatically          'posted' with
                                                          swapped D/C
```

**Key constraints enforced at database level:**
- `check_journal_balance` trigger: SUM(debit) must equal SUM(credit) ±0.01 when posting
- `protect_posted_journal_entry` trigger: Only allows status change to 'reversed'
- `protect_posted_journal_lines` trigger: Blocks any line changes on posted entries
- `check_fiscal_period_open()`: Validates both fiscal period AND PDV period are open

#### Invoice Posting Flow

```
Invoice Created (status: draft)
    │
    ▼ User clicks "Post"
process_invoice_post(invoice_id, warehouse_id)
    │
    ├─► check_fiscal_period_open() → validates period
    ├─► Create journal_entry (status: posted)
    │     D: 2040 (AR) = invoice.total
    │     C: 6000 (Revenue) = invoice.subtotal
    │     C: 4700 (Output VAT) = invoice.tax_amount
    │
    ├─► If warehouse provided:
    │     For each product line:
    │       - Deduct inventory_stock
    │       - Create inventory_movement (type: sale)
    │       - Accumulate COGS
    │     D: 5000 (COGS) = total_cost
    │     C: 1320 (Inventory) = total_cost
    │
    └─► Update invoice.journal_entry_id = new JE
```

#### Year-End Closing

```
perform_year_end_closing(tenant_id, year)
    │
    ├─► Close all revenue accounts (code starting with 6,7):
    │     D: Revenue accounts → C: 3000 Retained Earnings
    │
    ├─► Close all expense accounts (code starting with 5,8):
    │     D: 3000 Retained Earnings → C: Expense accounts
    │
    ├─► Net effect: Profit/Loss posted to account 3000
    │
    └─► Lock fiscal period (status → 'locked')
```

#### PDV (VAT) Period Management

- POPDV sections implemented: 3, 3a, 4, 5, 6, 8a, 8b, 8v, 9, 10, 11
- Each invoice/supplier_invoice posting creates `pdv_entries` linked to the relevant PDV period
- Period status flow: `draft` → `submitted` → `closed`
- Submitted/closed PDV periods block any journal posting within their date range

### 8.2 CRM Module

#### Partner Tier System

```
calculate_partner_tiers(tenant_id)
    │
    ├─► Calculate trailing 12-month revenue per partner
    │   (SUM of invoices with status: sent/paid/posted/overdue)
    │
    ├─► Rank by PERCENT_RANK():
    │     Top 20% → Tier A
    │     20-50%  → Tier B
    │     50-80%  → Tier C
    │     Bottom / $0 revenue → Tier D
    │
    └─► Update partners.account_tier, tier_revenue_12m, tier_updated_at
```

#### Dormancy Detection

```
detect_partner_dormancy(tenant_id)
    │
    ├─► For each active partner:
    │     Find MAX(invoice_date) from invoices
    │     Calculate days_since_last_invoice
    │
    ├─► Tier-specific thresholds:
    │     Tier A: at_risk=60d,  dormant=120d
    │     Tier B: at_risk=90d,  dormant=180d
    │     Tier C/D: at_risk=120d, dormant=240d
    │
    ├─► On status change to at_risk/dormant:
    │     Create crm_task (task_type: dormancy_alert)
    │     Set priority: high (dormant) / medium (at_risk)
    │
    └─► Update partners.dormancy_status, dormancy_detected_at
```

#### Quote Versioning & Expiry

- Each quote edit creates a `quote_versions` record with full JSONB snapshot
- `current_version` counter increments on each save
- `valid_until` date enables automatic expiry via `expire_overdue_quotes()` RPC
- CRM dashboard shows "Expiring Quotes" widget (quotes expiring within 3 days)

#### Discount Approval Workflow

```
User creates/edits quote with discount > threshold
    │
    ▼
useDiscountApproval() checks:
  1. approval_workflows WHERE entity_type = 'quote_discount' AND is_active
  2. If discount_percent > threshold_amount → approval required
    │
    ▼
approval_request created (status: pending)
    │
    ▼
Users with required_roles see in PendingApprovals page
    │
    ▼
On approval: approval_steps count >= min_approvers → status: approved
    │
    ▼
Quote "Send" button unblocked → DiscountApprovalBadge shows status
```

### 8.3 Inventory Module

#### Stock Adjustment

```
adjust_inventory_stock(tenant_id, product_id, warehouse_id, quantity, movement_type)
    │
    ├─► INSERT inventory_movements (records the change)
    │
    └─► UPSERT inventory_stock:
          ON CONFLICT (product_id, warehouse_id)
          SET quantity_on_hand = quantity_on_hand + quantity
```

#### Internal Transfer Flow

```
Draft ──► confirm_internal_transfer() ──► In Transit ──► confirm_internal_receipt() ──► Delivered
  │                │                           │                    │
  │           Deduct from source           Package moving      Add to destination
  │           warehouse stock              between sites       warehouse stock
  │           Create 'out' movements                           Create 'in' movements
```

#### Kalkulacija (Retail Pricing)

Serbian retail accounting requires tracking inventory at full retail price (including VAT):

```
post_kalkulacija(kalkulacija_id)
    │
    ├─► Calculate totals:
    │     total_cost = SUM(purchase_price × quantity)
    │     total_retail = SUM(retail_price × quantity)
    │     total_embedded_vat = retail × tax_rate / (100 + tax_rate)
    │     total_margin = total_retail - total_embedded_vat - total_cost
    │
    └─► Create journal entry:
          D: 1320 (Roba u maloprodaji) = total_retail
          C: 1300 (Roba - nabavna cena) = total_cost
          C: 1329 (Razlika u ceni) = total_margin
          C: 1340 (Ukalkulisani PDV) = total_embedded_vat
```

#### WMS (Warehouse Management System)

- **Zones**: Warehouse areas (receiving, storage, picking, staging)
- **Bins**: Individual storage locations within zones (code, max_weight, current_product)
- **Tasks**: Pick/put/count operations with status tracking
- **Slotting**: AI-optimized bin assignment via `wms-slotting` edge function
- **Cycle Counts**: Scheduled inventory counts by zone/warehouse
- **Receiving**: Inbound processing workflow
- **Picking**: Order fulfillment workflow

### 8.4 HR & Payroll Module

#### Serbian Payroll Calculation

```
calculate_payroll_for_run(payroll_run_id)
    │
    ├─► Load payroll_parameters (effective for period):
    │     tax_rate: 10%, nontaxable: 28,423 RSD
    │     PIO employee: 14%, PIO employer: 11%
    │     Health employee: 5.15%, Health employer: 5.15%
    │     Unemployment: 0.75%
    │     Min base: 45,950 × (hours/40), Max base: 656,425 × (hours/40)
    │
    ├─► For each active employee with contract:
    │     gross = contract.gross_salary
    │     + overtime (hours × hourly_rate × 1.26)
    │     + night_work (hours × hourly_rate × 0.26)
    │     - unpaid_leave (days × daily_rate)
    │
    │     contribution_base = CLAMP(gross, min_base, max_base)
    │     pio_employee = base × 14%
    │     health_employee = base × 5.15%
    │     unemployment = base × 0.75%
    │
    │     taxable_base = MAX(gross - 28,423, 0)
    │     income_tax = taxable_base × 10%
    │
    │     net = gross - pio_employee - health_employee - unemployment - income_tax
    │
    │     pio_employer = base × 11%
    │     health_employer = base × 5.15%
    │     total_cost = gross + pio_employer + health_employer
    │
    └─► Update payroll_run totals
```

### 8.5 POS Module

#### Transaction Processing

```
POS Terminal: Customer pays
    │
    ▼ process_pos_sale(transaction_id, tenant_id)
    │
    ├─► Determine payment account:
    │     cash → 2430, card → 2431
    │
    ├─► Create journal entry (posted):
    │     D: 2430/2431 (Cash/Bank) = total
    │     C: 6010 (Retail Revenue) = subtotal
    │     C: 2470 (Output VAT) = tax_amount
    │
    ├─► If warehouse set + retail accounting:
    │     For each product in items JSONB:
    │       - Deduct inventory_stock
    │       - Create inventory_movement
    │       - Calculate COGS from purchase_price
    │     D: 5010 (COGS) = cogs
    │     D: 1329 (Reverse markup) = margin
    │     D: 1340 (Release embedded VAT) = embedded_vat
    │     C: 1320 (Retail inventory out) = retail_total
    │
    └─► Fiscal receipt creation → fiscalize-receipt edge function
```

### 8.6 SEF (E-Invoice) Integration

```
Invoice → "Submit to SEF"
    │
    ▼ sef-submit edge function
    │
    ├─► Build UBL 2.1 XML:
    │     - Invoice metadata (number, date, due_date)
    │     - Supplier info (PIB, name, address)
    │     - Customer info (PIB, name, address)
    │     - Line items with tax categories
    │     - Tax totals by rate
    │
    ├─► POST to SEF API (tenant_settings.sef_api_url)
    │     Headers: Authorization: Bearer {sef_api_key}
    │
    ├─► Record submission in sef_submissions table
    │     (idempotent: checks for existing submission)
    │
    ├─► Update invoice.sef_status = 'submitted'
    │
    └─► Async polling via sef-poll-status
          Checks SEF for status changes
          Updates to 'accepted' or 'rejected'
```

### 8.7 Production Module

#### Production Order Flow

```
BOM Template (materials list)
    │
    ▼ Create Production Order
    │   product_id, bom_template_id, planned_quantity
    │
    ▼ Start Production (status: in_progress)
    │   Materials consumed from inventory
    │   D: 5000 (WIP) = material cost
    │   C: Inventory accounts
    │
    ▼ Complete Production (status: completed)
    │   Finished goods added to inventory
    │   D: 5100 (Finished Goods) = production cost
    │   C: 5000 (WIP) = production cost
    │
    ▼ AI Planning (production-ai-planning edge function)
        - Schedule optimization
        - Bottleneck prediction
        - Capacity simulation
```

### 8.8 DMS (Document Management)

#### Protocol Number Format: `XXX-YY/GGGG`
- XXX = Sequential number
- YY = Category code
- GGGG = Year

#### Document Lifecycle
```
Draft → Active → Archived
                    │
                    ▼ Archive Book Entry
                    │   entry_number, content_description
                    │   year_of_creation, retention_period
                    │
                    ▼ After retention period expires:
                    │   Archiving Request (status: pending)
                    │   → Approved by admin
                    │   → Executed (documents destroyed)
```

### 8.9 Dispatch Notes (e-Otpremnice) *(New in v2.0)*

#### Dispatch Note Lifecycle

```
┌─────────┐  confirm   ┌───────────┐  ship     ┌────────────┐  deliver  ┌───────────┐
│  DRAFT  │ ─────────► │ CONFIRMED │ ────────► │ IN_TRANSIT │ ────────► │ DELIVERED │
└─────────┘            └───────────┘           └────────────┘          └───────────┘
     │                      │                       │
Can edit lines         Locked for edit         Can create receipt
Can delete             Can submit to API       (prijemnica)
```

#### eOtpremnica API Submission

```
DispatchNoteDetail → "Submit to eOtpremnica" button
    │
    ▼ eotpremnica-submit edge function
    │
    ├─► Validates: sender/receiver info, PIB format, vehicle plate, lines
    │
    ├─► Builds payload (document, sender, receiver, lines with lot/serial)
    │
    ├─► Sandbox mode: immediate "accepted" response (simulated)
    │   Production mode: "submitted" → poll for acceptance
    │
    └─► Updates dispatch_notes: eotpremnica_status, eotpremnica_sent_at
```

#### Line Items Management
- Product picker from `products` table
- Fields: description, quantity, unit, weight, lot_number, serial_number
- Only editable when dispatch note status = `draft`

#### Receipt (Prijemnica) Workflow
- Created from Receipts tab when status ≥ `in_transit`
- Fields: receipt_number, receipt_date, received_by, warehouse_id, notes
- Links back to parent dispatch note via `dispatch_note_id`

#### Detail Page (`DispatchNoteDetail.tsx`)
- **Lines Tab**: CRUD for `dispatch_note_lines` (draft only)
- **Receipts Tab**: View/create `dispatch_receipts`
- Header: Status badges, transition buttons, API submit button

### 8.10 AI SQL Tool Calling & Multi-Tool Assistant *(Upgraded in v3.0)*

#### Architecture

The `ai-assistant` edge function implements a **multi-tool calling loop** with **true SSE streaming**, **dynamic schema context**, and **conversation persistence**:

```
User message → ai-assistant edge function
    │
    ├─► Dynamic Schema: Query information_schema.columns (cached 1hr in-memory)
    │   Builds full table/column context for ALL public schema tables
    │
    ├─► Build system prompt with dynamic schema + live tenant stats
    │
    ├─► Send to Gemini 3 Flash via Lovable AI Gateway
    │
    ├─► Tool-calling loop (up to 5 rounds, 7 tools available):
    │     │
    │     ├─► query_tenant_data: Execute read-only SQL against tenant data
    │     │     └─► validateSql(): block mutations, enforce SELECT, inject tenant_id
    │     │     └─► Execute via execute_readonly_query RPC (10s timeout)
    │     │     └─► Return results as tool response
    │     │
    │     ├─► analyze_trend: Compute MoM/YoY growth for a metric
    │     │     └─► Queries time-series data from DB
    │     │     └─► Calculates growth rates, averages, trend direction
    │     │     └─► Returns structured trend analysis
    │     │
    │     ├─► create_reminder: Create notification for the user
    │     │     └─► Inserts into notifications table
    │     │     └─► Sets due date, link, priority from AI parameters
    │     │
    │     ├─► compare_periods: Compare two date periods side-by-side
    │     │     └─► Queries revenue, expenses, margins for both periods
    │     │     └─► Returns delta and percentage change
    │     │
    │     ├─► what_if_scenario: Run hypothetical business scenario
    │     │     └─► Adjusts parameters (e.g. price, volume) and recalculates
    │     │     └─► Returns projected outcomes
    │     │
    │     ├─► get_kpi_scorecard: Retrieve key performance indicators
    │     │     └─► Aggregates KPIs across modules (revenue, cash, headcount)
    │     │     └─► Returns structured scorecard data
    │     │
    │     ├─► explain_account: Explain a chart of accounts entry
    │     │     └─► Looks up account by code, shows balance and recent entries
    │     │     └─► Returns educational explanation in context
    │     │
    │     └─► AI may chain multiple tool calls across rounds
    │
    ├─► Final AI response streamed as TRUE SSE (token-by-token via ReadableStream)
    │
    └─► Audit: Each tool call logged to ai_action_log (action_type, module, model_version)
```

#### SQL Validation Rules
- **SELECT only**: Blocks INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, EXECUTE
- **Tenant scoping**: All queries must include `WHERE tenant_id = '{TENANT_ID}'`
- **Row limit**: Automatic `LIMIT 50` if not specified
- **Placeholder replacement**: `'{TENANT_ID}'` → actual tenant UUID

#### `execute_readonly_query` RPC
- PostgreSQL function callable via `supabase.rpc()`
- Service role only (not accessible to anon key)
- SELECT-only enforcement at DB level
- 10-second statement timeout for safety

#### Conversation Persistence
- Conversations stored in `ai_conversations` table (id, tenant_id, user_id, title, messages JSONB)
- Auto-generated title from first user message (truncated to 50 chars)
- Frontend loads conversation history in sidebar, supports "New Chat" button
- Messages persisted after each exchange via `useAiStream` hook

### 8.11 AI Anomaly Detection & Enrichment *(Upgraded in v3.0)*

The `ai-insights` edge function performs **hybrid rules + AI enrichment**:

#### Phase 1: Rule-Based Detection (7 anomaly checks)

| Check | Severity | Condition | Module Filter |
|-------|----------|-----------|---------------|
| **Expense Spike** | critical | Month-over-month expense increase > 50% | analytics, accounting |
| **Duplicate Supplier Invoices** | critical | Same supplier + same amount within 3 days | analytics, accounting |
| **Weekend Postings** | warning | ≥ 5 journal entries posted on Saturday/Sunday | analytics, accounting |
| **Dormant Partners** | warning | Partners with `dormancy_status = 'dormant'` | crm |
| **At-Risk Partners** | warning | Partners with `dormancy_status = 'at_risk'` | crm |
| **Slow-Moving Inventory** | info | Items with stock but no outbound movement in 90+ days | inventory |
| **Fiscal Period Warning** | warning | Open fiscal periods older than current month | accounting |

#### Phase 2: AI Enrichment (Gemini)

After collecting rule-based insights, the top 10 are sent to Gemini for:
- **Prioritization** by business impact
- **Cross-module correlation** (e.g. "overdue invoices + low stock = supply chain risk")
- **2-3 strategic recommendations** connecting multiple signals
- **Executive summary** (1-sentence overview)

All insights are cached in `ai_insights_cache` with TTL-based expiration. Results are bilingual (EN/SR). Each enrichment call logged to `ai_action_log`.

### 8.12 AI Analytics Narrative with Tool-Calling & Caching *(New in v3.0)*

The `ai-analytics-narrative` edge function generates contextual narratives for analytics dashboards:

```
Analytics page sends KPI data → ai-analytics-narrative
    │
    ├─► Check ai_narrative_cache (tenant_id + context_type, 30min TTL)
    │     └─► If cached & not expired → return cached result
    │
    ├─► Build system prompt with page KPI data + context_type
    │
    ├─► Tool-calling loop (up to 3 rounds):
    │     └─► query_tenant_data: Drill into specific accounts, compare periods,
    │         look up partner/product names for richer narrative
    │
    ├─► AI generates narrative + recommendations[]
    │
    ├─► Cache result in ai_narrative_cache (30min expiry)
    │
    └─► Audit log entry (action_type: "narrative_generation", module: context_type)
```

**Supported context types:** dashboard, ratios, cashflow, planning, budget, breakeven, profitability, expenses, working_capital, customer_risk, supplier_risk, margin_bridge, payroll_benchmark, vat_trap, inventory_health, early_warning, **production**, **crm_pipeline**, **hr_overview**, **pos_performance**, **purchasing**

### 8.13 AI Audit Trail *(New in v3.0)*

All 5 AI edge functions write to the `ai_action_log` table for full traceability:

| Function | action_type | module | What's Logged |
|----------|-------------|--------|---------------|
| `ai-assistant` | `sql_query`, `trend_analysis`, `reminder_created` | auto-detected from query | Each tool call with input/output |
| `ai-insights` | `insight_generation` | detected from insights | AI enrichment call with rule-based input + AI output |
| `ai-analytics-narrative` | `narrative_generation` | context_type | Narrative generation with KPI input summary |
| `production-ai-planning` | `schedule_generation`, `bottleneck_prediction`, `capacity_simulation` | production | Each planning action with parameters + results |
| `wms-slotting` | `slotting_optimization` | wms | Optimization run with weights, bin count, move count |

**Schema:** `ai_action_log` — `id`, `tenant_id`, `user_id`, `action_type`, `module`, `model_version`, `input_data` (JSONB), `ai_output` (JSONB), `confidence_score`, `reasoning`, `user_decision`, `created_at`

### 8.14 Production AI Planning *(Upgraded in v3.0)*

The `production-ai-planning` edge function supports 6 actions:

| Action | Purpose | Key Features |
|--------|---------|-------------|
| `generate-schedule` | AI-optimized production schedule | Locked/excluded order filtering, post-AI date validation |
| `predict-bottlenecks` | Identify capacity constraints | Local material pre-check (BOM vs inventory) |
| `simulate-scenario` | What-if capacity analysis | DB-backed scenario persistence |
| `local-fallback-schedule` | Deterministic scheduling | No AI call, priority-based FCFS algorithm |
| `save-scenario` | Persist scenario results | Saves to `production_scenarios` table |
| `list-scenarios` | Retrieve saved scenarios | Returns all scenarios for comparison |

**Frontend components:**
- `AiPlanningSchedule.tsx`: AI/Local toggle, order exclusion, Gantt legend, batch apply
- `AiCapacitySimulation.tsx`: DB-backed scenario persistence, side-by-side comparison view
- `AiBottleneckPrediction.tsx`: Local material pre-check (BOM vs inventory), AI enrichment
- `ProductionOrders.tsx`: Priority field (1-5) in create/edit dialogs

### 8.15 AI Executive Briefing — Brzi AI Izveštaj *(New in v3.1)*

The `ai-executive-briefing` edge function provides a **role-based AI briefing** with **date range filtering**:

- Accepts `date_from` and `date_to` parameters (defaults to last 30 days)
- Queries KPIs: invoices (revenue, overdue), POS transactions, production orders, leave requests — all filtered by the selected period
- Sends aggregated data to Gemini AI for executive summary generation
- Frontend (`AiBriefing.tsx`) provides preset buttons: Danas (Today), 7 dana, 30 dana, 90 dana, Prilagodi (Custom range with DateInput)
- Auto-refetches when date range changes

### 8.16 HR Clickable Employee Links *(New in v3.1)*

Employee names across 10+ HR pages (Attendance, Work Logs, Overtime, Night Work, Leave Requests, Payroll, Deductions, Allowances, Annual Leave, Contracts) are now clickable `<Link>` components navigating to `/hr/employees/:id`. EmployeeDetail page FK hint fix ensures proper data loading.

### 8.17 WMS AI Slotting *(Upgraded in v3.0)*

The `wms-slotting` edge function provides dual-mode warehouse slot optimization:

| Feature | Status | Details |
|---------|--------|---------|
| **Bin capacity validation** | ✅ Implemented | Both AI and local modes validate against `max_units` before saving |
| **SQL-filtered data** | ✅ Implemented | `accessibility_score > 0`, top 100 bins, 5000 pick history limit |
| **Batch task generation** | ✅ Implemented | Single bulk INSERT replaces sequential per-move inserts |
| **Scenario comparison** | ✅ Implemented | Side-by-side KPI diff (travel reduction %, move count, zones affected) |
| **Audit logging** | ✅ Implemented | Each optimization run logged to `ai_action_log` |

---

## 9. Integration Points

### 9.1 SEF (Sistem E-Faktura)

Serbian mandatory e-invoicing system for B2G and B2B transactions.

| Aspect | Detail |
|--------|--------|
| **Format** | UBL 2.1 XML |
| **Authentication** | API key per tenant (stored in tenant_settings) |
| **Operations** | Submit, poll status, fetch sales/purchase invoices, accept/reject, cancel |
| **Edge Functions** | 15+ functions (see Section 5.2) |
| **Status Flow** | not_submitted → submitted → accepted/rejected |

### 9.2 NBS Exchange Rates

National Bank of Serbia daily exchange rates.

| Aspect | Detail |
|--------|--------|
| **Edge Function** | `nbs-exchange-rates` |
| **Frequency** | Daily (manual or scheduled) |
| **Storage** | `fx_rates` table (currency_code, rate_date, rate) |
| **Usage** | FX revaluation, multi-currency invoices |

### 9.3 APR Lookup

Serbian Agency for Business Registers (Agencija za privredne registre).

| Aspect | Detail |
|--------|--------|
| **Edge Functions** | `company-lookup`, `apr-lookup` |
| **Input** | PIB (tax ID) or Maticni Broj (registration number) |
| **Returns** | Company name, address, activity code, status |
| **Usage** | Auto-fill when creating partners/companies |

### 9.4 Fiscal Devices

Serbian tax authority requires fiscal receipt printing.

| Aspect | Detail |
|--------|--------|
| **Edge Functions** | `fiscalize-receipt`, `fiscalize-retry-offline` |
| **Config** | `fiscal_devices` table (api_url, PAC, tax_label_map) |
| **Flow** | POS sale → fiscal receipt → send to device → store receipt number |
| **Offline** | Retry mechanism for failed fiscalizations |

### 9.5 Email (Resend/SMTP)

| Aspect | Detail |
|--------|--------|
| **Provider** | Resend (or configurable SMTP) |
| **Functions** | `send-invoice-email`, `send-notification-emails`, `send-verification-email`, `send-admin-bulk-email` |
| **Templates** | Invoice PDF attachment, notification digests, verification links |

### 9.6 Push Notifications (VAPID/Web Push)

| Aspect | Detail |
|--------|--------|
| **Edge Function** | `get-vapid-public-key` |
| **Secret** | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| **Frontend** | Service Worker (`public/sw.js`) |
| **Storage** | `push_subscriptions` table |

### 9.7 Web Channel

| Aspect | Detail |
|--------|--------|
| **Edge Functions** | `web-sync`, `web-order-import` |
| **Purpose** | Sync product catalog/prices to external web store, import web orders |
| **Config** | `web_settings` table per tenant |

---

## 10. Security Architecture

### 10.1 Defense Layers

```
Layer 1: Supabase Auth (JWT)
    ├─► Email/password authentication
    ├─► JWT token with user_id claim
    └─► Session management (refresh tokens)

Layer 2: Row-Level Security (RLS)
    ├─► Every table: WHERE tenant_id IN get_user_tenant_ids(auth.uid())
    ├─► Super admin bypass in some policies
    └─► No direct table access without RLS

Layer 3: SECURITY DEFINER Functions
    ├─► assert_tenant_member(p_tenant_id) — validates caller membership
    ├─► auth.uid() used internally — ignores passed user_id params
    └─► Critical operations: year-end closing, journal posting, payroll

Layer 4: Frontend Permission Checks
    ├─► ProtectedRoute component with requiredModule prop
    ├─► usePermissions() hook checks role + tenant_modules
    └─► UI elements hidden for unauthorized users

Layer 5: Edge Function Security
    ├─► JWT verification (configurable per function in config.toml)
    ├─► Tenant membership validation in function body
    └─► Service role key only used server-side
```

### 10.2 Role Hierarchy

| Role | Scope | Capabilities |
|------|-------|-------------|
| `super_admin` | Platform-wide | All tenants, all modules, tenant CRUD, user management |
| `admin` | Single tenant | All modules within tenant, user management, settings |
| `manager` | Single tenant | CRM, sales, purchasing, inventory, production, POS, analytics |
| `accountant` | Single tenant | Accounting, analytics, tax rates, currencies |
| `sales` | Single tenant | CRM, sales, web, inventory, documents |
| `hr` | Single tenant | HR module, documents |
| `store` | Single tenant | CRM, sales, inventory, POS, returns |
| `user` | Single tenant | Dashboard, documents, POS (limited) |

### 10.3 JWT Verification Config

Functions with `verify_jwt = false` in `supabase/config.toml` handle their own auth or are called from other edge functions. Functions not listed in config.toml default to `verify_jwt = true`.

**Functions with JWT disabled (verify_jwt = false):**
- AI functions (ai-assistant, ai-insights, ai-analytics-narrative)
- SEF functions (sef-submit, sef-poll-status)
- Fiscal functions (fiscalize-receipt, fiscalize-retry-offline)
- Admin functions (create-tenant, admin-create-user)
- Import functions (import-legacy-*)
- Seed functions (seed-demo-data-*)
- Event processing (process-module-event, create-notification)
- Web channel (web-sync, web-order-import)
- Utility (generate-pdf, company-lookup, nbs-exchange-rates)

---

## 11. Event System

### 11.1 Module Event Bus

```
Source Module (e.g., Purchasing)
    │
    ▼ emit_module_event(tenant_id, event_type, source_module, entity_type, entity_id, payload)
    │
    ├─► INSERT into module_events table
    │
    └─► pg_notify('module_event', {event_id, event_type})
           │
           ▼
    process-module-event edge function
           │
           ├─► Route event to handlers
           ├─► Create notifications
           ├─► Trigger cross-module actions
           └─► Update event status (processed/failed/retrying)
```

### 11.2 Event Types

| Event Type | Source | Triggers |
|-----------|--------|----------|
| `purchase_order.confirmed` | purchasing | Notification to warehouse team |
| `goods_receipt.completed` | purchasing | Stock adjustment, supplier invoice prompt |
| `supplier_invoice.approved` | purchasing | Journal entry creation |
| `invoice.posted` | accounting | PDV entry creation, SEF submission |
| `invoice.paid` | accounting | AR clearing, partner tier update |
| `production_order.completed` | production | Inventory adjustment (WIP → Finished) |
| `quote.expired` | sales | CRM task creation, notification |

### 11.3 Notification Flow

```
Module Event or Direct Trigger
    │
    ▼ create-notification edge function
    │
    ├─► INSERT into notifications table
    │     (user_id, title, message, link, is_read)
    │
    ├─► Attempt push notification
    │     (if user has push_subscription)
    │
    └─► Frontend: useNotifications() hook
          - Real-time polling/subscription
          - NotificationBell + NotificationDropdown
          - NotificationPreferences page
```

---

## 12. Postman Collection Structure

### 12.1 Environment Variables

```json
{
  "SUPABASE_URL": "https://hfvoehsrsimvgyyxirwj.supabase.co",
  "ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "AUTH_TOKEN": "{{login_response.access_token}}",
  "TENANT_ID": "{{your_tenant_id}}",
  "FUNCTIONS_URL": "{{SUPABASE_URL}}/functions/v1"
}
```

### 12.2 Authentication

```
POST {{SUPABASE_URL}}/auth/v1/token?grant_type=password
Headers:
  apikey: {{ANON_KEY}}
  Content-Type: application/json
Body:
{
  "email": "user@example.com",
  "password": "password123"
}
→ Save access_token as AUTH_TOKEN
```

### 12.3 Endpoint Collection

#### AI
```
POST {{FUNCTIONS_URL}}/ai-assistant
Headers: Authorization: Bearer {{AUTH_TOKEN}}, apikey: {{ANON_KEY}}
Body: { "messages": [...], "tenantId": "{{TENANT_ID}}", "module": "accounting" }

POST {{FUNCTIONS_URL}}/ai-insights
Body: { "tenantId": "{{TENANT_ID}}", "module": "crm", "type": "summary" }

POST {{FUNCTIONS_URL}}/ai-analytics-narrative
Body: { "tenantId": "{{TENANT_ID}}", "section": "revenue" }
```

#### SEF (E-Invoice)
```
POST {{FUNCTIONS_URL}}/sef-submit
Body: { "invoiceId": "uuid", "tenantId": "{{TENANT_ID}}" }

POST {{FUNCTIONS_URL}}/sef-poll-status
Body: { "submissionId": "uuid", "tenantId": "{{TENANT_ID}}" }

POST {{FUNCTIONS_URL}}/sef-fetch-sales-invoices
Body: { "tenantId": "{{TENANT_ID}}", "dateFrom": "2026-01-01", "dateTo": "2026-02-28" }
```

#### Fiscal
```
POST {{FUNCTIONS_URL}}/fiscalize-receipt
Body: { "transactionId": "uuid", "tenantId": "{{TENANT_ID}}", "deviceId": "uuid" }

POST {{FUNCTIONS_URL}}/fiscalize-retry-offline
Body: { "tenantId": "{{TENANT_ID}}" }
```

#### Admin
```
POST {{FUNCTIONS_URL}}/create-tenant
Body: { "name": "New Company", "slug": "new-company", "adminUserId": "uuid" }

POST {{FUNCTIONS_URL}}/admin-create-user
Body: { "email": "new@user.com", "fullName": "New User", "role": "sales", "tenantId": "{{TENANT_ID}}" }
```

#### Utilities
```
POST {{FUNCTIONS_URL}}/generate-pdf
Body: { "invoiceId": "uuid", "tenantId": "{{TENANT_ID}}" }

POST {{FUNCTIONS_URL}}/company-lookup
Body: { "pib": "123456789" }

POST {{FUNCTIONS_URL}}/nbs-exchange-rates
Body: { "date": "2026-02-23" }

POST {{FUNCTIONS_URL}}/validate-pib
Headers: Authorization: Bearer {{AUTH_TOKEN}}
Body: { "pib": "123456789" }
```

#### Storage
```
POST {{FUNCTIONS_URL}}/storage-upload
Headers: Authorization: Bearer {{AUTH_TOKEN}}
Body: FormData { file, tenantId, path }

POST {{FUNCTIONS_URL}}/storage-download
Headers: Authorization: Bearer {{AUTH_TOKEN}}
Body: { "path": "invoices/inv-001.pdf", "tenantId": "{{TENANT_ID}}" }
```

#### Web Channel
```
POST {{FUNCTIONS_URL}}/web-sync
Body: { "tenantId": "{{TENANT_ID}}", "action": "sync_products" }

POST {{FUNCTIONS_URL}}/web-order-import
Body: { "tenantId": "{{TENANT_ID}}", "orders": [...] }
```

#### Data Seeding (Dev Only)
```
POST {{FUNCTIONS_URL}}/seed-demo-data
Body: { "tenantId": "{{TENANT_ID}}" }

POST {{FUNCTIONS_URL}}/seed-demo-data-phase2
Body: { "tenantId": "{{TENANT_ID}}" }

POST {{FUNCTIONS_URL}}/seed-demo-data-phase3
Body: { "tenantId": "{{TENANT_ID}}" }
```

#### CRM
```
POST {{FUNCTIONS_URL}}/crm-tier-refresh
Body: { "tenantId": "{{TENANT_ID}}" }
```

#### HR
```
POST {{FUNCTIONS_URL}}/ebolovanje-submit
Body: { "tenantId": "{{TENANT_ID}}", "employeeId": "uuid", "startDate": "2026-02-01", "endDate": "2026-02-15" }
```

#### Production
```
POST {{FUNCTIONS_URL}}/production-ai-planning
Body: { "tenantId": "{{TENANT_ID}}", "action": "schedule", "orderId": "uuid" }
```

#### WMS
```
POST {{FUNCTIONS_URL}}/wms-slotting
Body: { "tenantId": "{{TENANT_ID}}", "warehouseId": "uuid" }
```

---

## Appendix A: Connection Dependency Graph

```
                              ┌──────────────┐
                              │   Tenants     │
                              └──────┬───────┘
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
             ┌────────────┐  ┌────────────┐  ┌──────────────┐
             │  Partners   │  │  Products  │  │ Chart of     │
             │  Companies  │  │            │  │ Accounts     │
             │  Contacts   │  │            │  │              │
             └──────┬──────┘  └─────┬──────┘  └──────┬───────┘
                    │               │                │
         ┌─────────┼─────────┐     │          ┌─────┼──────────┐
         ▼         ▼         ▼     ▼          ▼     ▼          ▼
    ┌─────────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌─────────┐ ┌─────────┐
    │ Invoices│ │Quotes│ │Leads │ │Inventory│ │ Journal │ │ Fiscal  │
    │         │ │      │ │      │ │ Stock   │ │ Entries │ │ Periods │
    └────┬────┘ └──┬───┘ └──┬───┘ └────┬───┘ └────┬────┘ └─────────┘
         │         │        │          │          │
         ▼         ▼        ▼          ▼          ▼
    ┌─────────┐ ┌──────────┐ ┌──────────┐  ┌──────────┐
    │ SEF     │ │Opportun- │ │ Purchase │  │ PDV      │
    │ Submit  │ │ ities    │ │ Orders   │  │ Periods  │
    └─────────┘ └──────────┘ └──────────┘  └──────────┘
```

---

## Appendix B: Export Instructions

This Markdown document can be converted to PDF or DOCX:

### Using Pandoc (recommended)
```bash
# PDF (requires LaTeX)
pandoc ARCHITECTURE_DOCUMENTATION.md -o ARCHITECTURE_DOCUMENTATION.pdf --toc --toc-depth=3

# DOCX
pandoc ARCHITECTURE_DOCUMENTATION.md -o ARCHITECTURE_DOCUMENTATION.docx --toc --toc-depth=3
```

### Using VS Code
1. Install "Markdown PDF" extension
2. Open this file → Ctrl+Shift+P → "Markdown PDF: Export (pdf)"

### Online Converters
- https://www.markdowntopdf.com/
- https://dillinger.io/ (Export As → PDF)

---

*Document generated: February 23, 2026*  
*System version: ProERP AI v3.1*  
*Total routes: ~155+ | Edge functions: 69+ | Database tables: 110+*
