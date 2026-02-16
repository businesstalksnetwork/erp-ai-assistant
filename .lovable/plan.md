

# Fix: Amount Section Still Hidden - Missing stylesheet exception

## Problem

The `styleOverride` stylesheet injected into `document.head` (line 176-186) forces black text on ALL `.pdf-export *` elements but only exempts `.bg-primary` -- it does NOT exempt `.bg-slate-800`. This stylesheet competes with pre-baked inline styles during html2canvas rendering.

## Changes

### File: `src/hooks/usePdfGenerator.ts`

**Update the `styleOverride` stylesheet** (lines 176-186) to also exempt `.bg-slate-800`:

```typescript
styleOverride.textContent = `
  .pdf-export, .pdf-export * {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
  }
  .pdf-export .bg-primary,
  .pdf-export .bg-primary *,
  .pdf-export .bg-slate-800,
  .pdf-export .bg-slate-800 * {
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
  }
`;
```

This is a one-line change in one file. The pre-baking and onclone already handle `.bg-slate-800` correctly from the previous edit -- this is the last remaining place that was missed.

