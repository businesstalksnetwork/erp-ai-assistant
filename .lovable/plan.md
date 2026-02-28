

# Remaining Console Warnings Fix

## Current State
There are **3 harmless `forwardRef` warnings** in the console — no errors, no crashes, no blank screens. The app is fully functional.

### Warning 1: `OfflineBanner`
`AnimatePresence` from framer-motion tries to pass a ref to its direct child. When `isOffline` is false, there are no children, so `AnimatePresence` itself becomes the direct child and receives a ref it can't handle. Fix: wrap `AnimatePresence` in a plain `<div>` so the ref lands on the div instead.

### Warning 2 & 3: `App` (BrowserRouter / Routes)
React Router v6 internally tries to pass refs to `Routes` and `BrowserRouter` which are function components. The `v7_startTransition` future flag is already set. These warnings are a known React Router v6 issue that only appears in dev mode and will disappear when upgrading to v7. They cannot be fixed without upgrading the library.

## Plan

### Fix 1: OfflineBanner ref warning (1 file)
- In `src/components/OfflineBanner.tsx`, wrap the `<AnimatePresence>` in a `<div>` element so any ref from a parent lands on the wrapper div, not on AnimatePresence.

### Fix 2: React Router warnings — No action
- These are known React Router v6 dev-mode warnings. They don't affect production builds. Suppressing them would require upgrading to react-router v7 which is a major migration out of scope.

**Total: 1 file changed, 2 warnings documented as known/expected.**

