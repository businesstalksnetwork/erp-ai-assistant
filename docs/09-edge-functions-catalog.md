# Edge Functions Catalog

## SEF (e-Invoicing) — 14 functions

| Function | Purpose | Triggers |
|----------|---------|----------|
| `sef-send-invoice` | Send UBL 2.1 XML to Serbian eFaktura | Invoice posting (manual) |
| `sef-check-status` | Poll SEF for invoice status updates | Cron / manual |
| `sef-get-invoice` | Retrieve invoice details from SEF | Manual |
| `sef-cancel-invoice` | Cancel/storno invoice on SEF | Manual |
| `sef-send-advance` | Send advance invoice to SEF | Manual |
| `sef-send-credit-note` | Send credit note to SEF | Manual |
| `sef-get-purchase-invoices` | Fetch incoming purchase invoices from SEF | Cron |
| `sef-accept-purchase-invoice` | Accept incoming invoice | Manual |
| `sef-reject-purchase-invoice` | Reject incoming invoice | Manual |
| `sef-get-companies` | Lookup company data from SEF | Manual |
| `sef-auth` | Authenticate with SEF API | Internal |
| `sef-send-document` | Generic document submission | Internal |
| `sef-webhook` | Receive SEF status callbacks | Webhook |
| `sef-batch-status-check` | Batch status check for pending invoices | Cron |

## AI Services — 6 functions

| Function | Purpose |
|----------|---------|
| `ai-chat` | General AI assistant chat |
| `ai-analyze-financials` | Financial data analysis |
| `ai-categorize-transaction` | Auto-categorize bank transactions |
| `ai-generate-report-narrative` | Generate narrative for financial reports |
| `ai-suggest-accounts` | Suggest GL accounts for transactions |
| `ai-anomaly-detection` | Detect anomalies in financial data |

## Bank — 2 functions

| Function | Purpose |
|----------|---------|
| `parse-bank-xml` | Parse Serbian bank XML (Halcom format) into statement lines |
| `parse-bank-csv` | Parse bank CSV exports |

## Payroll / HR — 3 functions

| Function | Purpose |
|----------|---------|
| `generate-pppd-xml` | Generate PPP-PD XML for tax authority |
| `generate-ovp-xml` | Generate OVP XML |
| `seed-payroll-payment-types` | Seed default payment types |

## Storage — 7 functions

| Function | Purpose |
|----------|---------|
| `upload-document` | Upload document to storage |
| `download-document` | Download document from storage |
| `generate-pdf` | Generate PDF from template |
| `generate-invoice-pdf` | Generate invoice PDF |
| `generate-payslip-pdf` | Generate payslip PDF |
| `process-ocr` | OCR processing for scanned documents |
| `resize-image` | Image resizing for thumbnails |

## Seed / Import — 8 functions

| Function | Purpose |
|----------|---------|
| `seed-chart-of-accounts` | Seed Serbian standard CoA |
| `seed-tax-rates` | Seed Serbian tax rates |
| `seed-banks` | Seed Serbian bank directory |
| `seed-payroll-categories` | Seed payroll categories |
| `seed-posting-rule-catalog` | Seed legacy posting rule catalog |
| `import-legacy-data` | Import from legacy ERP |
| `import-chart-of-accounts` | Import CoA from CSV/Excel |
| `import-partners` | Import partners from CSV |

## Notifications — 3 functions

| Function | Purpose |
|----------|---------|
| `send-email` | Send transactional email |
| `send-notification` | Push notification |
| `notify-approval` | Notify approvers of pending requests |

## Utility — misc

| Function | Purpose |
|----------|---------|
| `exchange-rates` | Fetch NBS exchange rates |
| `validate-tax-id` | Validate Serbian PIB/MB |
| `generate-qr-code` | Generate QR code for invoices |
| `health-check` | System health check |

## Dependencies

### External APIs
| API | Used By |
|-----|---------|
| Serbian eFaktura (SEF) | sef-* functions |
| NBS Exchange Rates | exchange-rates |
| OpenAI / Anthropic | ai-* functions |
| SMTP | send-email |

### Secrets Required
| Secret | Used By |
|--------|---------|
| `SEF_API_KEY` | sef-* functions |
| `SEF_API_URL` | sef-* functions |
| `OPENAI_API_KEY` | ai-* functions |
| `SMTP_HOST/USER/PASS` | send-email |
| `SUPABASE_SERVICE_ROLE_KEY` | All functions (auto-configured) |
