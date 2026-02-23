

# Full Application Architecture Documentation

## What Will Be Created

A comprehensive Markdown document (`ARCHITECTURE_DOCUMENTATION.md`) at the project root that serves as a complete technical reference for the ERP-AI application. This is the most practical format since Lovable works with code files -- the document can be exported to PDF/DOCX using any Markdown converter (Pandoc, VS Code, etc.).

## Document Structure

The document will contain the following major sections:

### 1. Executive Summary
- Application purpose, target market (Serbian SMB/Enterprise)
- Tech stack overview
- Multi-tenant SaaS architecture summary

### 2. System Architecture
- High-level architecture (React SPA + Supabase BaaS)
- Provider hierarchy: QueryClient > LanguageProvider > AuthProvider > TenantProvider > Router
- Authentication flow (Supabase Auth > user_roles > tenant_members)
- Multi-tenancy model (tenant_id isolation via RLS)

### 3. Module Dependency Map
- All 12+ modules with their database tables, edge functions, hooks, and page components
- Cross-module dependencies (e.g., Invoices depend on Chart of Accounts, Fiscal Periods, Partners)
- Module permission matrix (which roles access which modules)

### 4. Database Schema Reference
- All major tables grouped by module with columns and relationships
- Foreign key dependency graph (textual)
- Key database functions and triggers (journal balance check, posted entry protection, stock adjustment, payroll calculation, POS sale processing, storno workflow, etc.)
- RLS strategy description

### 5. API / Edge Functions Reference
- All 63 edge functions documented with:
  - Endpoint path
  - HTTP method
  - JWT verification status (from config.toml)
  - Request/response format
  - Purpose and module association
- Grouped by category: AI, SEF, Email, Storage, Fiscal, Import, Admin, Web, Utilities

### 6. Frontend Route Map
- Complete list of 170+ routes
- Route protection (requiredModule, requireSuperAdmin)
- Layout hierarchy (SuperAdminLayout vs TenantLayout)

### 7. State Management
- TanStack Query patterns (query keys, invalidation)
- Context providers (Auth, Tenant, Language)
- Custom hooks inventory with their purpose

### 8. Feature Deep-Dives
For each major module:
- **Accounting**: Journal entry lifecycle (draft > posted > storno), fiscal period gating, PDV period blocking, invoice posting with auto-journal, year-end closing
- **CRM**: Partner tiers (A/B/C/D via revenue percentiles), dormancy detection, opportunity pipeline with "partially won" stage, quote versioning and expiry, discount approval workflow
- **Inventory**: Stock adjustment RPC, internal transfers (draft > in_transit > delivered), kalkulacija/nivelacija posting with retail accounting (1320/1329/1340), WMS zones/bins/tasks/slotting
- **HR/Payroll**: Serbian-compliant payroll calculation (PIO/health/unemployment contributions, min/max contribution base, overtime/night work/leave deductions)
- **POS**: Transaction processing with retail accounting entries, fiscal device integration
- **SEF**: Serbian e-invoicing (UBL 2.1 XML, idempotent submissions, async status polling)
- **Production**: BOM templates, production orders, AI planning (schedule, bottleneck, capacity simulation)
- **DMS**: Protocol number generation (XXX-YY/GGGG), access control, archive book, destruction workflow

### 9. Integration Points
- SEF (Serbian e-Invoice system) -- 15+ edge functions
- NBS Exchange Rates -- daily rate fetching
- APR Lookup -- company registry
- Fiscal devices -- receipt fiscalization
- Email (Resend/SMTP) -- invoice emails, notifications, verification
- Push notifications (VAPID/Web Push)
- Web channel (web-sync, web-order-import)

### 10. Security Architecture
- Supabase RLS with tenant_id filtering
- Role-based access control (7 roles: admin, manager, accountant, sales, hr, store, user)
- SECURITY DEFINER functions with assert_tenant_member
- auth.uid() enforcement (no user_id parameter trust)
- JWT verification configuration per edge function

### 11. Event System
- Module event bus (emit_module_event > pg_notify > process-module-event edge function)
- Event types and their handlers
- Notification system flow

### 12. Postman Collection Structure
- Documented endpoint list formatted for Postman import
- Environment variables (SUPABASE_URL, ANON_KEY, AUTH_TOKEN)
- Example requests for each edge function category

---

## Technical Details

### Files to Create
| File | Purpose |
|------|---------|
| `ARCHITECTURE_DOCUMENTATION.md` | Complete architecture reference (~2000+ lines) |

### No Files Modified
This is a documentation-only task. No existing code changes.

### Export Options
The Markdown file can be converted to PDF or DOCX using:
- `pandoc ARCHITECTURE_DOCUMENTATION.md -o architecture.pdf`
- VS Code "Markdown PDF" extension
- Any online Markdown-to-PDF converter

