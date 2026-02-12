

# Phase 6: Advanced Modules — Production, DMS, and POS

The final phase of the ERP-AI roadmap, adding three specialized modules.

---

## Module 1: Production / Manufacturing

Track bills of materials (BOMs), production orders, and material consumption.

**New Tables:**
- `bom_templates` — Bill of Materials templates (product_id, name, notes)
- `bom_lines` — BOM components (bom_template_id, material_product_id, quantity, unit)
- `production_orders` — Manufacturing orders (product_id, bom_template_id, quantity, status, planned_start/end, actual_start/end)
- `production_consumption` — Material usage log (production_order_id, product_id, warehouse_id, quantity_consumed)

**Statuses:** draft, planned, in_progress, completed, cancelled

**Sidebar:** New "Production" group with BOM Templates, Production Orders

**Pages:**
- `/production/bom` — Manage BOM templates with line items
- `/production/orders` — Create/track production orders, log material consumption

---

## Module 2: Document Management System (DMS)

Centralized document storage linked to any entity.

**New Tables:**
- `documents` — Metadata (tenant_id, name, file_path, file_type, file_size, entity_type, entity_id, uploaded_by, tags, notes)

**Infrastructure:**
- Create a Supabase Storage bucket `tenant-documents` with RLS
- Upload/download via Supabase Storage SDK

**Sidebar:** New "Documents" entry under a Documents group

**Pages:**
- `/documents` — Upload, browse, search, filter by entity type, download documents

---

## Module 3: Point of Sale (POS)

Simple POS interface for retail transactions.

**New Tables:**
- `pos_sessions` — Cashier sessions (tenant_id, opened_by, opened_at, closed_at, opening_balance, closing_balance, status)
- `pos_transactions` — Sales records (session_id, tenant_id, transaction_number, items jsonb, subtotal, tax_amount, total, payment_method, customer_name)

**Sidebar:** New "POS" group with POS Terminal, Sessions

**Pages:**
- `/pos/terminal` — Full-screen POS interface with product search, cart, payment processing
- `/pos/sessions` — Open/close sessions, view transaction history

---

## Technical Details

### Database Migration
Single migration creating all 7 tables with:
- RLS policies (tenant isolation via `get_user_tenant_ids`)
- `updated_at` triggers
- Audit triggers on key tables (production_orders, pos_transactions, documents)
- Storage bucket creation for DMS

### New Files to Create
| File | Purpose |
|------|---------|
| `src/pages/tenant/BomTemplates.tsx` | BOM template CRUD with line items |
| `src/pages/tenant/ProductionOrders.tsx` | Production order management |
| `src/pages/tenant/Documents.tsx` | Document upload/browse/download |
| `src/pages/tenant/PosTerminal.tsx` | POS selling interface |
| `src/pages/tenant/PosSessions.tsx` | POS session management |

### Files to Modify
| File | Changes |
|------|---------|
| `src/layouts/TenantLayout.tsx` | Add Production, Documents, POS sidebar groups |
| `src/App.tsx` | Add routes for all 5 new pages |
| `src/i18n/translations.ts` | Add EN/SR keys for all new entities, statuses, and labels |

### Sidebar Navigation Additions
- **Production**: BOM Templates (icon: Layers), Production Orders (icon: Factory)
- **Documents**: Documents (icon: FolderOpen)
- **POS**: POS Terminal (icon: Monitor), Sessions (icon: CreditCard)

### Key Patterns
- All pages follow existing CRUD dialog pattern (same as Opportunities, Quotes, etc.)
- POS Terminal uses a unique split layout: product grid on left, cart on right
- DMS integrates with Supabase Storage for file upload/download
- Production consumption auto-adjusts inventory via `adjust_inventory_stock` function

