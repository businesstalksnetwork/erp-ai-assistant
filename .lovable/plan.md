

## Add background differentiation for expanded sidebar groups

When a sidebar nav group is expanded, the child items inside `CollapsibleContent` should have a slightly different background to visually separate them from collapsed groups.

### Changes

**File: `src/layouts/TenantLayout.tsx`**

1. In the `NavGroupCollapsible` component (~line 283), add a subtle background class to the `CollapsibleContent`:
   ```
   <CollapsibleContent className="bg-sidebar-accent/30 rounded-md mx-1 mb-1">
   ```

2. In the Settings footer collapsible (~line 440), apply the same background treatment:
   ```
   <CollapsibleContent className="max-h-[40vh] overflow-y-auto bg-sidebar-accent/30 rounded-md mx-1 mb-1">
   ```

This adds a low-opacity accent background behind expanded menu items, creating a clear visual distinction between expanded and collapsed groups while maintaining the dark sidebar aesthetic.

