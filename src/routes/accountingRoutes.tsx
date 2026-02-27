import React from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const AccountingHub = React.lazy(() => import("@/pages/tenant/AccountingHub"));
const ChartOfAccounts = React.lazy(() => import("@/pages/tenant/ChartOfAccounts"));
const JournalEntries = React.lazy(() => import("@/pages/tenant/JournalEntries"));
const Invoices = React.lazy(() => import("@/pages/tenant/Invoices"));
const InvoiceForm = React.lazy(() => import("@/pages/tenant/InvoiceForm"));
const FiscalPeriods = React.lazy(() => import("@/pages/tenant/FiscalPeriods"));
const GeneralLedger = React.lazy(() => import("@/pages/tenant/GeneralLedger"));
const Expenses = React.lazy(() => import("@/pages/tenant/Expenses"));
const Reports = React.lazy(() => import("@/pages/tenant/Reports"));
const TrialBalance = React.lazy(() => import("@/pages/tenant/TrialBalance"));
const IncomeStatement = React.lazy(() => import("@/pages/tenant/IncomeStatement"));
const BalanceSheet = React.lazy(() => import("@/pages/tenant/BalanceSheet"));
const BilansUspeha = React.lazy(() => import("@/pages/tenant/BilansUspeha"));
const BilansStanja = React.lazy(() => import("@/pages/tenant/BilansStanja"));
const BankStatements = React.lazy(() => import("@/pages/tenant/BankStatements"));
const OpenItems = React.lazy(() => import("@/pages/tenant/OpenItems"));
const PdvPeriods = React.lazy(() => import("@/pages/tenant/PdvPeriods"));
const YearEndClosing = React.lazy(() => import("@/pages/tenant/YearEndClosing"));
const FixedAssets = React.lazy(() => import("@/pages/tenant/FixedAssets"));
const AgingReports = React.lazy(() => import("@/pages/tenant/AgingReports"));
const Deferrals = React.lazy(() => import("@/pages/tenant/Deferrals"));
const Loans = React.lazy(() => import("@/pages/tenant/Loans"));
const FxRevaluation = React.lazy(() => import("@/pages/tenant/FxRevaluation"));
const Kompenzacija = React.lazy(() => import("@/pages/tenant/Kompenzacija"));
const RecurringInvoices = React.lazy(() => import("@/pages/tenant/RecurringInvoices"));
const RecurringJournals = React.lazy(() => import("@/pages/tenant/RecurringJournals"));
const IosBalanceConfirmation = React.lazy(() => import("@/pages/tenant/IosBalanceConfirmation"));
const CostCenterPL = React.lazy(() => import("@/pages/tenant/CostCenterPL"));
const CashRegister = React.lazy(() => import("@/pages/tenant/CashRegister"));
const IntercompanyTransactions = React.lazy(() => import("@/pages/tenant/IntercompanyTransactions"));
const ConsolidatedStatements = React.lazy(() => import("@/pages/tenant/ConsolidatedStatements"));
const WithholdingTax = React.lazy(() => import("@/pages/tenant/WithholdingTax"));
const CitTaxReturn = React.lazy(() => import("@/pages/tenant/CitTaxReturn"));
const StatistickiAneks = React.lazy(() => import("@/pages/tenant/StatistickiAneks"));
const KpoBook = React.lazy(() => import("@/pages/tenant/KpoBook"));
const MultiPeriodReports = React.lazy(() => import("@/pages/tenant/MultiPeriodReports"));
const TransferPricing = React.lazy(() => import("@/pages/tenant/TransferPricing"));
const ReportSnapshots = React.lazy(() => import("@/pages/tenant/ReportSnapshots"));
const BankAccounts = React.lazy(() => import("@/pages/tenant/BankAccounts"));
const BankDocumentImport = React.lazy(() => import("@/pages/tenant/BankDocumentImport"));
const CreditDebitNotes = React.lazy(() => import("@/pages/tenant/CreditDebitNotes"));
const ProformaInvoices = React.lazy(() => import("@/pages/tenant/ProformaInvoices"));
const InvoiceRegister = React.lazy(() => import("@/pages/tenant/InvoiceRegister"));

const m = "accounting";

export const accountingRoutes = (
  <>
    <Route path="accounting" element={<ProtectedRoute requiredModule={m}><AccountingHub /></ProtectedRoute>} />
    <Route path="accounting/chart-of-accounts" element={<ProtectedRoute requiredModule={m}><ChartOfAccounts /></ProtectedRoute>} />
    <Route path="accounting/journal" element={<ProtectedRoute requiredModule={m}><JournalEntries /></ProtectedRoute>} />
    <Route path="accounting/invoices" element={<ProtectedRoute requiredModule={m}><Invoices /></ProtectedRoute>} />
    <Route path="accounting/invoices/new" element={<ProtectedRoute requiredModule={m}><InvoiceForm /></ProtectedRoute>} />
    <Route path="accounting/invoices/:id" element={<ProtectedRoute requiredModule={m}><InvoiceForm /></ProtectedRoute>} />
    <Route path="accounting/fiscal-periods" element={<ProtectedRoute requiredModule={m}><FiscalPeriods /></ProtectedRoute>} />
    <Route path="accounting/ledger" element={<ProtectedRoute requiredModule={m}><GeneralLedger /></ProtectedRoute>} />
    <Route path="accounting/expenses" element={<ProtectedRoute requiredModule={m}><Expenses /></ProtectedRoute>} />
    <Route path="accounting/reports" element={<ProtectedRoute requiredModule={m}><Reports /></ProtectedRoute>} />
    <Route path="accounting/reports/trial-balance" element={<ProtectedRoute requiredModule={m}><TrialBalance /></ProtectedRoute>} />
    <Route path="accounting/reports/income-statement" element={<ProtectedRoute requiredModule={m}><IncomeStatement /></ProtectedRoute>} />
    <Route path="accounting/reports/balance-sheet" element={<ProtectedRoute requiredModule={m}><BalanceSheet /></ProtectedRoute>} />
    <Route path="accounting/reports/bilans-uspeha" element={<ProtectedRoute requiredModule={m}><BilansUspeha /></ProtectedRoute>} />
    <Route path="accounting/reports/bilans-stanja" element={<ProtectedRoute requiredModule={m}><BilansStanja /></ProtectedRoute>} />
    <Route path="accounting/reports/aging" element={<ProtectedRoute requiredModule={m}><AgingReports /></ProtectedRoute>} />
    <Route path="accounting/reports/cost-center-pl" element={<ProtectedRoute requiredModule={m}><CostCenterPL /></ProtectedRoute>} />
    <Route path="accounting/reports/consolidated" element={<ProtectedRoute requiredModule={m}><ConsolidatedStatements /></ProtectedRoute>} />
    <Route path="accounting/bank-statements" element={<ProtectedRoute requiredModule={m}><BankStatements /></ProtectedRoute>} />
    <Route path="accounting/open-items" element={<ProtectedRoute requiredModule={m}><OpenItems /></ProtectedRoute>} />
    <Route path="accounting/ios" element={<ProtectedRoute requiredModule={m}><IosBalanceConfirmation /></ProtectedRoute>} />
    <Route path="accounting/pdv" element={<ProtectedRoute requiredModule={m}><PdvPeriods /></ProtectedRoute>} />
    <Route path="accounting/withholding-tax" element={<ProtectedRoute requiredModule={m}><WithholdingTax /></ProtectedRoute>} />
    <Route path="accounting/cit-return" element={<ProtectedRoute requiredModule={m}><CitTaxReturn /></ProtectedRoute>} />
    <Route path="accounting/year-end" element={<ProtectedRoute requiredModule={m}><YearEndClosing /></ProtectedRoute>} />
    <Route path="accounting/fixed-assets" element={<ProtectedRoute requiredModule={m}><FixedAssets /></ProtectedRoute>} />
    <Route path="accounting/deferrals" element={<ProtectedRoute requiredModule={m}><Deferrals /></ProtectedRoute>} />
    <Route path="accounting/loans" element={<ProtectedRoute requiredModule={m}><Loans /></ProtectedRoute>} />
    <Route path="accounting/fx-revaluation" element={<ProtectedRoute requiredModule={m}><FxRevaluation /></ProtectedRoute>} />
    <Route path="accounting/kompenzacija" element={<ProtectedRoute requiredModule={m}><Kompenzacija /></ProtectedRoute>} />
    <Route path="accounting/intercompany" element={<ProtectedRoute requiredModule={m}><IntercompanyTransactions /></ProtectedRoute>} />
    <Route path="accounting/cash-register" element={<ProtectedRoute requiredModule={m}><CashRegister /></ProtectedRoute>} />
    <Route path="accounting/recurring-invoices" element={<ProtectedRoute requiredModule={m}><RecurringInvoices /></ProtectedRoute>} />
    <Route path="accounting/recurring-journals" element={<ProtectedRoute requiredModule={m}><RecurringJournals /></ProtectedRoute>} />
    <Route path="accounting/statisticki-aneks" element={<ProtectedRoute requiredModule={m}><StatistickiAneks /></ProtectedRoute>} />
    <Route path="accounting/kpo-book" element={<ProtectedRoute requiredModule={m}><KpoBook /></ProtectedRoute>} />
    <Route path="accounting/reports/multi-period" element={<ProtectedRoute requiredModule={m}><MultiPeriodReports /></ProtectedRoute>} />
    <Route path="accounting/transfer-pricing" element={<ProtectedRoute requiredModule={m}><TransferPricing /></ProtectedRoute>} />
    <Route path="accounting/report-snapshots" element={<ProtectedRoute requiredModule={m}><ReportSnapshots /></ProtectedRoute>} />
    <Route path="accounting/bank-accounts" element={<ProtectedRoute requiredModule={m}><BankAccounts /></ProtectedRoute>} />
    <Route path="accounting/document-import" element={<ProtectedRoute requiredModule={m}><BankDocumentImport /></ProtectedRoute>} />
    <Route path="accounting/credit-debit-notes" element={<ProtectedRoute requiredModule={m}><CreditDebitNotes /></ProtectedRoute>} />
    <Route path="accounting/proforma-invoices" element={<ProtectedRoute requiredModule={m}><ProformaInvoices /></ProtectedRoute>} />
    <Route path="accounting/invoice-register" element={<ProtectedRoute requiredModule={m}><InvoiceRegister /></ProtectedRoute>} />
  </>
);
