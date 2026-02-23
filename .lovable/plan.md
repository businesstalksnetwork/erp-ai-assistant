

## Add Logo to Brzi AI Izveštaj Page

### What Changes

Add the uploaded `erpAI.png` logo centered at the top of the AI Briefing page, between the PageHeader and the date range bar.

### Steps

1. **Copy the logo** from `user-uploads://erpAI.png` to `src/assets/erpAI.png`
2. **Update `AiBriefing.tsx`**:
   - Import the logo: `import erpAiLogo from "@/assets/erpAI.png"`
   - Add a centered `<img>` element after the PageHeader, before the date range bar
   - Style: centered with `mx-auto`, reasonable max width (~200px), with some vertical spacing

### File Changes

| File | Change |
|------|--------|
| `src/assets/erpAI.png` | New file -- copy uploaded logo |
| `src/pages/tenant/AiBriefing.tsx` | Import logo and render centered image between header and date bar |

