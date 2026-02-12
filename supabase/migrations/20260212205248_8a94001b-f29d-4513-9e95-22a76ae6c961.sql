
INSERT INTO public.module_definitions (key, name, description)
VALUES ('web', 'Web Sales', 'E-commerce connections (Shopify, WooCommerce, Custom) and web pricing')
ON CONFLICT DO NOTHING;
