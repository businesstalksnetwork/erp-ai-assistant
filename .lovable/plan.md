

# Wire New Edge Functions & RPCs to UI

## Scope

Four areas of work: (1) wire 3 edge functions to download buttons, (2) add PDV settlement journal button, (3) add seed posting rules button, (4) add tax payment order generation UI.

## Changes

### 1. PdvPeriods.tsx — Add PP-PDV XML Download + Settlement Journal Button

**File: `src/pages/tenant/PdvPeriods.tsx`**

In the period detail view (after the back button, around line 370-390), add two new buttons:

- **"Preuzmi PP-PDV XML"** button — calls `supabase.functions.invoke("generate-pppdv-xml", { body: { tenant_id, pdv_period_id } })`, receives `{ xml, filename }` JSON, creates a Blob and triggers browser download.
- **"Zatvori PDV — Knjiženje"** button (only visible when status is `submitted`) — calls `supabase.rpc("create_pdv_settlement_journal", { p_pdv_period_id, p_tenant_id })` to auto-generate the VAT settlement journal entry (D:4700/C:2700). Shows success toast with journal entry reference.

Both buttons go in the action bar next to the existing ExportButton and DownloadPdfButton (lines 375-389).

Add two new mutations:
```typescript
const generatePppdvXml = useMutation({
  mutationFn: async (periodId: string) => {
    const { data, error } = await supabase.functions.invoke("generate-pppdv-xml", {
      body: { tenant_id: tenantId, pdv_period_id: periodId },
    });
    if (error) throw error;
    // Download XML
    const blob = new Blob([data.xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = data.filename; a.click();
    URL.revokeObjectURL(url);
  },
  onSuccess: () => toast({ title: t("success") }),
  onError: (e) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
});

const settlePdvMutation = useMutation({
  mutationFn: async (periodId: string) => {
    const { data, error } = await supabase.rpc("create_pdv_settlement_journal" as any, {
      p_pdv_period_id: periodId,
      p_tenant_id: tenantId,
    });
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["pdv_periods"] });
    toast({ title: "PDV knjiženje kreirano", description: "Nalog za knjiženje PDV obaveze/pretplate je automatski generisan." });
  },
  onError: (e) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
});
```

UI buttons in the detail header area:
```tsx
<Button variant="outline" size="sm" onClick={() => generatePppdvXml.mutate(selectedPeriod.id)} disabled={generatePppdvXml.isPending}>
  <FileDown className="h-4 w-4 mr-2" />PP-PDV XML
</Button>
{selectedPeriod.status === "submitted" && (
  <Button variant="outline" size="sm" onClick={() => settlePdvMutation.mutate(selectedPeriod.id)} disabled={settlePdvMutation.isPending}>
    <BookOpen className="h-4 w-4 mr-2" />Zatvori PDV
  </Button>
)}
```

Import `BookOpen` from lucide-react (already importing `FileDown`).

### 2. BilansStanja.tsx — Add APR XML Export Button

**File: `src/pages/tenant/BilansStanja.tsx`**

Add a new button in the `actions` prop of PageHeader (line 162-192), next to ExportButton and DownloadPdfButton:

```tsx
<Button variant="outline" size="sm" onClick={handleAprXmlExport} disabled={aprExporting}>
  <FileDown className="h-4 w-4 mr-2" />APR XML
</Button>
```

Add state + handler:
```typescript
const [aprExporting, setAprExporting] = useState(false);
const handleAprXmlExport = async () => {
  setAprExporting(true);
  try {
    const { data, error } = await supabase.functions.invoke("generate-apr-xml", {
      body: { tenant_id: tenantId, report_type: "bilans_stanja", year: new Date(asOfDate).getFullYear(), legal_entity_id: legalEntityId || null },
    });
    if (error) throw error;
    const blob = new Blob([data.xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = data.filename; a.click();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    toast({ title: "Greška", description: e.message, variant: "destructive" });
  } finally { setAprExporting(false); }
};
```

Import `FileDown` from lucide-react, `useToast`, and `Button`.

### 3. BilansUspeha.tsx — Add APR XML Export Button

**File: `src/pages/tenant/BilansUspeha.tsx`**

Same pattern as BilansStanja — add APR XML button in the actions area (line 93-122):

```tsx
<Button variant="outline" size="sm" onClick={handleAprXmlExport} disabled={aprExporting}>
  <FileDown className="h-4 w-4 mr-2" />APR XML
</Button>
```

Body params: `{ tenant_id, report_type: "bilans_uspeha", year: new Date(dateTo).getFullYear(), legal_entity_id }`.

### 4. PdvPeriods.tsx — Add Tax Payment Order Button

In the period detail view, when status is `submitted` or `closed`, add a button to generate a tax payment order for the PDV liability:

```tsx
{(selectedPeriod.status === "submitted" || selectedPeriod.status === "closed") && Number(selectedPeriod.vat_liability) > 0 && (
  <Button variant="outline" size="sm" onClick={() => generateTaxPaymentOrder.mutate(selectedPeriod)} disabled={generateTaxPaymentOrder.isPending}>
    <FileDown className="h-4 w-4 mr-2" />Nalog za plaćanje
  </Button>
)}
```

Mutation calls `generate-tax-payment-orders` with `{ tenant_id, tax_type: "pdv", amount: selectedPeriod.vat_liability, period_month, period_year }` and displays the payment order details in a toast or downloads as JSON.

### 5. PostingRules.tsx — Add Seed Extended Rules Button

**File: `src/pages/tenant/PostingRules.tsx`**

Add a button in the header area (alongside the existing "+" button) that calls the `seed_extended_posting_rules` RPC:

```tsx
<Button variant="outline" onClick={() => seedRulesMutation.mutate()} disabled={seedRulesMutation.isPending}>
  <Sparkles className="h-4 w-4 mr-2" />Generiši pravila
</Button>
```

Mutation:
```typescript
const seedRulesMutation = useMutation({
  mutationFn: async () => {
    const { error } = await supabase.rpc("seed_extended_posting_rules" as any, { p_tenant_id: tenantId });
    if (error) throw error;
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["posting_rules_v2"] });
    qc.invalidateQueries({ queryKey: ["payment_models"] });
    toast({ title: "Uspešno", description: "Proširena pravila knjiženja su generisana za sve nove tipove dokumenata." });
  },
  onError: (e) => toast({ title: t("error"), description: e.message, variant: "destructive" }),
});
```

`Sparkles` is already imported on line 16.

### 6. Translations

**File: `src/i18n/translations.ts`**

Add new keys:
- `generatePppdvXml` / `closePdvJournal` / `taxPaymentOrder` / `seedPostingRules`
- Serbian equivalents

## Summary

| File | Change | Lines Affected |
|------|--------|---------------|
| `PdvPeriods.tsx` | Add 3 mutations (PP-PDV XML, settlement journal, tax payment order) + 3 buttons | ~60 lines added |
| `BilansStanja.tsx` | Add APR XML export button + handler | ~25 lines added |
| `BilansUspeha.tsx` | Add APR XML export button + handler | ~25 lines added |
| `PostingRules.tsx` | Add seed rules button + mutation | ~20 lines added |
| `translations.ts` | New translation keys | ~10 lines added |

All edge functions return `{ xml, filename }` JSON — the download pattern is identical: create Blob, create object URL, trigger `<a>` click, revoke URL. The `generate-tax-payment-orders` returns `{ paymentOrder }` JSON which will be displayed in a dialog or downloaded.

No database changes needed — all RPCs and edge functions already exist from the previous implementation.

