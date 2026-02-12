

# Phase: Complete DMS (Document Management System) Overhaul

## Overview

Transform the current basic file-upload `documents` table into a full Serbian-compliant Document Registry (Delovodnik) with protocol numbers, versioning, archive book, archiving workflows, projects, document browser, reports, confidentiality-based access control, and activity logging.

## Current State

- **documents table**: Simple file storage with name, file_path, entity_type, tags, notes. No protocol numbers, no categories, no versioning, no access control.
- **Storage bucket**: `tenant-documents` (private) exists and works.
- **No tables for**: document_categories, document_versions, archive_book, archiving_requests, projects, project_members, document_projects, confidentiality_levels, role_confidentiality_access, custom_role_access, document_access, dms_activity_log, dms_notifications.
- **Existing `documents` route**: `/documents` with basic upload/download/delete.

## What We Already Have (DO NOT recreate)

- Auth system with roles (useAuth, AuthProvider, user_roles table)
- Tenant isolation (useTenant, tenant_id scoping, RLS)
- Storage bucket `tenant-documents`
- React Query patterns, toast notifications, i18n system
- Sidebar navigation (TenantLayout with collapsible groups)
- UI components (Table, Dialog, Badge, Select, Tabs, etc.)
- Notification system (useNotifications, notification bell)

---

## Implementation Plan

### Sub-Phase A: Database Schema (Migration)

**New Tables:**

| Table | Purpose |
|-------|---------|
| `document_categories` | 57 categories in 11 groups (Serbian archive law), with group_name, code, name, name_sr |
| `confidentiality_levels` | Configurable levels (Public, Internal, Confidential, Secret) with colors and ordering |
| `role_confidentiality_access` | Maps tenant_role x confidentiality_level to can_read, can_edit |
| `document_access` | Individual user access grants per document |
| `document_versions` | Version history snapshots of document edits |
| `archive_book` | Arhivska knjiga entries with retention periods |
| `archiving_requests` | Izlucivanje request workflow (pending/approved/rejected/completed) |
| `archiving_request_items` | Links archive_book entries to archiving requests |
| `projects` | Project CRUD (name, code, description, status) |
| `project_members` | Project membership with roles (owner, manager, member, viewer) |
| `document_projects` | Many-to-many: documents to projects |
| `dms_activity_log` | DMS-specific audit trail |

**Alter existing `documents` table** to add:
- `protocol_number` (text, unique per tenant) - format: XXX-YY/GGGG
- `subject` (text) - document subject/title
- `sender` (text) - who sent the document
- `recipient` (text) - who received it
- `category_id` (FK to document_categories)
- `confidentiality_level_id` (FK to confidentiality_levels)
- `date_received` (date)
- `valid_until` (date, nullable)
- `status` (aktivan/arhiviran/za_izlucivanje)
- `current_version` (int, default 1)
- `created_by` (uuid FK to auth.users)

**Seed data:**
- 57 document categories in 11 groups (Serbian standard)
- Default confidentiality levels (Public, Internal, Confidential, Secret)
- RLS policies on all new tables (tenant isolation)

### Sub-Phase B: UI Pages

**Pages to create:**

1. **Document Registry (Delovodnik)** - Rewrite `src/pages/tenant/Documents.tsx`
   - Protocol number auto-generation (XXX-YY/GGGG)
   - Full-text search with AND logic
   - Advanced filters: date range, sender, recipient, category, status, confidentiality
   - File upload with standardized path: `{tenant}/{year}/{categoryCode}/{protocolNumber}_{timestamp}.{ext}`
   - Inline PDF/image preview via signed URLs
   - Status badges, protocol number display
   - Excel export of filtered results

2. **Document Detail** - `src/pages/tenant/DocumentDetail.tsx`
   - View/edit document metadata
   - Version history tab (side-by-side comparison)
   - Access control tab (who can see/edit)
   - Linked projects tab
   - Activity log tab

3. **Archive Book** - `src/pages/tenant/ArchiveBook.tsx`
   - Entry management with auto-generated entry numbers
   - Retention periods: Permanent, 10y, 5y, 3y, 2y
   - Stats: total entries, permanent, by retention distribution
   - Excel and PDF export
   - State Archive Transfer tracking (Article 23 - documents >30 years)

4. **Archiving Module** - `src/pages/tenant/Archiving.tsx`
   - Candidates tab: expired/expiring documents with color-coded badges
   - Requests tab: create archiving request (IZL-YYYY/N format)
   - Workflow: Pending -> Approved/Rejected -> Completed
   - Multi-select batch operations
   - PDF destruction record generation

5. **Projects** - `src/pages/tenant/Projects.tsx`
   - CRUD for projects
   - Member management (owner, manager, member, viewer)
   - Link documents to projects

6. **Project Detail** - `src/pages/tenant/ProjectDetail.tsx`
   - Members tab with role management
   - Linked documents tab

7. **Document Browser** - `src/pages/tenant/DocumentBrowser.tsx`
   - Tree view: Year -> Category -> Files
   - Grid view: Card layout grouped by year/category
   - Search, inline preview, direct download

8. **DMS Reports** - `src/pages/tenant/DmsReports.tsx`
   - Date range picker with presets
   - Summary cards (total docs, period docs, archive entries, etc.)
   - Charts: trend, category distribution, status distribution, retention, top senders/recipients
   - Excel export, Annual Archive Report (Article 19)

9. **DMS Settings** - `src/pages/tenant/DmsSettings.tsx`
   - Categories tab (view 57 categories in 11 accordion groups)
   - Retention periods reference
   - Confidentiality levels manager
   - Access matrix (role x confidentiality)

### Sub-Phase C: Routing + Navigation

**New routes under `/documents/`:**
- `/documents` - Document Registry (Delovodnik)
- `/documents/:id` - Document Detail
- `/documents/archive-book` - Archive Book
- `/documents/archiving` - Archiving Module
- `/documents/projects` - Projects
- `/documents/projects/:id` - Project Detail
- `/documents/browser` - Document Browser
- `/documents/reports` - DMS Reports
- `/documents/settings` - DMS Settings

**Sidebar update** - Expand documents nav group:
- Delovodnik (registry)
- Archive Book
- Archiving
- Projects
- Document Browser
- Reports
- Settings (admin only)

**i18n** - Add ~100 new translation keys for DMS in both EN and SR.

---

## Files to Create

| File | Purpose |
|------|---------|
| Migration SQL | Schema: alter documents, create 12 new tables, seed 57 categories + 4 confidentiality levels, RLS |
| `src/pages/tenant/DocumentDetail.tsx` | Document detail with tabs (versions, access, projects, activity) |
| `src/pages/tenant/ArchiveBook.tsx` | Arhivska knjiga with retention tracking |
| `src/pages/tenant/Archiving.tsx` | Archiving workflow (candidates + requests) |
| `src/pages/tenant/Projects.tsx` | Project CRUD |
| `src/pages/tenant/ProjectDetail.tsx` | Project detail with members + linked docs |
| `src/pages/tenant/DocumentBrowser.tsx` | File explorer (tree + grid views) |
| `src/pages/tenant/DmsReports.tsx` | Analytics dashboard for DMS |
| `src/pages/tenant/DmsSettings.tsx` | DMS configuration (categories, access matrix) |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/tenant/Documents.tsx` | Complete rewrite: protocol numbers, advanced filters, categories, confidentiality |
| `src/App.tsx` | Add 9 new DMS routes |
| `src/layouts/TenantLayout.tsx` | Expand documents nav group with 7 sub-items |
| `src/i18n/translations.ts` | Add ~100 DMS translation keys (EN + SR) |

---

## Technical Details

### Protocol Number Generation

```text
Format: XXX-YY/GGGG
  XXX = sequential number within current year (zero-padded to 3+)
  YY  = category code (from document_categories.code)
  GGGG = current year

Generated server-side via:
  SELECT COALESCE(MAX(seq_number), 0) + 1
  FROM documents
  WHERE tenant_id = $1 AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now())
```

### Document Categories (57 in 11 groups - Serbian standard)

```text
Groups: Normativna akta, Opsta dokumentacija, Kadrovi, Finansije, Racunovodstvo,
        Komercijala, Tehnicka dokumentacija, Pravna dokumentacija, Marketing,
        IT dokumentacija, Ostalo
Each with 4-7 specific category codes.
```

### Confidentiality-Based Access Control

```text
Priority order in can_access_document():
1. Creator always has full access
2. Admin role always has full access  
3. role_confidentiality_access: maps role x level -> can_read/can_edit
4. document_access: individual grants per document
5. project_members: access through linked projects
```

### Archive Book Entry Number

```text
Format: Auto-incremented per tenant per year
Retention options: trajno (permanent), 10, 5, 3, 2 years
State Archive Transfer: permanent entries older than 30 years
```

### Archiving Request Workflow

```text
Request number: IZL-YYYY/N (N = sequential)
States: pending -> approved/rejected -> completed
Completing marks linked docs as 'za_izlucivanje'
```

### File Path Convention

```text
{tenantId}/{year}/{categoryCode}/{protocolNumber}_{timestamp}.{extension}
Example: abc123/2026/01-02/001-01-02_2026_1707753600.pdf
```

### Version Comparison

```text
document_versions stores full snapshot of all fields + file_path per version.
Side-by-side diff highlights changed fields between any two versions.
Revert creates a new version (preserving audit trail).
```

