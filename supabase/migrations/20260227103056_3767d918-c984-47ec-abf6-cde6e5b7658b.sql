-- Insert missing Section 3a entries (reverse charge output counterparts)
INSERT INTO popdv_tax_types (id, description_short, description_long, direction, popdv_section, is_special_record, is_active, sort_order, parent_id)
VALUES
  ('3a',   'PROMET DOBARA I USLUGA ZA KOJI JE PORESKI DUŽNIK PRIMALAC DOBARA I USLUGA — obračunati PDV', NULL, 'OUTPUT', 3, true, true, 340, NULL),
  ('3a.1', 'Prenos prava raspolaganja na građevinskim objektima', NULL, 'OUTPUT', 3, false, true, 341, '3a'),
  ('3a.2', 'Dobra i usluge, osim dobara iz tačke 3a.1, uključujući i promet bez naknade', NULL, 'OUTPUT', 3, false, true, 342, '3a'),
  ('3a.3', 'Promet u okviru delatnosti i promet iz Člana 25, stav 3 Zakona', NULL, 'OUTPUT', 3, false, true, 343, '3a'),
  ('3a.4', 'Dobra i usluge iz inostranstva', NULL, 'OUTPUT', 3, false, true, 344, '3a'),
  ('3a.5', 'Povećanje osnovice, odnosno PDV (obrnuto obračunavanje)', NULL, 'OUTPUT', 3, false, true, 345, '3a'),
  ('3a.6', 'Smanjenje osnovice, odnosno PDV (obrnuto obračunavanje)', NULL, 'OUTPUT', 3, false, true, 346, '3a'),
  ('3a.7', 'Ukupno obračunati PDV (3a.1 do 3a.6)', NULL, 'OUTPUT', 3, true, true, 347, '3a')
ON CONFLICT (id) DO UPDATE SET description_short = EXCLUDED.description_short, direction = EXCLUDED.direction, popdv_section = EXCLUDED.popdv_section, is_special_record = EXCLUDED.is_special_record, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id, is_active = true;

-- Insert missing 8a.7 (advance payments input)
INSERT INTO popdv_tax_types (id, description_short, description_long, direction, popdv_section, is_special_record, is_active, sort_order, parent_id)
VALUES ('8a.7', 'Avansna plaćanja za nabavku dobara i usluga od obveznika PDV', NULL, 'INPUT', 8, false, true, 517, '8a')
ON CONFLICT (id) DO UPDATE SET description_short = EXCLUDED.description_short, direction = EXCLUDED.direction, popdv_section = EXCLUDED.popdv_section, sort_order = EXCLUDED.sort_order, parent_id = EXCLUDED.parent_id, is_active = true;

-- Insert missing 9.06 (advance non-deductible)
INSERT INTO popdv_tax_types (id, description_short, description_long, direction, popdv_section, is_special_record, is_active, sort_order, parent_id)
VALUES ('9.06', '8a - Bez prava odbitka PDV - 8a.7 - Avansna plaćanja za nabavku dobara i usluga', NULL, 'INPUT', 9, false, true, 606, NULL)
ON CONFLICT (id) DO UPDATE SET description_short = EXCLUDED.description_short, direction = EXCLUDED.direction, popdv_section = EXCLUDED.popdv_section, sort_order = EXCLUDED.sort_order, is_active = true;

-- Also insert 9.12 and 9.17 if missing (8v and 8d non-deductible)
INSERT INTO popdv_tax_types (id, description_short, description_long, direction, popdv_section, is_special_record, is_active, sort_order, parent_id)
VALUES
  ('9.12', '8v - Bez prava odbitka PDV - nabavka dobara i usluga od strane lica sa teritorije AP KiM', NULL, 'INPUT', 9, false, true, 612, NULL),
  ('9.17', '8d - Bez prava odbitka PDV - nabavka dobara i usluga od strane lica sa sedištem u inostranstvu koja su obveznici PDV', NULL, 'INPUT', 9, false, true, 617, NULL)
ON CONFLICT (id) DO UPDATE SET description_short = EXCLUDED.description_short, is_active = true;