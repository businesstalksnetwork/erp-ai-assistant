

# Fix: Tenant Switching Not Updating the UI

## Problem

`useTenant` is a plain hook with its own `useState` in every component that calls it. When `TenantSelector` calls `switchTenant(id)`, it updates localStorage and its own local state, but every other component (Dashboard, Companies, etc.) has a **separate** `selectedId` state that was initialized once on mount and never reacts to the change.

The `qc.invalidateQueries()` call does re-fetch data, but all queries still use the **old** `tenantId` from their own hook instance.

## Solution

Convert `useTenant` from a standalone hook into a **React Context + Provider**, so all components share the same `selectedId` state.

### Changes

**1. `src/hooks/useTenant.ts`**
- Create a `TenantContext` using `React.createContext`
- Export a `TenantProvider` component that holds the shared state (selectedId, tenants, switchTenant, etc.)
- The `useTenant()` hook becomes a thin wrapper around `useContext(TenantContext)`
- All existing return values (`tenantId`, `tenantName`, `role`, `tenants`, `switchTenant`, `isLoading`) remain identical -- no consumer changes needed

**2. `src/App.tsx`**
- Wrap the router (or the authenticated routes) with `<TenantProvider>` inside `<AuthProvider>` so that `useTenant` has access to the auth context
- Place it above both `TenantLayout` and `SuperAdminLayout` so the selector works everywhere

### Why This Works

When `switchTenant` updates the shared context state, every component consuming `useTenant()` re-renders with the new `tenantId`. Combined with `qc.invalidateQueries()`, all tenant-scoped queries re-fetch with the correct ID.

### Technical Detail

```text
Before (broken):
  TenantSelector  -> useTenant() -> own useState("A")  -> switchTenant("B") updates this + localStorage
  Dashboard       -> useTenant() -> own useState("A")  -> still "A", never updates

After (fixed):
  TenantProvider (shared state: "A")
    TenantSelector  -> useContext -> reads "A" -> switchTenant("B") updates shared state
    Dashboard       -> useContext -> reads "B" -> re-renders with new tenantId
```

No other files need changes -- the hook signature stays the same.

