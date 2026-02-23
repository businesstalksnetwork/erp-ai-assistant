
# Configurable Opportunity Stages in Settings

## Problem
Opportunity pipeline stages ("Kvalifikacija", "Ponuda", "Pregovaranje", "Zatvoreno - dobijeno", "Zatvoreno - izgubljeno") are hardcoded across 4 files. Tenants cannot rename or reorder them.

## Solution

### 1. New Database Table: `opportunity_stages`

```text
CREATE TABLE opportunity_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,           -- internal key e.g. "qualification"
  name text NOT NULL,           -- English display name
  name_sr text,                 -- Serbian display name
  color text,                   -- hex color for badges/charts
  sort_order int DEFAULT 0,
  is_won boolean DEFAULT false, -- marks "closed won" stage
  is_lost boolean DEFAULT false,-- marks "closed lost" stage
  is_system boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, code)
);
ALTER TABLE opportunity_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant access" ON opportunity_stages FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));
```

Seed default stages per tenant (via migration inserting for all existing tenants, and via the create-tenant function for new tenants):
- qualification / Kvalifikacija / #3B82F6 / sort_order=1
- proposal / Ponuda / #8B5CF6 / sort_order=2
- negotiation / Pregovaranje / #F59E0B / sort_order=3
- closed_won / Zatvoreno - dobijeno / #10B981 / is_won=true / sort_order=4
- closed_lost / Zatvoreno - izgubljeno / #EF4444 / is_lost=true / sort_order=5

### 2. New Settings Page: `OpportunityStagesSettings.tsx`

A CRUD page following the same pattern as `CompanyCategoriesSettings.tsx`:
- Table listing all stages with: Name (EN), Name (SR), Code, Color swatch, Sort order, Won/Lost flags
- Add/Edit dialog with fields for name, name_sr, code, color picker, sort_order, is_won, is_lost checkboxes
- Delete with protection: cannot delete stages that have opportunities assigned
- Reorder via sort_order field
- System stages (is_system=true) cannot be deleted but CAN be renamed

### 3. Add to Settings Hub

Add a new link in the **Operations** section of `Settings.tsx`:
- Label: `t("opportunityStages")` / "Faze prilika"
- Icon: `TrendingUp`
- Route: `/settings/opportunity-stages`

### 4. Add Route in `App.tsx`

```text
<Route path="settings/opportunity-stages" element={<ProtectedRoute requiredModule="settings"><OpportunityStagesSettings /></ProtectedRoute>} />
```

### 5. Custom Hook: `useOpportunityStages`

A reusable hook that fetches stages from the DB:
```text
export function useOpportunityStages() {
  const { tenantId } = useTenant();
  return useQuery({
    queryKey: ["opportunity-stages", tenantId],
    queryFn: async () => { /* fetch from opportunity_stages ordered by sort_order */ },
    enabled: !!tenantId,
  });
}
```

### 6. Update Consuming Components

Replace the hardcoded `STAGES` constant in these files with the dynamic hook:

- **`Opportunities.tsx`** -- Kanban columns driven by `useOpportunityStages()`, use stage colors from DB
- **`OpportunityDetail.tsx`** -- Stage selector dropdown uses dynamic stages
- **`OpportunityPipelineChart.tsx`** -- Chart bars use dynamic stages + their colors from DB
- **`WinLossChart.tsx`** -- Uses `is_won` / `is_lost` flags instead of hardcoded `"closed_won"` / `"closed_lost"`
- **`Meetings.tsx`** -- Opportunity dropdown (if it references stages anywhere)

### 7. i18n Keys

Add to `translations.ts`:
- `opportunityStages` / "Opportunity Stages" / "Faze prilika"
- `stageCode` / "Code" / "Kod"
- `isWon` / "Won stage" / "Faza dobitka"
- `isLost` / "Lost stage" / "Faza gubitka"
- `cannotDeleteStageInUse` / "Cannot delete: stage is assigned to opportunities" / "Ne moze se obrisati: faza je dodeljena prilikama"

## Files to Create/Modify

1. **New migration** -- Create `opportunity_stages` table + seed defaults for existing tenants
2. **`src/pages/tenant/OpportunityStagesSettings.tsx`** -- New CRUD settings page
3. **`src/hooks/useOpportunityStages.ts`** -- New shared hook
4. **`src/pages/tenant/Settings.tsx`** -- Add link to opportunity stages
5. **`src/App.tsx`** -- Add route
6. **`src/pages/tenant/Opportunities.tsx`** -- Replace hardcoded STAGES with hook
7. **`src/pages/tenant/OpportunityDetail.tsx`** -- Replace hardcoded STAGES with hook
8. **`src/components/crm/OpportunityPipelineChart.tsx`** -- Use dynamic stages + colors
9. **`src/components/crm/WinLossChart.tsx`** -- Use is_won/is_lost flags
10. **`src/i18n/translations.ts`** -- New keys
