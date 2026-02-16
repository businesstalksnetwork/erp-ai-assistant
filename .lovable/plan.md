
# Fix AI Sidebar: Full Viewport Height + More Page-Specific Questions

## Problem
1. The sidebar does not stay fixed to the viewport height -- it grows with page content and the chat input scrolls out of view
2. Suggested questions only cover broad module prefixes (e.g., `/crm`) but not specific sub-pages like `/crm/companies`, `/crm/leads`, `/crm/contacts`, etc.

## Root Cause (Height Issue)
In `TenantLayout.tsx`, the content area is:
```
<div className="flex-1 flex flex-col min-h-screen">  // line 449 -- can grow beyond viewport
  <header .../>
  <div className="flex-1 flex overflow-hidden">       // line 504
    <main className="flex-1 ... overflow-auto">        // scrolls fine
    <AiContextSidebar ... />                           // h-full but parent has no max height
  </div>
</div>
```
The `min-h-screen` on the outer div means it can grow taller than the viewport. The inner `flex-1 flex overflow-hidden` doesn't get a fixed height constraint, so the sidebar's `h-full` doesn't cap to viewport height.

## Fix

### 1. TenantLayout.tsx -- Constrain height to viewport
Change the right-side column from `min-h-screen` to `h-screen` (or `max-h-screen`) so the content area and sidebar are locked to viewport height:

- Line 449: Change `min-h-screen` to `h-screen` on the outer flex column
- This ensures the inner `flex-1 flex overflow-hidden` div gets a fixed height, and both `<main>` (with `overflow-auto`) and the sidebar (with `h-full`) stay within the viewport

### 2. AiContextSidebar.tsx -- Add more sub-page questions
Add specific suggested questions for sub-pages across all modules. The matching uses `path.startsWith(prefix)`, and more specific prefixes are listed first so they match before the broad module prefix.

New question entries to add (before the existing broad entries):

| Route Prefix | Questions (SR / EN) |
|---|---|
| `/crm/companies` | "Koji su najaktivniji kupci?" / "Who are the most active customers?", "Koliko imam novih firmi ovog meseca?" / "How many new companies this month?" |
| `/crm/contacts` | "Koji kontakti nemaju aktivnost?" / "Which contacts have no activity?", "Koliko imam kontakata bez firme?" / "How many contacts without a company?" |
| `/crm/leads` | "Koji lidovi su najduze neaktivni?" / "Which leads are stale longest?", "Kakva je konverzija po izvoru?" / "What's conversion rate by source?" |
| `/crm/opportunities` | "Koje prilike su najbize zatvaranju?" / "Which deals are closest to closing?", "Kolika je prosecna vrednost prilike?" / "What's the average deal value?" |
| `/crm/meetings` | "Koliko imam zakazanih sastanaka ove nedelje?" / "How many meetings this week?", "Koji sastanci nemaju belekse?" / "Which meetings have no notes?" |
| `/sales/quotes` | "Koliko ponuda ceka odobrenje?" / "How many quotes pending approval?", "Koja ponuda ima najvecu vrednost?" / "Which quote has the highest value?" |
| `/sales/sales-orders` | "Koji nalozi kasne sa isporukom?" / "Which orders are late on delivery?", "Kakav je trend naloga ovog meseca?" / "What's the order trend this month?" |
| `/purchasing/orders` | "Koje nabavke kasne?" / "Which purchases are overdue?", "Ko su najveci dobavljaci?" / "Who are the top suppliers?" |
| `/accounting/invoices` | "Koliko faktura je neplaceno?" / "How many invoices are unpaid?", "Koji kupci najvise kasne?" / "Which customers are most overdue?" |
| `/accounting/journal` | "Ima li neknjiyzenih stavki?" / "Any unposted entries?", "Sumiraj poslednja knjizenja" / "Summarize recent postings" |
| `/inventory/products` | "Koji proizvodi imaju najmanji lager?" / "Which products have lowest stock?", "Koliko artikala je bez cene?" / "How many items have no price?" |
| `/inventory/stock` | "Koji magacini su najpuniji?" / "Which warehouses are fullest?", "Ima li negativnih zaliha?" / "Any negative stock levels?" |
| `/hr/employees` | "Koliko zaposlenih imam po odeljenju?" / "How many employees per department?", "Ko ima ugovor koji uskoro istice?" / "Who has contracts expiring soon?" |
| `/hr/payroll` | "Kakav je ukupan trosak plata?" / "What's the total payroll cost?", "Ima li anomalija u obracunu?" / "Any anomalies in payroll?" |
| `/pos/terminal` | "Kolika je danasnja prodaja?" / "What's today's sales total?", "Koji artikli se najvise prodaju?" / "Which items sell most?" |
| `/documents` | "Koliko dokumenata ceka odobrenje?" / "How many docs pending approval?", "Koji dokumenti uskoro isticu?" / "Which docs expire soon?" |
| `/production/orders` | "Koji nalozi su u kasjenju?" / "Which orders are delayed?", "Koliko je iskoriscenost kapaciteta?" / "What's the capacity utilization?" |
| `/settings` | "Koji korisnici su neaktivni?" / "Which users are inactive?", "Ima li nedovrsenih podesavanja?" / "Any incomplete settings?" |
| `/returns` | "Koliko imam otvorenih reklamacija?" / "How many open returns?", "Koji proizvodi imaju najvise povrata?" / "Which products have most returns?" |
| `/web` | "Koliko imam online porudzbina?" / "How many online orders?", "Kakav je trend web prodaje?" / "What's the web sales trend?" |

## Files Modified
- `src/layouts/TenantLayout.tsx` -- change `min-h-screen` to `h-screen` on line 449
- `src/components/ai/AiContextSidebar.tsx` -- add ~20 new sub-page question entries to the `SUGGESTED_QUESTIONS` array
