
## Create Module Hub Pages for All Missing Parent Routes

### Problem
Navigating to parent module routes like `/accounting`, `/production`, `/inventory`, `/hr`, `/purchasing`, `/sales`, `/pos`, and `/web` shows a 404 error. These routes have no page component registered. Each module needs a hub/summary page showing an overview of the module and cards linking to all sub-pages within it.

Note: `/crm`, `/documents`, and `/analytics` already have working pages.

### Solution
Create 8 new module hub pages and register them in the router. Each page will:
- Use the existing `BiPageLayout` component for consistent styling
- Show a module description in Serbian Latin (professional language)
- Display clickable cards for each sub-section with icons and short descriptions
- All text fully translated in Serbian Latin

### New Files to Create (8)

#### 1. `src/pages/tenant/AccountingHub.tsx`
Module summary for Računovodstvo with cards linking to:
- Kontni plan (`/accounting/chart-of-accounts`)
- Knjiženja (`/accounting/journal`)
- Fakture (`/accounting/invoices`)
- Glavna knjiga (`/accounting/ledger`)
- Izvodi (`/accounting/bank-statements`)
- Otvorene stavke (`/accounting/open-items`)
- PDV periodi (`/accounting/pdv`)
- Fiskalni periodi (`/accounting/fiscal-periods`)
- Osnovna sredstva (`/accounting/fixed-assets`)
- Razgraničenja (`/accounting/deferrals`)
- Krediti (`/accounting/loans`)
- Troškovi (`/accounting/expenses`)
- Revalorizacija (`/accounting/fx-revaluation`)
- Kompenzacija (`/accounting/kompenzacija`)
- Zaključak godine (`/accounting/year-end`)
- Izveštaji (`/accounting/reports`)

#### 2. `src/pages/tenant/ProductionHub.tsx`
Module summary for Proizvodnja with cards linking to:
- Sastavnice (BOM) (`/production/bom`)
- Radni nalozi (`/production/orders`)
- AI planiranje (`/production/ai-planning`)

#### 3. `src/pages/tenant/InventoryHub.tsx`
Module summary for Magacin with cards linking to:
- Proizvodi (`/inventory/products`)
- Stanje zaliha (`/inventory/stock`)
- Kretanje zaliha (`/inventory/movements`)
- Otpremnice (`/inventory/dispatch-notes`)
- Troškovni slojevi (`/inventory/cost-layers`)
- Interne narudžbine (`/inventory/internal-orders`)
- Interni transferi (`/inventory/internal-transfers`)
- Interne prijemnice (`/inventory/internal-receipts`)
- Kalkulacija (`/inventory/kalkulacija`)
- Nivelacija (`/inventory/nivelacija`)
- WMS kontrolna tabla (`/inventory/wms/dashboard`)

#### 4. `src/pages/tenant/HrHub.tsx`
Module summary for Ljudski resursi with cards linking to:
- Zaposleni (`/hr/employees`)
- Ugovori (`/hr/contracts`)
- Odeljenja (`/hr/departments`)
- Evidencija prisustva (`/hr/attendance`)
- Zahtevi za odsustvo (`/hr/leave-requests`)
- Obračun zarada (`/hr/payroll`)
- Evidencija rada (`/hr/work-logs`)
- Prekovremeni rad (`/hr/overtime`)
- Noćni rad (`/hr/night-work`)
- Godišnji odmor (`/hr/annual-leave`)
- Praznici (`/hr/holidays`)
- Odbici (`/hr/deductions`)
- Dodaci (`/hr/allowances`)
- Spoljni saradnici (`/hr/external-workers`)
- Istorija plata (`/hr/salaries`)
- Osiguranje (`/hr/insurance`)
- Šabloni pozicija (`/hr/position-templates`)
- eBolovanje (`/hr/ebolovanje`)
- HR izveštaji (`/hr/reports`)

#### 5. `src/pages/tenant/PurchasingHub.tsx`
Module summary for Nabavka with cards linking to:
- Narudžbenice (`/purchasing/orders`)
- Prijemnice (`/purchasing/goods-receipts`)
- Ulazne fakture (`/purchasing/supplier-invoices`)

#### 6. `src/pages/tenant/SalesHub.tsx`
Module summary for Prodaja with cards linking to:
- Ponude (`/sales/quotes`)
- Prodajni nalozi (`/sales/sales-orders`)
- Kanali prodaje (`/sales/sales-channels`)
- Prodavci (`/sales/salespeople`)
- Učinak prodaje (`/sales/sales-performance`)
- Maloprodajne cene (`/sales/retail-prices`)

#### 7. `src/pages/tenant/PosHub.tsx`
Module summary for Maloprodaja (POS) with cards linking to:
- POS terminal (`/pos/terminal`)
- Sesije (`/pos/sessions`)
- Fiskalni uređaji (`/pos/fiscal-devices`)
- Dnevni izveštaj (`/pos/daily-report`)

#### 8. `src/pages/tenant/WebHub.tsx`
Module summary for Web prodaja with cards linking to:
- Web podešavanja (`/web/settings`)
- Web cene (`/web/prices`)

### File to Modify (1)

#### `src/App.tsx`
- Import all 8 new hub pages (lazy-loaded)
- Register routes: `/accounting`, `/production`, `/inventory`, `/hr`, `/purchasing`, `/sales`, `/pos`, `/web`

### Technical Details

Each hub page follows the same pattern:
- Uses `BiPageLayout` with module icon and Serbian description
- Renders a responsive grid of `Card` components (each linking to a sub-page)
- Each card has an icon, translated title, and short Serbian description
- All strings are hardcoded Serbian Latin (since the app targets the Serbian market and the user explicitly requested professional Serbian language)
- No new dependencies required
