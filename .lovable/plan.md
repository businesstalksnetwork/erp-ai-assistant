

## Premesti logo u sidebar, obriši iz AiBriefing stranice

### Izmene

1. **`src/pages/tenant/AiBriefing.tsx`**
   - Obrisati import `erpAiLogo`
   - Obrisati `<div className="flex justify-center">` blok sa `<img>` tagom (linije 165-167)

2. **`src/layouts/TenantLayout.tsx`**
   - Importovati logo: `import erpAiLogo from "@/assets/erpAI.png"`
   - Zameniti trenutni sidebar header (linije 317-325) koji koristi Sparkles ikonu i tekst "ERP-AI" sa `<img>` tagom koji prikazuje uploadovani logo
   - Logo ce biti centriran u sidebar header-u, sa odgovarajucom velicinom (~140px max-width)

### Fajlovi za izmenu

| Fajl | Izmena |
|------|--------|
| `src/pages/tenant/AiBriefing.tsx` | Obrisati logo import i img element |
| `src/layouts/TenantLayout.tsx` | Dodati logo sliku umesto Sparkles ikone u sidebar header |

