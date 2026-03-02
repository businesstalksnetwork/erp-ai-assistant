# ISO 27017 / 27018 — Cloud Security Controls

## 1. Document Information
| Field | Value |
|-------|-------|
| Standard | ISO/IEC 27017:2015, ISO/IEC 27018:2019 |
| Document ID | CLOUD-03 |
| Version | 1.0 |
| Last Updated | 2026-03-02 |
| Owner | Security Officer |

## 2. Cloud Deployment Model
ProERP AI uses **Supabase** (hosted on AWS eu-central-1) as its cloud infrastructure provider. The deployment model is **SaaS** with a multi-tenant architecture.

## 3. Shared Responsibility Matrix

| Control Area | Cloud Provider (Supabase/AWS) | ProERP AI (Application) |
|---|---|---|
| Physical security | ✅ Full | ❌ None |
| Network security | ✅ Firewall, DDoS | ✅ CORS, rate limiting |
| OS patching | ✅ Full | ❌ None |
| Database engine | ✅ PostgreSQL hosting | ✅ Schema, RLS policies |
| Data encryption at rest | ✅ AES-256 | ✅ PII field encryption (pgcrypto) |
| Data encryption in transit | ✅ TLS 1.2+ | ✅ HTTPS enforcement |
| Identity management | ✅ Supabase Auth | ✅ RBAC, tenant isolation |
| Application logic | ❌ None | ✅ Full |
| Backup & recovery | ✅ Daily snapshots | ✅ Export functions |
| Logging & monitoring | ✅ Infrastructure logs | ✅ Application audit logs |
| Incident response | ✅ Infrastructure | ✅ Application incidents |

## 4. Tenant Isolation Controls (ISO 27017 CLD.9.5.1)

### 4.1 Database-Level Isolation
- **Row-Level Security (RLS)**: All tables have `tenant_id`-based RLS policies enforcing `deny-by-default`
- **Policy pattern**: `tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() AND status = 'active')`
- **Service role**: Used only by edge functions for cross-tenant operations (e.g., cron jobs)

### 4.2 Application-Level Isolation
- Tenant context injected via `useTenant()` hook — all queries scoped
- No cross-tenant data access possible through the API
- Edge functions validate `tenant_id` ownership before data operations

### 4.3 Storage Isolation
- File uploads scoped to tenant-specific storage paths
- Signed URLs with expiration for document access

## 5. PII Controls (ISO 27018)

### 5.1 PII Categories Processed
| Category | Examples | Protection |
|---|---|---|
| Employee identity | JMBG, bank accounts | pgcrypto field encryption |
| Contact information | Email, phone, address | RLS + role-based access |
| Financial data | Salary, tax returns | RLS + audit logging |
| Customer data | Name, tax ID | RLS + DSAR automation |

### 5.2 PII Processing Principles
1. **Purpose limitation**: Data collected only for documented business purposes
2. **Data minimization**: Only necessary fields collected per module
3. **Retention**: Configurable per document category (archive_book)
4. **Subject rights**: DSAR module (PRIV-03) for access/rectification/erasure requests
5. **Consent**: Marketing consent tracked in loyalty_members

### 5.3 PII Encryption
- JMBG encrypted at rest using `pgcrypto` extension
- Bank account numbers encrypted at rest
- Decryption only in authorized edge functions with audit logging

## 6. Data Location (ISO 27018 A.12.1)
| Data Type | Location | Provider |
|---|---|---|
| Database | EU (Frankfurt, eu-central-1) | Supabase/AWS |
| File storage | EU (Frankfurt) | Supabase Storage/AWS S3 |
| Edge functions | Global (closest region) | Supabase Edge/Deno Deploy |
| AI processing | API calls to Google/OpenAI | Lovable AI Gateway |

## 7. Security Headers (ISO 27017 CLD.13.1.4)
All edge functions include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cache-Control: no-store, no-cache, must-revalidate`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## 8. Rate Limiting (ISO 27017 CLD.9.3)
DB-backed sliding window rate limiter per category:
| Category | Limit | Window |
|---|---|---|
| AI functions | 30 req | 60 sec |
| SEF (e-invoicing) | 60 req | 60 sec |
| CRUD operations | 120 req | 60 sec |
| Auth endpoints | 10 req | 60 sec |
| Export/PDF | 5 req | 60 sec |

## 9. Audit Trail
- `ai_action_log`: All AI decisions with confidence scores
- `audit_log`: CRUD operations on sensitive entities
- `data_breach_incidents`: 72-hour notification tracking per ZZPL

## 10. Review Schedule
- Quarterly review of cloud security controls
- Annual third-party security assessment
- Continuous automated security scanning (CI/CD pipeline)
