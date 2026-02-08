

# Plan: Prikazati `trial_expired_admin` šablon u Email editoru

## Problem

Novi email šablon `trial_expired_admin` je dodat u bazu, ali se ne prikazuje u Email editoru jer nije uključen ni u jednu kategoriju u `TEMPLATE_CATEGORIES` objektu.

## Rešenje

Dodati `trial_expired_admin` u kategoriju "Trial" u fajlu `src/components/EmailTemplateEditor.tsx`.

## Tehnički detalji

Fajl: `src/components/EmailTemplateEditor.tsx`

Trenutno stanje kategorije "trial":
```text
trial: {
  label: "Trial",
  icon: Clock,
  keys: ["trial_expiring_7_days", "trial_expiring_3_days", "trial_expiring_1_day"],
},
```

Novo stanje -- dodaje se `trial_expired_admin` u listu ključeva:
```text
trial: {
  label: "Trial",
  icon: Clock,
  keys: ["trial_expiring_7_days", "trial_expiring_3_days", "trial_expiring_1_day", "trial_expired_admin"],
},
```

To je jedina potrebna izmena. Šablon će se odmah pojaviti u "Trial" tabu Email editora.

