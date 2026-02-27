

## Fix Role Display Names in Role Permissions Page

The role dropdown currently shows raw internal values like `Finance_director`, `Hr_manager`, `Sales_manager`. These need proper human-readable labels in both EN and SR.

### Changes

**`src/i18n/translations.ts`**
Add translation keys for all tenant roles:

| Key | EN | SR |
|-----|----|----|
| `roleAdmin` | Administrator | Administrator |
| `roleManager` | Manager | Menadžer |
| `roleFinanceDirector` | Finance Director | Finansijski direktor |
| `roleAccountant` | Accountant | Računovođa |
| `roleHrManager` | HR Manager | HR menadžer |
| `roleHrStaff` | HR Staff | HR osoblje |
| `roleSalesManager` | Sales Manager | Menadžer prodaje |
| `roleSalesRep` | Sales Representative | Prodajni predstavnik |
| `roleSales` | Sales | Prodaja |
| `roleHr` | Human Resources | Ljudski resursi |
| `roleStoreManager` | Store Manager | Menadžer prodavnice |
| `roleStore` | Store | Prodavnica |
| `roleCashier` | Cashier | Kasir |
| `roleWarehouseManager` | Warehouse Manager | Menadžer magacina |
| `roleWarehouseWorker` | Warehouse Worker | Magacioner |
| `roleProductionManager` | Production Manager | Menadžer proizvodnje |
| `roleProductionWorker` | Production Worker | Radnik u proizvodnji |
| `roleUser` | User | Korisnik |
| `roleViewer` | Viewer | Pregledač |

**`src/pages/tenant/RolePermissions.tsx`**
- Add a `ROLE_LABELS` map: `Record<TenantRole, string>` mapping each role to its translation key (e.g., `"admin" → "roleAdmin"`)
- In the `<SelectItem>` for roles, use `t(ROLE_LABELS[r])` instead of raw `{r}`
- Same for any other place the role name is displayed on this page

This keeps the internal `value` as the database key while showing proper translated names.

