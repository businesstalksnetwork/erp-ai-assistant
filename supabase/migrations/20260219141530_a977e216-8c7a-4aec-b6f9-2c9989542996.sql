INSERT INTO module_definitions (key, name, description)
VALUES ('analytics', 'Analytics & BI', 'Financial ratios, profitability, cashflow forecasts, and business intelligence')
ON CONFLICT (key) DO NOTHING;