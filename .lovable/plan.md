

# ERP-AI — Phase 1: Foundation Implementation Plan
## Authentication, Multi-Tenant Architecture, Super Admin & Tenant Admin Panels

---

## 1. Authentication & Login System
- Single login page at `/login` with email/password
- After login, the system detects the user's role:
  - **Super Admin** → redirected to `/super-admin/dashboard`
  - **Tenant Admin / Regular User** → redirected to `/dashboard` (tenant context)
- Registration page for new tenant signup (self-service or Super Admin–created)
- Language toggle on login page (English / Serbian Latin)
- Password reset flow

---

## 2. Database Foundation
### Core Tables
- **tenants** — organization record with plan, status (active/suspended/trial), settings (JSONB)
- **legal_entities** — PIB, matični broj, address, linked to tenant
- **locations** — offices, shops, warehouses per tenant
- **warehouses** — with optional zones, linked to locations
- **sales_channels** — Retail, Wholesale, Web, Marketplace
- **cost_centers** — for accounting allocation
- **bank_accounts** — per legal entity
- **profiles** — user profiles linked to auth.users
- **user_roles** — separate role table (super_admin, admin, manager, accountant, sales, hr, user)
- **tenant_members** — links users to tenants with membership status

### Module Access Control
- **tenant_modules** — which modules are enabled per tenant (controlled by Super Admin)
- **module_definitions** — master list of all available ERP modules

### Security
- RLS policies on all tables enforcing tenant isolation
- `has_role()` security definer function to prevent RLS recursion
- Super Admin bypasses tenant isolation (can see all tenants)

---

## 3. Super Admin Panel (`/super-admin/...`)
The platform owner's control center — this is the **SaaS sales & operations side**.

### 3.1 Dashboard
- Total tenants, active users, revenue metrics
- System health indicators
- Recent activity feed across all tenants
- Alert panel (expiring trials, integration errors)

### 3.2 Tenant Management
- **Tenant list** — searchable/filterable table of all organizations
- **Create new tenant** — onboarding wizard: company info → legal entity → plan selection → initial admin user → seed data (chart of accounts, etc.)
- **Edit tenant** — update plan, status, settings
- **Suspend/Activate tenant**
- **View tenant details** — users, usage stats, enabled modules

### 3.3 Module Management (Sales/Enablement)
- Toggle which modules each tenant can access (Accounting, Sales, HR, Inventory, CRM, POS, DMS, Production)
- Set module-level configurations per tenant
- Bulk enable/disable for plan-based presets (e.g., "Basic" = Accounting + Sales, "Enterprise" = all modules)

### 3.4 Integration Support
- View and help configure tenant API connections (SEF credentials, bank integrations)
- Manage global integration endpoints (mock government APIs)
- API key management for platform-level services

### 3.5 Platform Monitoring
- Active sessions, user counts per tenant
- Error logs and system events
- Usage statistics (API calls, storage, documents)

### 3.6 User Management (Platform-wide)
- View all users across tenants
- Impersonate/assist tenant users (for support)
- Manage Super Admin team members

---

## 4. Tenant Admin Panel (`/settings/...`)
Available to tenant admins within their organization's context.

### 4.1 Company Settings
- Edit legal entity details (name, PIB, matični broj, address)
- Manage locations and warehouses
- Configure sales channels
- Set up cost centers
- Manage bank accounts

### 4.2 User & Role Management
- Invite users to the tenant (email invitation)
- Assign roles (Admin, Manager, Accountant, Sales, HR, User)
- Set permissions per role
- Deactivate/remove users

### 4.3 API & Integration Configuration
- Configure tenant-specific API keys (within modules enabled by Super Admin)
- SEF credential setup (with help available from Super Admin)
- Bank integration settings
- Webhook/notification configuration

### 4.4 Business Rules & Policies
- Accounting policy settings (fiscal year, default accounts)
- Invoice numbering rules
- Payment terms defaults
- Notification preferences

### 4.5 Audit Log
- View actions within the tenant (who did what, when)
- Filter by user, action type, date range

---

## 5. Main App Layout & Navigation
- **Sidebar navigation** showing only modules enabled for the tenant
- **Top bar** with: tenant name, language switcher (EN/SR), user menu, notifications bell
- **AI Insights widget** on the dashboard — NLP query box + anomaly alerts
- **Breadcrumb navigation** for deep pages
- **Responsive design** — works on desktop and tablet

---

## 6. Dashboard (Tenant Users)
- KPI cards: Revenue, Expenses, Profit, Cash Balance (placeholder data initially)
- Revenue trend chart
- Cash flow summary
- AI Insights panel with smart alerts
- NLP query box ("Koliko smo fakturisali u januaru?")
- Pending actions/approvals list
- Quick action buttons for common tasks

---

## 7. Bilingual Support (English + Serbian Latin)
- i18n system with language context provider
- All UI labels, buttons, messages, and navigation in both languages
- Language toggle persisted per user preference
- Date/number formatting per locale (Serbian uses comma for decimals)

