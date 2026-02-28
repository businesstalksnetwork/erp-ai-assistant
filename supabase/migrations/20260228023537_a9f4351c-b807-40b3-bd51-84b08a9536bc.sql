
-- Add new module definitions for AI toggleable sections and loyalty
INSERT INTO module_definitions (key, name, description, sort_order, icon)
VALUES
  ('ai-wms', 'AI Warehouse', 'AI-powered slotting optimization, cycle count prediction, and labor analytics', 13, 'Brain'),
  ('ai-production', 'AI Production', 'AI scheduling, bottleneck prediction, capacity simulation', 14, 'Sparkles'),
  ('loyalty', 'Loyalty', 'Customer loyalty programs, rewards, and member management', 15, 'Gift')
ON CONFLICT (key) DO NOTHING;
