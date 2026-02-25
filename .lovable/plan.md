

# Fix: Sticky Layout — Sidebar, Header & AI Sidebar Scroll Issues

## Problem

From the screenshot and code analysis, the root issue is the outer container uses `min-h-screen` which allows the entire page (sidebar + header + AI panel) to grow beyond the viewport and scroll together. Only the `<main>` content area should scroll — sidebar, header, and AI sidebar must remain fixed.

## Root Cause

In `TenantLayout.tsx` line 333:
```
<div className="min-h-screen flex w-full">
```
This allows the entire layout to exceed viewport height. While the inner content area has `overflow-hidden` and `overflow-auto`, the parent doesn't constrain height, so the browser can scroll the whole page.

Additionally:
- The header uses `sticky top-0` but within a flex-col container with `h-screen`, sticky is redundant and can cause confusion — it should be a static flex child with `shrink-0`.
- The AI sidebar's `h-full` works but lacks `overflow-hidden` on its wrapper, so long AI content can push the layout.
- On mobile, the AI sidebar overlay needs proper safe-area handling.

## Changes

### File: `src/layouts/TenantLayout.tsx`

**Change 1 — Outer container: lock to viewport**
Line 333: `min-h-screen` → `h-screen overflow-hidden`
```
<div className="h-screen flex w-full overflow-hidden">
```
This prevents the browser from ever scrolling the entire page.

**Change 2 — Right panel: ensure height constraint**
Line 475: Already has `h-screen` — change to `h-full` since parent is now `h-screen`:
```
<div className="flex-1 flex flex-col h-full min-h-0">
```
Adding `min-h-0` prevents flex children from overflowing.

**Change 3 — Header: use shrink-0 instead of sticky**
Line 476: Remove `sticky top-0`, add `shrink-0`:
```
<header className="h-12 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-background shrink-0 z-10">
```
In a flex-col layout, `shrink-0` is the correct way to keep the header fixed — `sticky` is for scroll containers.

**Change 4 — Content area: ensure min-h-0**
Line 529: Add `min-h-0` to prevent flex overflow:
```
<div className="flex-1 flex overflow-hidden min-h-0">
```

**Change 5 — Main content: ensure scroll isolation**
Line 530: Already has `overflow-auto` — this is correct. No change needed.

**Change 6 — Mobile AI sidebar overlay: full height with safe area**
Lines 556-560: Add `overflow-hidden` and safe area support:
```
<div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setAiSidebarOpen(false)}>
  <div className="absolute right-0 top-0 h-full w-[300px] max-w-[85vw] overflow-hidden" onClick={e => e.stopPropagation()}>
    <AiContextSidebar open={true} onToggle={() => setAiSidebarOpen(false)} />
  </div>
</div>
```

### File: `src/components/ai/AiContextSidebar.tsx`

**Change 7 — Collapsed rail: fix height**
Line 171: Change `h-full` to use sticky positioning within flex:
```
<aside className="w-10 border-l bg-card/50 backdrop-blur-sm flex flex-col items-center py-3 gap-3 shrink-0 print:hidden">
```
Remove `h-full` since the flex parent controls height.

**Change 8 — Expanded panel: fix height**  
Line 192: Same fix — remove explicit `h-full`, rely on flex:
```
<aside className="w-[280px] xl:w-[300px] border-l bg-card/50 backdrop-blur-sm flex flex-col shrink-0 print:hidden overflow-hidden">
```

### File: `src/layouts/TenantLayout.tsx` — Sidebar inner container

**Change 9 — Sidebar content container**
Line 335: The sidebar inner div already has `h-full` and `overflow-hidden` which is correct. The `SidebarContent` on line 344 has `overflow-y-auto` which is also correct.

No sidebar changes needed — the Shadcn `<Sidebar>` component manages its own height within the flex layout. The fix is entirely about the outer container constraints.

## Summary of Changes

| File | Line(s) | What | Why |
|------|---------|------|-----|
| `TenantLayout.tsx` | 333 | `min-h-screen` → `h-screen overflow-hidden` | Lock viewport, prevent page-level scroll |
| `TenantLayout.tsx` | 475 | `h-screen` → `h-full min-h-0` | Proper flex child height |
| `TenantLayout.tsx` | 476 | Remove `sticky top-0`, add `shrink-0` | Header stays fixed via flex, not sticky |
| `TenantLayout.tsx` | 529 | Add `min-h-0` | Prevent flex overflow |
| `TenantLayout.tsx` | 557 | Add `max-w-[85vw]` | Mobile AI panel doesn't exceed screen |
| `AiContextSidebar.tsx` | 171 | Remove `h-full`, keep `shrink-0` | Height from flex parent |
| `AiContextSidebar.tsx` | 192 | Remove `h-full` | Height from flex parent |

These 7 targeted class changes fix the scroll issue across all pages — sidebar, header, and AI panel will remain fixed while only the main content area scrolls.

