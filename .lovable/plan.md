

# Fix: Mobile Sidebar Scrolling and Bottom Bar Overlap

## Problem

On smaller mobile phones, the sidebar content extends below the visible area and cannot be scrolled. Additionally, the bottom items are hidden behind the fixed bottom navigation bar.

## Changes

### File: `src/components/AppLayout.tsx`

**1. Add bottom padding to sidebar on mobile** so content doesn't hide behind the bottom nav bar:

Update the sidebar's inner container (line 218) to include bottom padding on mobile:

```typescript
<div className="flex flex-col h-full overflow-y-auto overscroll-contain pb-16 lg:pb-0">
```

This adds `pb-16` (64px) on mobile to match the bottom bar height, and `lg:pb-0` removes it on desktop where there's no bottom bar.

**2. Ensure the sidebar height accounts for the bottom bar on mobile:**

Update the sidebar `<aside>` element (line 214) to use `h-[100dvh]` instead of `h-screen-safe` for more reliable dynamic viewport height, ensuring the sidebar fills the available screen:

```typescript
'fixed top-0 left-0 z-50 h-[100dvh] w-64 bg-sidebar text-sidebar-foreground ...'
```

## Summary

- One file: `src/components/AppLayout.tsx`
- Add `pb-16 lg:pb-0` to the sidebar's inner scrollable container so nav items are not hidden behind the bottom bar
- Use `h-[100dvh]` for reliable full-height on all mobile browsers

