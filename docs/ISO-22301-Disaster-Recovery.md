# ISO 22301 — Disaster Recovery Runbooks

## 1. Document Information
| Field | Value |
|-------|-------|
| Standard | ISO 22301:2019 |
| Document ID | BC-03 |
| Version | 1.0 |
| Last Updated | 2026-03-02 |
| Owner | IT Operations Manager |

## 2. RTO/RPO Targets

| System Component | RPO (Recovery Point Objective) | RTO (Recovery Time Objective) | Priority |
|---|---|---|---|
| Database (PostgreSQL) | 1 hour | 4 hours | P0 — Critical |
| Authentication (Supabase Auth) | 0 (managed) | 1 hour | P0 — Critical |
| Edge Functions | 0 (code in git) | 30 minutes | P1 — High |
| File Storage | 24 hours | 8 hours | P2 — Medium |
| Frontend Application | 0 (code in git) | 15 minutes | P1 — High |
| AI Services | N/A (stateless) | 1 hour | P2 — Medium |

## 3. Disaster Scenarios

### 3.1 Scenario A: Database Corruption / Data Loss

**Trigger**: Accidental deletion, failed migration, ransomware, hardware failure

**Detection**:
- Supabase dashboard health checks
- Application error rate spike (monitoring)
- User reports of missing data

**Recovery Procedure**:
1. **Assess** (15 min): Determine scope of data loss using `postgres_logs` analytics
2. **Notify** (immediate): Alert stakeholders via established communication channels
3. **Restore** (1-3 hours):
   - Navigate to Supabase Dashboard → Database → Backups
   - Select most recent backup before incident
   - Initiate Point-in-Time Recovery (PITR)
   - Verify data integrity via spot checks on critical tables
4. **Validate** (30 min):
   - Run `SELECT count(*) FROM invoices WHERE tenant_id = '<tenant>'`
   - Verify GL balances match expectations
   - Check `audit_log` for completeness
5. **Post-incident** (24 hours): Create CAPA action, update runbook

### 3.2 Scenario B: Edge Function Failure / Deployment Issue

**Trigger**: Bad deployment, runtime errors, dependency issues

**Detection**:
- Edge function logs showing errors
- HTTP 500 responses from function endpoints
- Network monitoring alerts

**Recovery Procedure**:
1. **Identify** (5 min): Check edge function logs in Supabase Dashboard
2. **Rollback** (10 min):
   - `git revert` the problematic commit
   - Push to main branch — Lovable auto-deploys
   - Alternatively: restore previous function version from git history
3. **Verify** (5 min): Test affected endpoints
4. **Post-incident**: Log in CAPA system

### 3.3 Scenario C: Authentication Service Outage

**Trigger**: Supabase Auth service degradation

**Detection**:
- Users unable to login
- 401/403 responses on authenticated endpoints
- Supabase status page alerts

**Recovery Procedure**:
1. **Confirm** (5 min): Check https://status.supabase.com
2. **Communicate** (immediate): Notify users of known issue
3. **Wait** (managed service): Supabase handles Auth service recovery
4. **Verify** (10 min): Test login flow once service restored
5. **Alternative** (if prolonged >4 hours):
   - Enable maintenance mode in application
   - Consider read-only mode for non-authenticated endpoints

### 3.4 Scenario D: Complete Infrastructure Failure

**Trigger**: AWS region outage, Supabase platform failure

**Recovery Procedure**:
1. **Assess** (15 min): Verify scope via status pages
2. **Communicate** (immediate): Stakeholder notification
3. **Activate backup plan** (2-4 hours):
   - Deploy to alternate Supabase project (pre-configured)
   - Restore from most recent database backup
   - Update DNS / environment variables
   - Redeploy frontend with new Supabase URL
4. **Data reconciliation** (post-recovery): Compare data between primary and backup

### 3.5 Scenario E: Data Breach / Security Incident

**Trigger**: Unauthorized access detected, data exfiltration

**Recovery Procedure**:
1. **Contain** (immediate):
   - Revoke compromised API keys
   - Rotate `SUPABASE_SERVICE_ROLE_KEY`
   - Disable affected user accounts
2. **Assess** (1-2 hours):
   - Review `audit_log` for unauthorized access patterns
   - Check `auth_logs` for suspicious authentication events
   - Identify affected data scope
3. **Notify** (within 72 hours per ZZPL):
   - Log incident in `data_breach_incidents` table
   - Notify affected data subjects if PII compromised
   - Notify Poverenik (Serbian Data Protection Authority) if required
4. **Remediate**:
   - Patch vulnerability
   - Create CAPA action
   - Update security controls

## 4. Communication Plan

| Severity | Audience | Channel | Timeline |
|---|---|---|---|
| P0 Critical | All stakeholders | Email + Phone | Immediate |
| P1 High | IT + Management | Email | Within 1 hour |
| P2 Medium | IT Team | Slack/Teams | Within 4 hours |
| P3 Low | IT Team | Ticket system | Next business day |

## 5. Backup Strategy

### 5.1 Automated Backups
- **Supabase PITR**: Continuous WAL archiving (Pro plan)
- **Daily snapshots**: Supabase automatic daily backups
- **Retention**: 30 days for daily backups

### 5.2 Application Code
- **Git repository**: Full version history
- **Lovable platform**: Automatic deployment from git

### 5.3 Configuration
- **Edge function secrets**: Documented in secure vault
- **Environment variables**: Documented in deployment guide

## 6. Testing Schedule

| Test Type | Frequency | Last Tested | Next Due |
|---|---|---|---|
| Database restore drill | Quarterly | — | Q2 2026 |
| Edge function rollback | Monthly | — | April 2026 |
| Full DR simulation | Annually | — | Q4 2026 |
| Communication plan test | Semi-annually | — | Q3 2026 |

## 7. Dependencies & Contacts

| Service | Provider | Support Channel |
|---|---|---|
| Database & Auth | Supabase | support@supabase.io |
| Cloud Infrastructure | AWS | AWS Support Console |
| AI Gateway | Lovable | support@lovable.dev |
| Domain & DNS | Registrar | Provider dashboard |

## 8. Review & Approval
This document must be reviewed quarterly and after every incident requiring DR activation.
