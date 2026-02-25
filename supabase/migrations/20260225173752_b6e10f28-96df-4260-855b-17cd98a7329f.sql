
-- Seed new payment model codes into the global payment_models catalog.
INSERT INTO public.payment_models (code, name_en, name_sr, direction, affects_bank, requires_invoice, allows_partial, is_system, description)
VALUES
  ('GOODS_RECEIPT', 'Goods Receipt', 'Prijem robe', 'IN', false, true, false, true, 'Inventory receipt GL posting'),
  ('SUPPLIER_INVOICE_POST', 'Supplier Invoice Post', 'Knjiženje fakture dobavljača', 'OUT', false, true, false, true, 'Supplier invoice approval GL posting'),
  ('SUPPLIER_INVOICE_PAYMENT', 'Supplier Invoice Payment', 'Plaćanje fakture dobavljača', 'OUT', true, true, true, true, 'Supplier invoice payment GL posting'),
  ('CUSTOMER_RETURN_RESTOCK', 'Customer Return Restock', 'Povrat kupca - zalihe', 'IN', false, false, false, true, 'COGS reversal on customer return'),
  ('CUSTOMER_RETURN_CREDIT', 'Customer Return Credit', 'Povrat kupca - odobrenje', 'OUT', false, false, false, true, 'Credit note to customer'),
  ('SUPPLIER_RETURN', 'Supplier Return', 'Povrat dobavljaču', 'OUT', false, true, false, true, 'Return goods to supplier'),
  ('CREDIT_NOTE_ISSUED', 'Credit Note Issued', 'Izdato knjižno odobrenje', 'OUT', false, false, false, true, 'Credit note issuance'),
  ('LOAN_PAYMENT_PAYABLE', 'Loan Repayment', 'Otplata kredita', 'OUT', true, false, true, true, 'Loan repayment GL posting'),
  ('LOAN_PAYMENT_RECEIVABLE', 'Loan Disbursement', 'Isplata kredita', 'IN', true, false, true, true, 'Loan receipt/disbursement GL posting'),
  ('COMPENSATION', 'Compensation', 'Kompenzacija', 'INTERNAL', false, false, false, true, 'Mutual debt offset (kompenzacija)'),
  ('ASSET_DEPRECIATION', 'Asset Depreciation', 'Amortizacija', 'INTERNAL', false, false, false, true, 'Monthly depreciation posting'),
  ('ASSET_DISPOSAL', 'Asset Disposal', 'Rashodovanje', 'INTERNAL', false, false, false, true, 'Fixed asset disposal/sale'),
  ('FX_GAIN', 'FX Gain', 'Kursni dobitak', 'INTERNAL', false, false, false, true, 'Foreign exchange gain'),
  ('FX_LOSS', 'FX Loss', 'Kursni gubitak', 'INTERNAL', false, false, false, true, 'Foreign exchange loss'),
  ('DEFERRAL_REVENUE', 'Deferral Revenue', 'Razgraničenje prihoda', 'INTERNAL', false, false, false, true, 'Deferred revenue recognition'),
  ('DEFERRAL_EXPENSE', 'Deferral Expense', 'Razgraničenje rashoda', 'INTERNAL', false, false, false, true, 'Deferred expense recognition'),
  ('CASH_IN', 'Cash Receipt', 'Blagajnički primitak', 'IN', false, false, false, true, 'Cash register receipt'),
  ('CASH_OUT', 'Cash Disbursement', 'Blagajnički izdatak', 'OUT', false, false, false, true, 'Cash register disbursement'),
  ('INTERCOMPANY_POST', 'Intercompany Post', 'Međukompanijsko knjiženje', 'INTERNAL', false, false, false, true, 'Intercompany transaction GL posting'),
  ('PAYROLL_NET', 'Payroll Net Salary', 'Neto zarada', 'OUT', true, false, false, true, 'Net salary payment posting'),
  ('PAYROLL_TAX', 'Payroll Tax', 'Porezi i doprinosi', 'OUT', true, false, false, true, 'Payroll tax and contributions posting')
ON CONFLICT (code) DO NOTHING;
