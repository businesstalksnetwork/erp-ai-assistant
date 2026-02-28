

## Fix: Sidebar Animation + Module Visibility for Super Admins

### Problem 1: All modules visible regardless of tenant settings
`canPerform()` in `usePermissions.ts` line 68 returns `true` immediately for super admins, bypassing the `enabledModuleKeys` check. This means sidebar shows all modules (CRM, Sales, Loyalty, Service, etc.) even when they're not enabled for the selected tenant.

**Fix:** In `usePermissions.ts`, change `canPerform` so super admins still bypass role checks but respect tenant module enablement for sidebar visibility. Move the `isSuperAdmin` bypass below the tenant module check for non-core modules.

```
canPerform(module, action):
  - role check: skip for superAdmin (keep bypass)
  - always-on modules: allow for view (keep)
  - tenant module check: APPLY even for superAdmin
  - action permissions: skip for superAdmin (keep bypass)
```

### Problem 2: Settings collapsible uses uncontrolled state
Line 623: `<Collapsible defaultOpen={...}>` — uncontrolled. When navigating away from settings, it stays open. Integrate Settings into the accordion system using `openGroupId`.

**Fix:** Change Settings `Collapsible` from `defaultOpen` to controlled `open={openGroupId === "settings"}` with `onOpenChange`. Add "settings" detection to `getActiveGroupId`.

### Files Modified

| File | Change |
|------|--------|
| `src/hooks/usePermissions.ts` | Super admin respects tenant module enablement for UI visibility |
| `src/layouts/TenantLayout.tsx` | Settings collapsible → controlled accordion state; add settings to `getActiveGroupId` |

### Execution Order
1. Fix `usePermissions.ts` — super admin module visibility
2. Fix `TenantLayout.tsx` — Settings accordion behavior

