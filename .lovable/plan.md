

# Next Improvements for the Bank Module & Broader System

After reviewing the current state of `BankAccounts.tsx`, `BankStatements.tsx`, `BankDocumentImport.tsx`, and `AccountingHub.tsx`, here are the most impactful improvements ranked by value.

---

## 1. Auto-detect bank from RSD account number (HIGH)

Serbian dinar accounts don't use IBAN, but the account number format `XXX-XXXXXXXXX-XX` still contains the 3-digit bank code in the first segment. Currently, bank auto-detection only works via IBAN (which is now hidden for RSD). We should parse the bank code from the RSD account number too.

**Change**: In `BankAccounts.tsx`, when `currency === "RSD"` and the user types an account number matching `^\d{3}-`, extract the first 3 digits and auto-fill bank from the `banks` registry — same as the IBAN flow does.

---

## 2. Account number format validation for RSD (HIGH)

Serbian RSD accounts follow the format `XXX-XXXXXXXXXX-XX` (3 digits, dash, 10+ digits, dash, 2 digits). Add real-time validation with a visual indicator, similar to how IBAN validation works for foreign currency accounts.

**Change**: Add a `validateRSDAccount()` function and show check/error below the account number input when `currency === "RSD"`.

---

## 3. Bulk confirm suggested matches on BankStatements (MEDIUM)

The auto-match algorithm already produces `suggested` status lines (confidence 40-69%), but there's no way to approve them in bulk. Users must manually match each one.

**Change**: In `BankStatements.tsx`, add a "Confirm all suggestions" button that upgrades all `suggested` lines to `matched` status in one operation.

---

## 4. Filter statement lines by match status (MEDIUM)

The statement detail view shows all lines in a single list. For statements with 100+ lines, users need to quickly see only unmatched or suggested lines.

**Change**: Add a `TabsList` or filter dropdown above the statement lines table to filter by `unmatched`, `suggested`, `matched`, `posted`.

---

## 5. Link "Izvodi" and "Uvoz" buttons on account cards to that specific account (LOW)

Currently, the card buttons navigate to `/accounting/bank-statements` and `/accounting/document-import` without any account context. They should pre-filter for the specific bank account.

**Change**: Pass `?account_id=XXX` query param and read it on the target pages to pre-select the account filter.

---

## Proposed Implementation Order

| Step | What | Files |
|------|-------|-------|
| 1 | RSD account number bank auto-detection | `BankAccounts.tsx` |
| 2 | RSD format validation (`XXX-XXXXXXXXXX-XX`) | `BankAccounts.tsx` |
| 3 | Bulk confirm suggested matches | `BankStatements.tsx` |
| 4 | Statement lines filter by match status | `BankStatements.tsx` |
| 5 | Account-specific navigation from cards | `BankAccounts.tsx`, `BankStatements.tsx`, `BankDocumentImport.tsx` |

All changes are UI-only, no database migrations needed.

