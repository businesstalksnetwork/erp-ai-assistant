

## Redesign Login Page - Left Brand Panel

### What Changes

Redesign the left brand panel of the login page (`src/pages/Login.tsx`) to:
1. Replace the Sparkles icon + "ERP-AI" text with the actual `erpAI.png` logo image (centered vertically in upper area)
2. Add more descriptive content about the software features
3. Improve visual layout with feature highlights/bullet points

### Design

The left panel will have three vertical sections:
- **Top**: The erpAI logo image (centered, ~180px max-width)
- **Middle** (flex-grow, centered): Headline + description + feature list with icons (e.g., Finansije, CRM, Skladiste, Proizvodnja, AI Asistent)
- **Bottom**: Copyright text

### Technical Details

**File: `src/pages/Login.tsx`**

1. Import the logo: `import erpAiLogo from "@/assets/erpAI.png"`
2. Remove the `Sparkles` import (no longer needed for left panel - keep if used in mobile header)
3. Replace the top logo area (currently Sparkles icon + "ERP-AI" text) with `<img src={erpAiLogo}>`
4. Expand the middle content section with:
   - Keep the existing headline "Inteligentno upravljanje poslovanjem"
   - Keep the description paragraph
   - Add a feature list with lucide icons (e.g., BarChart3, Users, Package, Factory, Brain) showing key modules
5. Update the mobile header to also use the logo image instead of Sparkles icon
6. Style features list with `space-y-3`, white/60 text, small icons

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Login.tsx` | Replace Sparkles with logo image, add feature list, improve layout |

