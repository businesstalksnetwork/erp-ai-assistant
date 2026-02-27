# Settings & Shared Infrastructure

## Pages (Routes)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/settings` | Settings | Settings hub |
| `/settings/users` | UserManagement | User/role management |
| `/settings/legal-entities` | LegalEntities | Legal entity (PIB) management |
| `/settings/cost-centers` | CostCenters | Cost center hierarchy |
| `/settings/currencies` | Currencies | Currency management + exchange rates |
| `/settings/tax-rates` | TaxRates | Tax rate configuration |
| `/settings/approval-workflows` | ApprovalWorkflows | Approval workflow setup |
| `/settings/posting-rules` | PostingRules | GL posting rules engine config |
| `/settings/payroll-parameters` | PayrollParameters | Payroll calculation parameters |
| `/settings/import` | LegacyImport | Legacy data import |
| `/settings/notifications` | NotificationSettings | Notification preferences |
| `/settings/audit-log` | AuditLog | System audit trail |
| `/settings/accounting-architecture` | AccountingArchitecture | Visual system architecture diagram |
| `/settings/archive-book` | ArchiveBook | Document archiving (Arhivska knjiga) |
| `/settings/archiving-requests` | ArchivingRequests | Archiving request workflow |

## Database Tables

### Multi-tenancy
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `tenants` | id, name, tax_id, settings | Root tenant entity |
| `user_tenants` | id, user_id, tenant_id, role | User↔tenant membership + role |
| `legal_entities` | id, tenant_id, name, tax_id (PIB), registration_number, address | Sub-entities within a tenant |

### Configuration
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `cost_centers` | id, tenant_id, code, name, parent_id, is_active | Cost center hierarchy |
| `currencies` | id, tenant_id, code, name, symbol, is_default | Currency definitions |
| `exchange_rates` | id, tenant_id, currency_id, rate, rate_date | Daily exchange rates |
| `tax_rates` | id, tenant_id, name, rate, tax_type, is_default | Tax rate configuration |

### Approval Workflows
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `approval_workflows` | id, tenant_id, entity_type, name, min_approvers, required_roles, threshold_amount | Workflow definitions |
| `approval_requests` | id, tenant_id, workflow_id, entity_type, entity_id, status, requested_by | Active requests |
| `approval_steps` | id, request_id, approver_user_id, action, comment, acted_at | Approval actions |

### Audit & Archive
| Table | Key Columns | Purpose |
|-------|------------|---------|
| `audit_log` | id, tenant_id, user_id, action, entity_type, entity_id, before_state, after_state | Change tracking |
| `archive_book` | id, tenant_id, entry_number, content_description, year_of_creation, retention_period | Arhivska knjiga |
| `archiving_requests` | id, tenant_id, request_number, status, requested_by, approved_by | Archiving workflow |
| `document_categories` | id, tenant_id, name, retention_years | Document classification |

## Cross-Module Dependencies

### Settings → All Modules
| Setting | Used By |
|---------|---------|
| `legal_entities` | Invoices, Payroll, Journal Entries, Bank Accounts, Tax Returns |
| `cost_centers` | Journal Lines, Reports (Cost Center P&L) |
| `currencies` | Invoices, Bank Accounts, FX Revaluation |
| `tax_rates` | Invoice Lines, POS, Supplier Invoices |
| `approval_workflows` | Invoices (posting approval), POs, Leave Requests |
| `posting_rules` | Bank Statements (new engine), future: all GL posting |
| `payroll_parameters` | Payroll calculation (contribution rates, tax brackets) |

## Known Gaps
- _(resolved)_ ~~Approval workflows defined but not enforced on all entity types~~ — now enforced on: invoices, supplier invoices, purchase orders, goods receipts
- No role-based module access control (only tenant membership)
- Exchange rate import not automated (manual entry)
