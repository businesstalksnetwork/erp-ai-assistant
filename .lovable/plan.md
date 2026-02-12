

# Phase 6: Audit Log + User Management

These are the last two placeholder pages in the system. Both are essential for a production-grade multi-tenant ERP -- you need to know who did what (audit trail), and you need to manage team members and their permissions.

---

## Part 1: Audit Log

### Database

Create an `audit_logs` table to capture all important actions:
- id, tenant_id, user_id, action (e.g., "create", "update", "delete"), entity_type (e.g., "invoice", "journal_entry", "partner"), entity_id
- changes (JSONB -- stores old/new values for updates)
- ip_address (nullable), created_at
- RLS: members can view their tenant's logs, nobody can delete/update

Create a database trigger function `log_audit_event()` that automatically logs INSERT, UPDATE, DELETE on key tables:
- invoices, journal_entries, partners, products, inventory_movements, chart_of_accounts, fiscal_periods

### Frontend (`/settings/audit-log`)

- Chronological table of all audit events
- Filters: entity type, action type, user, date range
- Expandable row to show change details (old vs new values as JSON diff)
- Pagination (load more / infinite scroll)

---

## Part 2: User Management

### Database

Create a `tenant_invitations` table:
- id, tenant_id, email, role (admin / accountant / member), invited_by, status (pending / accepted / expired), created_at, expires_at

### Frontend (`/settings/users`)

- List current tenant members (query `tenant_members` joined with auth.users for email/name)
- Show each user's role from `user_roles`
- "Invite User" dialog: email + role selection
- Change role (admin can promote/demote)
- Remove user from tenant (with confirmation)
- Pending invitations list with resend/cancel options

### Invite Flow

Since Supabase auth handles user creation, the invite flow works as:
1. Admin enters email + role
2. System creates a `tenant_invitations` record
3. When user signs up/logs in with that email, a database trigger checks for pending invitations and auto-adds them to the tenant with the specified role
4. If user already exists in the system, they are immediately added

---

## Routes

No new routes needed -- both pages already have routes registered:
- `/settings/audit-log` -> AuditLog
- `/settings/users` -> TenantUsers

---

## Files

| Action | File | What |
|--------|------|------|
| Migration | New SQL migration | `audit_logs` table + RLS + trigger function on key tables; `tenant_invitations` table + RLS + auto-accept trigger |
| Rewrite | `src/pages/tenant/AuditLog.tsx` | Full audit log viewer with filters, expandable rows |
| Rewrite | `src/pages/tenant/Users.tsx` | Member list, invite dialog, role management |
| Modify | `src/i18n/translations.ts` | Add audit log and user management keys (EN + SR) |
| Modify | `src/integrations/supabase/types.ts` | Add new table types |

---

## Technical notes

- The audit trigger uses `TG_OP` to determine action type and `row_to_json(OLD)` / `row_to_json(NEW)` to capture changes
- The trigger runs as `SECURITY DEFINER` and uses `auth.uid()` to capture the acting user
- Audit logs are append-only -- RLS only allows SELECT, no UPDATE/DELETE
- `tenant_invitations` uses a check trigger: on auth user login/signup, if a pending invitation exists for their email, auto-insert into `tenant_members` and `user_roles`
- Role changes require the acting user to have an "admin" role in that tenant
- The audit log table will grow large over time; we index on `(tenant_id, created_at DESC)` and `(tenant_id, entity_type)` for query performance
- User list queries `tenant_members` joined with a profiles/users view -- since we cannot directly query `auth.users` from the client, we will use the existing user metadata or create a `profiles` table if one doesn't exist

