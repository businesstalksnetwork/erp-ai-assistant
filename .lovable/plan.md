
# Fix AI Copilot Sidebar: Collapse Toggle, Visibility, and Fixed Height

## Issues
1. No visible collapse/expand button when sidebar is closed -- once closed, users can't tell it exists
2. Sidebar scrolls with page content instead of being fixed to viewport height
3. When collapsed, there's no visual indicator or rail to reopen it

## Changes

### 1. AiContextSidebar -- Fixed Height and Collapsed Rail (`src/components/ai/AiContextSidebar.tsx`)
- Change the component to always render (remove `if (!open) return null`)
- When collapsed: render a narrow 40px vertical rail with the Sparkles icon and a tooltip, clickable to expand
- When expanded: show the full 280px panel as today
- Use `h-full` with `overflow-hidden` on the outer container so it stays fixed to the screen height (not scrolling with page)
- The inner content area uses `overflow-y-auto` for its own scrolling within the fixed panel
- Add a collapse chevron button (`ChevronRight` icon) next to the X button in the header -- clicking it collapses to the rail instead of fully hiding

### 2. TenantLayout -- Sticky Sidebar Container (`src/layouts/TenantLayout.tsx`)
- The flex container wrapping `main` and the sidebar already uses `overflow-hidden` and `flex-1`
- Ensure the sidebar container has `h-full` so it fills the viewport minus the header
- Remove the toggle button from the header (the sidebar itself now handles expand/collapse via the rail)
- Keep the `Sparkles` button in header as a fallback toggle only on mobile

### Layout When Collapsed
```
[Left Sidebar | Main Content Area                    |rail]
                                                      [*] <-- 40px rail with icon
```

### Layout When Expanded  
```
[Left Sidebar | Main Content Area        | AI Copilot 280px]
                                          [< ] collapse btn
```

## Technical Details

### AiContextSidebar changes:
- Props: change `onClose` to `onToggle` (or keep both), add no-args toggle behavior
- Collapsed state: `w-10 border-l bg-card/50 flex flex-col items-center py-3 gap-2`
  - Sparkles icon button to expand
  - Vertical text "AI" rotated (optional, keeps it minimal)
- Expanded state: same as current but with `h-full overflow-hidden` on the aside, `overflow-y-auto` only on the ScrollArea
- Transition: use `transition-all duration-200` for smooth width change

### TenantLayout changes:
- The sidebar wrapper div gets `sticky top-0 h-full` or simply relies on the flex layout since the parent is already `flex overflow-hidden` with fixed height
- Pass `open` and `onToggle` to `AiContextSidebar` instead of `open` and `onClose`

### Files Modified
- `src/components/ai/AiContextSidebar.tsx` -- collapsed rail + fixed height
- `src/layouts/TenantLayout.tsx` -- minor prop adjustment, ensure height constraints
