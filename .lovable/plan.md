

# Employee Module Polish + Position Template Dropdown in Add Form

## What This Does

Completes the remaining items from the Employee Detail plan that weren't fully applied, and adds inline contract creation from the Employee Detail page.

---

## Changes

### 1. Position Template Dropdown in Employees.tsx Add/Edit Form

The `Employees.tsx` form still uses a plain `<Input>` for position (line 213). Update it to match the `EmployeeDetail.tsx` edit form pattern:
- Fetch `position_templates` for the tenant (same query already in EmployeeDetail)
- Replace the position text input with a `<Select>` dropdown when templates exist
- Show a manual fallback text input when "Manual" is selected or no templates exist
- Auto-fill `position` text from template name when a template is selected

### 2. Inline Contract Creation from Employee Detail

The Contracts tab on the Employee Detail page currently only shows a read-only list. Add:
- An "Add Contract" button at the top of the Contracts tab
- A dialog (reusing the same form pattern from `EmployeeContracts.tsx`) pre-filled with the current employee's ID
- After saving, refresh the contracts list for that employee

### 3. Inline Salary Record Creation from Employee Detail

Same pattern for the Salaries tab:
- "Add Salary" button
- Simple dialog with amount, amount_type (net/gross), start_date, end_date
- Pre-filled with employee_id

---

## Technical Details

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/tenant/Employees.tsx` | Add `position_templates` query; replace position `Input` with `Select` dropdown + manual fallback (same pattern as EmployeeDetail lines 494-514) |
| `src/pages/tenant/EmployeeDetail.tsx` | Add "Add Contract" button + dialog on contracts tab; Add "Add Salary" button + dialog on salaries tab |

### Position Template Dropdown Logic

```text
1. Fetch position_templates WHERE tenant_id = current AND is_active = true
2. If templates exist:
   - Show Select dropdown with all templates + "Manual" option
   - On select: set position_template_id and auto-fill position text
   - If "Manual" selected: show additional text input for position
3. If no templates: show plain text input (current behavior)
```

### Contract Dialog Fields
- contract_type: Select (indefinite, fixed_term, temporary, contract)
- start_date, end_date: date inputs
- gross_salary, net_salary: number inputs
- working_hours_per_week: number (default 40)
- currency: Select (RSD, EUR, USD)
- is_active: Switch (default true)
- employee_id: auto-set from URL param (hidden)

### Salary Dialog Fields
- amount: number input
- amount_type: Select (net, gross)
- start_date: date input
- end_date: date input (optional)
- employee_id: auto-set from URL param (hidden)

