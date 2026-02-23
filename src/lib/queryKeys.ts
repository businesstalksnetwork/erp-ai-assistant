/**
 * Centralized query key factory for consistent cache invalidation.
 * Usage: queryKeys.invoices.list(tenantId, filters)
 */
export const queryKeys = {
  invoices: {
    all: (tenantId: string) => ["invoices", tenantId] as const,
    list: (tenantId: string, filters?: Record<string, any>) => ["invoices", tenantId, "list", filters] as const,
    detail: (tenantId: string, id: string) => ["invoices", tenantId, "detail", id] as const,
  },
  partners: {
    all: (tenantId: string) => ["partners", tenantId] as const,
    list: (tenantId: string, filters?: Record<string, any>) => ["partners", tenantId, "list", filters] as const,
    detail: (tenantId: string, id: string) => ["partners", tenantId, "detail", id] as const,
  },
  products: {
    all: (tenantId: string) => ["products", tenantId] as const,
    list: (tenantId: string, filters?: Record<string, any>) => ["products", tenantId, "list", filters] as const,
    detail: (tenantId: string, id: string) => ["products", tenantId, "detail", id] as const,
  },
  journalEntries: {
    all: (tenantId: string) => ["journal_entries", tenantId] as const,
    list: (tenantId: string, filters?: Record<string, any>) => ["journal_entries", tenantId, "list", filters] as const,
    detail: (tenantId: string, id: string) => ["journal_entries", tenantId, "detail", id] as const,
  },
  chartOfAccounts: {
    all: (tenantId: string) => ["chart_of_accounts", tenantId] as const,
    list: (tenantId: string) => ["chart_of_accounts", tenantId, "list"] as const,
  },
  employees: {
    all: (tenantId: string) => ["employees", tenantId] as const,
    list: (tenantId: string, filters?: Record<string, any>) => ["employees", tenantId, "list", filters] as const,
    detail: (tenantId: string, id: string) => ["employees", tenantId, "detail", id] as const,
  },
  bankStatements: {
    all: (tenantId: string) => ["bank_statements", tenantId] as const,
    list: (tenantId: string, filters?: Record<string, any>) => ["bank_statements", tenantId, "list", filters] as const,
  },
  opportunities: {
    all: (tenantId: string) => ["opportunities", tenantId] as const,
    list: (tenantId: string, filters?: Record<string, any>) => ["opportunities", tenantId, "list", filters] as const,
    detail: (tenantId: string, id: string) => ["opportunities", tenantId, "detail", id] as const,
  },
  companies: {
    all: (tenantId: string) => ["companies", tenantId] as const,
    list: (tenantId: string, filters?: Record<string, any>) => ["companies", tenantId, "list", filters] as const,
    detail: (tenantId: string, id: string) => ["companies", tenantId, "detail", id] as const,
  },
  contacts: {
    all: (tenantId: string) => ["contacts", tenantId] as const,
    list: (tenantId: string, filters?: Record<string, any>) => ["contacts", tenantId, "list", filters] as const,
    detail: (tenantId: string, id: string) => ["contacts", tenantId, "detail", id] as const,
  },
  leads: {
    all: (tenantId: string) => ["leads", tenantId] as const,
    list: (tenantId: string, filters?: Record<string, any>) => ["leads", tenantId, "list", filters] as const,
  },
  fixedAssets: {
    all: (tenantId: string) => ["fixed_assets", tenantId] as const,
    list: (tenantId: string) => ["fixed_assets", tenantId, "list"] as const,
  },
  bilansStanja: {
    data: (tenantId: string, date: string, entityId?: string) => ["bilans_stanja", tenantId, date, entityId] as const,
    totals: (tenantId: string, date: string, entityId?: string) => ["bilans_stanja_totals", tenantId, date, entityId] as const,
  },
  bilansUspeha: {
    data: (tenantId: string, from: string, to: string, entityId?: string) => ["bilans_uspeha", tenantId, from, to, entityId] as const,
    totals: (tenantId: string, from: string, to: string, entityId?: string) => ["bilans_uspeha_totals", tenantId, from, to, entityId] as const,
  },
  legalEntities: {
    all: (tenantId: string) => ["legal_entities", tenantId] as const,
  },
  notifications: {
    all: (userId: string) => ["notifications", userId] as const,
  },
  auditLog: {
    list: (tenantId: string, filters?: Record<string, any>) => ["audit_log", tenantId, "list", filters] as const,
  },
} as const;
