

# Fix EmployeeDetail "Not Found" Handling

## Problem

After re-seeding demo data, employee UUIDs change. If a user has an old employee detail URL bookmarked or cached, the page shows only "Nema rezultata" with no header, no navigation, and no way back. This is a poor user experience.

## Fix

Update `src/pages/tenant/EmployeeDetail.tsx` line 282 to show a proper "employee not found" state with:

- A clear message ("Employee not found" / "Zaposleni nije pronadjen")
- A back button/link to `/hr/employees`
- Use the existing `ArrowLeft` icon pattern already in the component

### Code Change

Replace:
```typescript
if (!employee) return <div className="text-center py-12 text-muted-foreground">{t("noResults")}</div>;
```

With:
```typescript
if (!employee) return (
  <div className="text-center py-12 space-y-4">
    <p className="text-muted-foreground">{t("noResults")}</p>
    <Button variant="outline" onClick={() => navigate("/hr/employees")}>
      <ArrowLeft className="h-4 w-4 mr-2" />{t("employees")}
    </Button>
  </div>
);
```

### File Modified

| File | Change |
|---|---|
| `src/pages/tenant/EmployeeDetail.tsx` | Replace empty "noResults" state with a proper not-found message and back button |

