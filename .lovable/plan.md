
# Add Context-Aware Suggested Questions to Quick Ask

## What Changes
In the "Quick Ask" (Brzi Upit) section of the AI sidebar, instead of just showing "Pitajte o vasim podacima..." placeholder, display 3-4 clickable pre-built questions relevant to the current page. Clicking a question auto-sends it to the AI chat.

## How It Works
Add a route-to-questions map in `AiContextSidebar.tsx`. Based on `location.pathname`, the sidebar picks the right set of suggested questions. Each question renders as a small clickable chip/button. When clicked, it calls `send(question)` directly.

### Example Questions by Page

| Route | Questions (SR / EN) |
|-------|---------------------|
| `/analytics/ratios` | "Koji su mi najslabiji finansijski pokazatelji?" / "Which ratios need attention?" |
| `/analytics/ratios` | "Kako da poboljsam likvidnost?" / "How can I improve liquidity?" |
| `/dashboard` | "Koji su danas najvazniji trendovi?" / "What are today's key trends?" |
| `/analytics/cashflow-forecast` | "Da li cu imati problema sa likvidnoscu?" / "Will I face cash shortfalls?" |
| `/analytics/budget` | "Gde najvise prekoracujem budzet?" / "Where am I most over budget?" |
| `/inventory/*` | "Koji artikli imaju najsporiji obrt?" / "Which items have slowest turnover?" |
| `/crm/*` | "Koji lidovi su najblizi konverziji?" / "Which leads are closest to conversion?" |
| `/hr/*` | "Kakav je trend troskova plata?" / "What's the payroll cost trend?" |
| `/production/*` | "Gde su uska grla u proizvodnji?" / "Where are production bottlenecks?" |
| (fallback) | "Sumiraj trenutno stanje" / "Summarize current status" |

### UI Design
- Render as small outlined buttons/chips below the placeholder text
- 3-4 questions max per page context
- Each chip has a subtle sparkle or arrow icon
- On click: set as input and auto-send
- Once a conversation starts (messages.length > 0), hide the suggestions

### File Modified
- `src/components/ai/AiContextSidebar.tsx` -- add suggested questions map and render chips in the Quick Ask section

### Technical Details
- New function `getSuggestedQuestions(path: string, sr: boolean): string[]` returns localized questions
- Questions render inside the existing `{messages.length === 0 && ...}` block, replacing the plain placeholder
- Each chip calls `send(question)` on click
- Covers ~15 route prefixes with fallback for unknown pages
