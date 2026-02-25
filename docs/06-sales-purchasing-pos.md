# Sales, Purchasing & POS

## Sales Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/sales` | SalesHub | Sales dashboard |
| `/sales/orders` | SalesOrders | Sales order list |
| `/sales/orders/new` | SalesOrderForm | Create order |
| `/sales/orders/:id` | SalesOrderForm | Edit order |
| `/sales/quotes` | SalesQuotes | Quote management |
| `/sales/quotes/new` | SalesQuoteForm | Create quote |
| `/sales/quotes/:id` | SalesQuoteForm | Edit quote |
| `/sales/channels` | SalesChannels | Sales channel config |
| `/sales/pos` | PosTerminal | POS terminal |
| `/sales/pos/config` | PosConfig | POS device configuration |
| `/sales/pos/transactions` | PosTransactions | POS transaction history |

## Purchasing Pages

(See also [05-inventory-module.md](./05-inventory-module.md) — Purchasing is part of Inventory routes)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/inventory/purchase-orders` | PurchaseOrders | PO list |
| `/inventory/purchase-orders/new` | PurchaseOrderForm | Create PO |
| `/inventory/supplier-invoices` | SupplierInvoices | Supplier invoice list |
| `/inventory/goods-receipts` | GoodsReceipts | Goods receipt confirmation |

## Database Tables

### Sales
| Table | Key Columns |
|-------|------------|
| `sales_orders` | id, tenant_id, partner_id, order_date, status, total, legal_entity_id |
| `sales_order_lines` | id, sales_order_id, product_id, quantity, unit_price, tax_rate |
| `sales_quotes` | id, tenant_id, partner_id, quote_date, valid_until, status, total |
| `sales_quote_lines` | id, quote_id, product_id, quantity, unit_price |
| `sales_channels` | id, tenant_id, name, channel_type, is_active |

### POS
| Table | Key Columns |
|-------|------------|
| `pos_transactions` | id, tenant_id, terminal_id, transaction_date, total, payment_method, fiscal_receipt_number |
| `pos_transaction_lines` | id, transaction_id, product_id, quantity, unit_price, tax_rate |
| `pos_terminals` | id, tenant_id, name, location, is_active |
| `pos_fiscal_devices` | id, tenant_id, device_serial, device_type |

## GL Posting Touchpoints

### Sales Invoice Posting
```
Invoices.tsx → supabase.rpc("process_invoice_post", {
  p_invoice_id: invoiceId,
  p_default_warehouse_id: warehouseId
})

Server-side RPC:
  1. Creates journal_entry + journal_lines (DR: Receivable, CR: Revenue + VAT)
  2. Calls adjust_inventory_stock for each invoice line (if warehouse specified)
  3. Updates invoice.status = 'posted'
  4. Returns journal_entry_id
```

### POS Sale Posting
```
PosTerminal.tsx → supabase.rpc("process_pos_sale", {
  p_transaction_id: tx.id,
  p_tenant_id: tenantId
})

Server-side RPC:
  1. Creates journal_entry (DR: Cash/Bank, CR: Revenue + VAT)
  2. Updates pos_transactions.journal_entry_id
```

### Supplier Invoice Posting
```
SupplierInvoices.tsx → createCodeBasedJournalEntry({
  lines: [
    { accountCode: "5xxx", debit: amount, credit: 0 },  // Expense
    { accountCode: "2100", debit: 0, credit: amount },   // Accounts Payable
  ]
})
```

## Cross-Module Dependencies

### Sales → Other Modules
| Dependency | Direction | Detail |
|-----------|-----------|--------|
| Partners | reads | Customer on orders/quotes/invoices |
| Products | reads | Line items |
| Inventory | writes | `process_invoice_post` adjusts stock |
| Accounting | writes | Invoice posting creates journal entries |
| Bank | reads | Payment matching by invoice reference |

### Purchasing → Other Modules
| Dependency | Direction | Detail |
|-----------|-----------|--------|
| Partners | reads | Supplier on POs |
| Products | reads | PO line items |
| Inventory | writes | Goods receipt → `adjust_inventory_stock` |
| Accounting | writes | Supplier invoice → `createCodeBasedJournalEntry` |

### POS → Other Modules
| Dependency | Direction | Detail |
|-----------|-----------|--------|
| Products | reads | Terminal product lookup |
| Accounting | writes | `process_pos_sale` creates journal |
| Inventory | writes (planned) | Stock deduction not yet implemented |

## Known Gaps
- POS does not yet deduct inventory stock on sale
- Supplier invoice GL posting uses hardcoded accounts, not posting rules engine
- No credit note / return invoice flow with automatic reversal journal
- Sales order → Invoice conversion does not auto-post
