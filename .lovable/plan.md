

## Fix: Restore Sidebar Visibility and Apply Dark Theme Correctly

The sidebar disappeared because of two issues from the last edit:

1. **`overflow-hidden` on the Sidebar component** -- The `className` prop on `<Sidebar>` is applied to a `fixed`-positioned wrapper div. Adding `overflow-hidden` there clips all sidebar content, and the animated orb blurs (which extend beyond bounds) make this worse.

2. **Gradient background override** -- The gradient classes (`bg-gradient-to-b ...`) are applied to the fixed wrapper, but there's an inner `div[data-sidebar="sidebar"]` that has `bg-sidebar` which paints over the gradient, making it invisible.

3. **Animated orbs are direct children of `<Sidebar>`** -- They render inside the fixed wrapper but outside the inner sidebar div, causing layout issues.

### Fix in `src/layouts/TenantLayout.tsx`

**Remove** from the `<Sidebar>` className:
- `bg-gradient-to-b from-[hsl(225,50%,12%)] via-[hsl(225,55%,15%)] to-[hsl(230,45%,10%)]`
- `relative overflow-hidden`

**Keep** only the original styling: `border-r border-sidebar-border w-64`

**Move** the gradient background and animated orbs **inside** the sidebar content area -- wrap them in a container div that sits inside the `<Sidebar>` as a styled wrapper, or apply the dark theme via CSS variables instead.

### Recommended approach

Since the sidebar CSS variables already define a dark theme (`--sidebar-background: 224 71% 4%`), the cleanest fix is:

1. **Remove** the inline gradient and orb divs from `<Sidebar>`
2. **Update CSS variables** in `src/index.css` to use the desired gradient-like dark colors (the sidebar is already dark by default)
3. **Add** the animated orbs inside a wrapper div that is a child of `SidebarContent` or the logo area, with `overflow-hidden` only on that inner wrapper

### Files to modify

| File | Change |
|------|--------|
| `src/layouts/TenantLayout.tsx` | Remove gradient classes and `overflow-hidden` from Sidebar className. Move animated orbs inside a proper inner wrapper with `relative overflow-hidden`. |
| `src/index.css` (optional) | Fine-tune `--sidebar-background` and related variables if a different shade is desired |

### Technical detail

In `TenantLayout.tsx` line 315, change:
```
<Sidebar className="border-r border-sidebar-border w-64 bg-gradient-to-b from-[hsl(225,50%,12%)] via-[hsl(225,55%,15%)] to-[hsl(230,45%,10%)] relative overflow-hidden">
  {/* Subtle animated orbs */}
  <div className="absolute top-0 right-0 ..." />
  <div className="absolute bottom-0 left-0 ..." />
```

To:
```
<Sidebar className="border-r border-sidebar-border w-64">
```

Then wrap ALL sidebar children (logo + SidebarContent + footer) in a single inner div:
```
<div className="relative flex flex-col h-full w-full overflow-hidden bg-gradient-to-b from-[hsl(225,50%,12%)] via-[hsl(225,55%,15%)] to-[hsl(230,45%,10%)]">
  {/* Animated orbs */}
  <div className="absolute top-0 right-0 w-[200px] h-[200px] rounded-full bg-primary/10 blur-[80px] animate-[pulse_8s_ease-in-out_infinite] pointer-events-none" />
  <div className="absolute bottom-0 left-0 w-[150px] h-[150px] rounded-full bg-[hsl(260,60%,30%)]/8 blur-[60px] animate-[pulse_10s_ease-in-out_infinite_2s] pointer-events-none" />

  {/* Logo */}
  <div className="pt-2 pb-5 px-4 border-b border-white/5 flex justify-center relative z-10">
    ...
  </div>

  <SidebarContent className="... relative z-10">
    ...
  </SidebarContent>

  {/* Footer */}
  ...
</div>
```

This ensures the gradient and orbs render inside the inner sidebar container (which already has `bg-sidebar`) without breaking the Sidebar component's fixed positioning logic.

