

# CRM Phase 2 Testing + Company Detail Polish

## Part 1: CRM Phase 2 -- Already Implemented (Verification)

All four CRM Phase 2 feature blocks are already in the codebase:

1. **Expiring Quotes Widget** -- Present in `CrmDashboard.tsx` (lines 120-344). Queries quotes with `status = 'sent'` and `valid_until` within 3 days. Shows amber warning icons. Conditionally renders only when there are expiring quotes.

2. **Discount Approval Badge** -- `DiscountApprovalBadge.tsx` exists. Integrated into the Quotes list status column. Uses `useDiscountApproval` hook.

3. **Discount Rules Settings** -- `DiscountApprovalRules.tsx` exists with full CRUD (add/edit/delete rules by role, max %, approval threshold). Route registered in `App.tsx`.

4. **Discount Approval Integration** -- `useDiscountApproval.ts` hook connects to `approval_workflows` / `approval_requests` with `entity_type = 'quote_discount'`. Blocks "Send" in the quote form when approval is needed.

No code changes needed for Phase 2.

---

## Part 2: Company Detail Page Polish

The `CompanyDetail.tsx` page is missing several useful sections that would provide a 360-degree view of the company. Here are the improvements:

### 2.1 Add Related Opportunities Tab
- Query the `opportunities` table filtered by `partner_id = id`
- Show a table with title, stage, value, expected close date, salesperson
- Clicking navigates to the opportunity detail page
- This gives users direct visibility into the sales pipeline for a company

### 2.2 Add Related Quotes Tab
- Query the `quotes` table filtered by `partner_id = id`
- Show quote number, date, total, status, version badge
- Clicking navigates to the quotes page
- Provides quote history per company

### 2.3 Add Notes/Description Field to Edit Form
- Include `postal_code` in the edit form (currently visible in read mode but not editable)

### 2.4 Add Quick Stats Summary
- Show a row of summary stats at the top of the overview tab: Total Revenue (sum of paid invoices), Open Balance, Number of Opportunities, Number of Quotes
- Provides at-a-glance financial context

### 2.5 Add "Related Quotes" and "Opportunities" to Tab Bar
- Update the TabsList to include two new tabs: "Opportunities" and "Quotes"

---

## Technical Details

### Files to Modify
| File | Changes |
|------|---------|
| `src/pages/tenant/CompanyDetail.tsx` | Add opportunities query, quotes query, two new tabs, quick stats row in overview |

### New Queries (in CompanyDetail.tsx)
```
// Related Opportunities
supabase.from("opportunities")
  .select("id, title, stage, value, expected_close_date, salespeople(first_name, last_name)")
  .eq("partner_id", id)
  .order("created_at", { ascending: false })
  .limit(20)

// Related Quotes  
supabase.from("quotes")
  .select("id, quote_number, quote_date, total, status, currency, current_version, valid_until")
  .eq("partner_id", id)
  .order("created_at", { ascending: false })
  .limit(20)
```

### Updated Tab Bar
The TabsList will expand from 5 tabs to 7:
- Overview | Contacts | Opportunities | Quotes | Meetings | Invoices | Activities

### Quick Stats Row (Overview Tab)
Four compact stat cards above the Account Health card:
- Total Revenue (sum of paid/posted invoices)
- Outstanding Balance (existing calculation)
- Open Opportunities (count)
- Active Quotes (count of draft/sent quotes)

### No Database Changes Required
All data is already available in existing tables. Only frontend queries and UI additions.

