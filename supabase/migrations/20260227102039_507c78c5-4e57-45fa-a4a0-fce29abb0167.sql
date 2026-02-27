
-- =============================================================
-- Fix POPDV seed data: delete all wrong entries, insert correct
-- =============================================================

-- No FK references exist in invoice_lines/supplier_invoice_lines (verified empty)

-- 1) Wipe existing wrong data
DELETE FROM popdv_tax_types;

-- 2) Insert correct entries from official POPDV Excel catalogs
-- OUTPUT entries (izlazne_fakture)
INSERT INTO popdv_tax_types (id, description_short, direction, is_special_record, parent_id, popdv_section, sort_order, is_active) VALUES
-- Section 1
('1',     'PROMET DOBARA I USLUGA ZA KOJI JE PROPISANO PORESKO OSLOBOĐENJE SA PRAVOM NA ODBITAK PRETHODNOG POREZA', 'OUTPUT', false, NULL, 1, 100, true),
('1.1',   'Promet dobara koja se otpremaju u inostranstvo, uključujući i povećanje, odnosno smanjenje naknade za taj promet', 'OUTPUT', false, NULL, 1, 110, true),
('1.2',   'Promet dobara koja se otpremaju na teritoriju AP Kosovo i Metohija, uključujući i povećanje, odnosno smanjenje naknade za taj promet', 'OUTPUT', false, NULL, 1, 120, true),
('1.3',   'Promet dobara koja se unose u slobodnu zonu i promet dobara i usluga u slobodnoj zoni, uključujući i povećanje, odnosno smanjenje naknade za taj promet', 'OUTPUT', false, NULL, 1, 130, true),
('1.4',   'Promet dobara i usluga, osim iz tač. 1.1 do 1.3, uključujući i povećanje, odnosno smanjenje naknade za taj promet', 'OUTPUT', false, NULL, 1, 140, true),
('1.4.q', 'Promet iz Člana 24. stav 1. tačka 16) Zakona, odnosno Član 106. Pravilnika', 'OUTPUT', true, '1.4', 1, 141, true),
('1.4.w', 'Promet iz Člana 24. stav 1. tačka 16g) Zakona, odnosno Član 127. Pravilnika', 'OUTPUT', true, '1.4', 1, 142, true),
('1.4.x', 'Promet iz Člana 24. stav 1. tačka 16a) Zakona, odnosno Član 112. Pravilnika', 'OUTPUT', true, '1.4', 1, 143, true),
('1.4.y', 'Promet iz Člana 24. stav 1. tačka 16b) Zakona, odnosno Član 118. Pravilnika', 'OUTPUT', true, '1.4', 1, 144, true),
('1.4.z', 'Promet iz Člana 24. stav 1. tačka 16v) Zakona, odnosno Član 122. Pravilnika', 'OUTPUT', true, '1.4', 1, 145, true),
('1.6',   'Promet dobara i usluga bez naknade', 'OUTPUT', false, NULL, 1, 160, true),

-- Section 2
('2',     'PROMET DOBARA I USLUGA ZA KOJI JE PROPISANO PORESKO OSLOBOĐENJE BEZ PRAVA NA ODBITAK PRETHODNOG POREZA', 'OUTPUT', false, NULL, 2, 200, true),
('2.1',   'Promet novca i kapitala, uključujući i povećanje, odnosno smanjenje naknade za taj promet', 'OUTPUT', false, NULL, 2, 210, true),
('2.2',   'Promet zemljišta i davanje u zakup zemljišta, uključujući i povećanje, odnosno smanjenje naknade za taj promet', 'OUTPUT', false, NULL, 2, 220, true),
('2.3',   'Promet objekata, uključujući i povećanje, odnosno smanjenje naknade za taj promet', 'OUTPUT', false, NULL, 2, 230, true),
('2.4',   'Promet dobara i usluga, osim iz tač. 2.1 do 2.3, uključujući i povećanje, odnosno smanjenje naknade za taj promet', 'OUTPUT', false, NULL, 2, 240, true),
('2.6',   'Promet dobara i usluga bez naknade', 'OUTPUT', false, NULL, 2, 260, true),

-- Section 3
('3',     'OPOREZIVI PROMET DOBARA I USLUGA KOJI VRŠI OBVEZNIK PDV I OBRAČUNATI PDV', 'OUTPUT', false, NULL, 3, 300, true),
('3.1',   'Prvi prenos prava raspolaganja na novoizgrađenim građevinskim objektima za koji je poreski dužnik obveznik PDV koji vrši taj promet', 'OUTPUT', false, NULL, 3, 310, true),
('3.2',   'Promet za koji je poreski dužnik obveznik PDV koji vrši taj promet, osim iz tačke 3.1', 'OUTPUT', false, NULL, 3, 320, true),
('3.2.x', 'Promet za koji je poreski dužnik obveznik PDV koji vrši taj promet, osim iz tačke 3.1 bez obaveze obračunavanja PDV', 'OUTPUT', true, '3.2', 3, 321, true),
('3.3',   'Prenos prava raspolaganja na građevinskim objektima za koji obveznik PDV koji vrši taj promet nije poreski dužnik', 'OUTPUT', false, NULL, 3, 330, true),
('3.4',   'Promet za koji obveznik PDV koji vrši taj promet nije poreski dužnik, osim iz tačke 3.3', 'OUTPUT', false, NULL, 3, 340, true),
('3.5',   'Povećanje osnovice, odnosno PDV', 'OUTPUT', false, NULL, 3, 350, true),
('3.5.x', 'Povećanje osnovice, bez PDV', 'OUTPUT', false, '3.5', 3, 351, true),
('3.6',   'Smanjenje osnovice, odnosno PDV', 'OUTPUT', false, NULL, 3, 360, true),
('3.6.1', 'Smanjenje osnovice, odnosno PDV za promet koji se odnosi na prvi prenos prava raspolaganja na novoizgrađenim objektima', 'OUTPUT', true, '3.6', 3, 361, true),
('3.6.x', 'Smanjenje osnovice, bez PDV', 'OUTPUT', false, '3.6', 3, 362, true),
('3.7',   'Promet dobara i usluga bez naknade', 'OUTPUT', false, NULL, 3, 370, true),
('3.7.x', 'Promet dobara i usluga bez naknade, bez obaveze obračunavanja PDV', 'OUTPUT', true, '3.7', 3, 371, true),

-- Section 4
('4',     'POSEBNI POSTUPCI OPOREZIVANJA', 'BOTH', false, NULL, 4, 400, true),
('4.1.1', 'Turističke agencije - Naknada koju plaćaju putnici, uključujući i povećanje, odnosno smanjenje te naknade', 'OUTPUT', false, NULL, 4, 411, true),
('4.1.2', 'Turističke agencije - Stvarni troškovi za prethodne turističke usluge, uključujući i povećanje, odnosno smanjenje tih troškova', 'INPUT', false, NULL, 4, 412, true),
('4.1.3', 'Turističke agencije - Razlika (4.1.1–4.1.2)', 'OUTPUT', false, NULL, 4, 413, true),
('4.1.4', 'Turističke agencije - Obračunati PDV', 'OUTPUT', false, NULL, 4, 414, true),
('4.2.1', 'Polovna dobra - Prodajna cena dobara, uključujući i povećanje, odnosno smanjenje te cene', 'OUTPUT', false, NULL, 4, 421, true),
('4.2.2', 'Polovna dobra - Nabavna cena dobara, uključujući i povećanje, odnosno smanjenje te cene', 'OUTPUT', false, NULL, 4, 422, true),
('4.2.3', 'Polovna dobra - Razlika (4.2.1–4.2.2)', 'OUTPUT', false, NULL, 4, 423, true),
('4.2.4', 'Polovna dobra - Obračunati PDV', 'OUTPUT', false, NULL, 4, 424, true),

-- Section 6
('6',     'UVOZ DOBARA STAVLJENIH U SLOBODAN PROMET U SKLADU SA CARINSKIM PROPISIMA', 'INPUT', false, NULL, 6, 600, true),
('6.1',   'Vrednost dobara za čiji je uvoz propisano poresko oslobođenje, uključujući i povećanje, odnosno smanjenje vrednosti tih dobara', 'BOTH', false, NULL, 6, 610, true),
('6.2.1', 'Osnovica za uvoz dobara', 'INPUT', false, NULL, 6, 621, true),
('6.2.2', 'Povećanje osnovice za uvoz dobara', 'INPUT', false, NULL, 6, 622, true),
('6.2.3', 'Smanjenje osnovice za uvoz dobara', 'INPUT', false, NULL, 6, 623, true),
('6.4',   'Ukupan PDV plaćen pri uvozu dobara, a koji se može odbiti kao prethodni porez', 'INPUT', false, NULL, 6, 640, true),

-- Section 7
('7',     'NABAVKA DOBARA I USLUGA OD POLJOPRIVREDNIKA', 'INPUT', false, NULL, 7, 700, true),
('7.1',   'Vrednost primljenih dobara i usluga, uključujući i povećanje, odnosno smanjenje te vrednosti', 'INPUT', true, '7.1', 7, 710, true),
('7.2',   'Vrednost plaćenih dobara i usluga', 'INPUT', true, '7.2', 7, 720, true),
('7.3',   'Plaćena PDV nadoknada', 'INPUT', true, '7.3', 7, 730, true),

-- Section 8a
('8a',     'NABAVKA DOBARA I USLUGA U REPUBLICI OD OBVEZNIKA PDV - PROMET ZA KOJI JE PORESKI DUŽNIK ISPORUČILAC DOBARA, ODNOSNO PRUŽALAC USLUGA', 'INPUT', false, NULL, 8, 800, true),
('8a.1',   'Prvi prenos prava raspolaganja na novoizgrađenim građevinskim objektima', 'INPUT', false, NULL, 8, 801, true),
('8a.2',   'Dobra i usluge osim dobara iz tačke 8a.1', 'INPUT', false, NULL, 8, 802, true),
('8a.2.a', '8a.2 - Samo osnovice: promet drugog lica i slično', 'INPUT', true, '8a.2', 8, 803, true),
('8a.2.x', 'Nabavka opreme i objekta, promet po Članu 32 Zakona', 'INPUT', true, '8a.2', 8, 804, true),
('8a.2.y', 'Naknadno sticanje prava na odbitak prethodnog poreza za opremu i objekte po članu 32a Zakona', 'INPUT', true, '8a.2', 8, 805, true),
('8a.2.z', 'Sticanje prava na odbitak prethodnog poreza po Članu 32b Zakona, odnosno Član 23 Pravilnika', 'INPUT', true, '8a.2', 8, 806, true),
('8a.3',   'Dobra i usluge bez naknade', 'INPUT', false, NULL, 8, 807, true),
('8a.4',   'Izmena osnovice za nabavljena dobra i usluge i ispravka odbitka prethodnog poreza po osnovu izmene osnovice - povećanje', 'BOTH', false, NULL, 8, 808, true),
('8a.5',   'Izmena osnovice za nabavljena dobra i usluge i ispravka odbitka prethodnog poreza po osnovu izmene osnovice - smanjenje', 'BOTH', false, NULL, 8, 809, true),
('8a.5.x', 'Izmena osnovice - smanjenje - samo PDV', 'INPUT', true, '8e.4', 8, 810, true),

-- Section 8b
('8b',     'NABAVKA DOBARA I USLUGA U REPUBLICI OD OBVEZNIKA PDV - PROMET ZA KOJI JE PORESKI DUŽNIK PRIMALAC DOBARA, ODNOSNO USLUGA', 'INPUT', false, NULL, 8, 820, true),
('8b.1',   'Prenos prava raspolaganja na građevinskim objektima', 'INPUT', false, NULL, 8, 821, true),
('8b.2',   'Dobra i usluge, osim dobara iz tačke 8b.1', 'INPUT', false, NULL, 8, 822, true),
('8b.3',   'Dobra i usluge bez naknade', 'INPUT', false, NULL, 8, 823, true),
('8b.4',   'Izmena osnovice za nabavljena dobra i usluge - povećanje', 'INPUT', false, NULL, 8, 824, true),
('8b.5',   'Izmena osnovice za nabavljena dobra i usluge - smanjenje', 'INPUT', false, NULL, 8, 825, true),
('8b.5.x', 'Izmena osnovice za nabavljena dobra i usluge - smanjenje - samo PDV', 'INPUT', true, '8b.5', 8, 826, true),

-- Section 8v
('8v',     'NABAVKA DOBARA I USLUGA U REPUBLICI OD OBVEZNIKA PDV, OSIM PO OSNOVU PROMETA ZA KOJI POSTOJI OBAVEZA OBRAČUNAVANJA PDV IZ TAČ. 8a I 8b', 'INPUT', false, NULL, 8, 830, true),
('8v.1',   'Sticanje celokupne, odnosno dela imovine u skladu sa članom 6. stav 1. tačka 1) Zakona i nabavka dobara i usluga u skladu sa članom 6a Zakona, sa ili bez naknade ili kao ulog, uključujući i povećanje, odnosno smanjenje te naknade', 'INPUT', true, NULL, 8, 831, true),
('8v.2',   'Dobra i usluge uz naknadu, osim iz tačke 8v.1, uključujući i povećanje, odnosno smanjenje te naknade', 'INPUT', false, NULL, 8, 832, true),
('8v.3',   'Dobra i usluge bez naknade, osim iz tačke 8v.1', 'INPUT', false, NULL, 8, 833, true),

-- Section 8d
('8d',     'NABAVKA DOBARA I USLUGA, OSIM IZ TAČKE 8a DO 8g', 'BOTH', false, NULL, 8, 840, true),
('8d.1',   'Dobra i usluge nabavljeni u Republici od stranih lica koja nisu obveznici PDV - promet za koji ne postoji obaveza obračunavanja PDV, kao i povećanje, odnosno smanjenje naknade za ta dobra i usluge, uključujući i nabavku bez naknade', 'INPUT', false, NULL, 8, 841, true),
('8d.2',   'Dobra i usluge nabavljeni u Republici od lica sa teritorije Republike koja nisu obveznici PDV, kao i povećanje, odnosno smanjenje naknade za ta dobra i usluge, uključujući i nabavku bez naknade', 'INPUT', false, NULL, 8, 842, true),
('8d.2.x', 'Promet sekundarnih sirovina po Članu 22. i 23. Pravilnika', 'INPUT', true, '8d.2', 8, 843, true),
('8d.3',   'Dobra i usluge nabavljeni van Republike, kao i povećanje, odnosno smanjenje naknade za ta dobra i usluge, uključujući i nabavku bez naknade', 'INPUT', false, NULL, 8, 844, true),

-- Section 8e (corrections)
('8e.1.a', '8e.1 - Korekcija srazmernog poreskog odbitka i slično', 'INPUT', true, NULL, 8, 851, true),
('8e.2.a', '8e.2 - Korekcija srazmernog poreskog odbitka i slično', 'INPUT', true, NULL, 8, 852, true),
('8e.3',   'Ispravka odbitka - povećanje prethodnog poreza, osim po osnovu izmene osnovice za promet dobara i usluga i po osnovu uvoza dobara', 'BOTH', false, NULL, 8, 853, true),
('8e.4',   'Ispravka odbitka - smanjenje prethodnog poreza, osim po osnovu izmene osnovice za promet dobara i usluga', 'BOTH', false, NULL, 8, 854, true),

-- Section 8g
('8g',     'NABAVKA DOBARA I USLUGA U REPUBLICI OD STRANIH LICA KOJA NISU OBVEZNICI PDV - PROMET ZA KOJI POSTOJI OBAVEZA OBRAČUNAVANJA PDV-A', 'INPUT', false, NULL, 8, 860, true),
('8g.1',   'Dobra i usluge', 'INPUT', false, NULL, 8, 861, true),
('8g.2',   'Dobra i usluge bez naknade', 'INPUT', false, NULL, 8, 862, true),
('8g.3',   'Izmena osnovice - povećanje', 'INPUT', false, NULL, 8, 863, true),
('8g.4',   'Izmena osnovice - smanjenje', 'INPUT', false, NULL, 8, 864, true),

-- Section 9
('9',     'NABAVKA DOBARA I USLUGA U REPUBLICI OD OBVEZNIKA PDV BEZ PRAVA ODBITKA PDV-a', 'INPUT', false, NULL, 9, 900, true),
('9.01',  '8a - Bez prava odbitka PDV - 8a.2 - Dobra i usluge osim dobara iz tačke 8a.1', 'INPUT', false, '8a.2', 9, 901, true),
('9.02',  '8a - Bez prava odbitka PDV - 8a.1 - Prvi prenos prava raspolaganja na novoizgrađenim građevinskim objektima', 'INPUT', false, '8a.1', 9, 902, true),
('9.03',  '8a - Bez prava odbitka PDV - 8a.3 - Dobra i usluge bez naknade', 'INPUT', false, '8a.3', 9, 903, true),
('9.04',  '8a - Bez prava odbitka PDV - 8a.4 - Izmena osnovice - povećanje', 'INPUT', false, '8a.4', 9, 904, true),
('9.05',  '8a - Bez prava odbitka PDV - 8a.5 - Izmena osnovice - smanjenje', 'INPUT', false, '8a.5', 9, 905, true),
('9.07',  '8b - Bez prava odbitka PDV - 8b.1 - Prenos prava raspolaganja na građevinskim objektima', 'INPUT', false, '8b.1', 9, 907, true),
('9.08',  '8b - Bez prava odbitka PDV - 8b.2 - Dobra i usluge, osim dobara iz tačke 8b.1', 'INPUT', false, '8b.2', 9, 908, true),
('9.09',  '8b - Bez prava odbitka PDV - 8b.3 - Dobra i usluge bez naknade', 'INPUT', false, '8b.3', 9, 909, true),
('9.10',  '8b - Bez prava odbitka PDV - 8b.4 - Izmena osnovice - povećanje', 'INPUT', false, '8b.4', 9, 910, true),
('9.11',  '8b - Bez prava odbitka PDV - 8b.5 - Izmena osnovice - smanjenje', 'INPUT', false, '8b.5', 9, 911, true),
('9.13',  '8g - Bez prava odbitka PDV - 8g.1 - Dobra i usluge', 'INPUT', false, '8g.1', 9, 913, true),
('9.14',  '8g - Bez prava odbitka PDV - 8g.2 - Dobra i usluge bez naknade', 'INPUT', false, '8g.2', 9, 914, true),
('9.15',  '8g - Bez prava odbitka PDV - 8g.3 - Izmena osnovice - povećanje', 'INPUT', false, '8g.3', 9, 915, true),
('9.16',  '8g - Bez prava odbitka PDV - 8g.4 - Izmena osnovice - smanjenje', 'INPUT', false, '8g.4', 9, 916, true),
('9.18',  '6.2.1 - Bez prava odbitka PDV - Uvoz dobara', 'INPUT', false, '6.2.1', 9, 918, true),
('9.19',  '7.1 - Bez prava odbitka PDV - Nabavka dobara i usluga od poljoprivrednika', 'INPUT', false, '7.1', 9, 919, true),

-- Section 11
('11',    'PROMET DOBARA I USLUGA IZVRŠEN VAN REPUBLIKE I DRUGI PROMET KOJI NE PODLEŽE PDV', 'BOTH', false, NULL, 11, 1100, true),
('11.1',  'Promet dobara i usluga izvršen van Republike, sa ili bez naknade', 'OUTPUT', false, NULL, 11, 1101, true),
('11.2',  'Prenos celokupne, odnosno dela imovine u skladu sa članom 6. stav 1. tačka 1) Zakona i promet dobara i usluga u skladu sa članom 6a Zakona, sa ili bez naknade ili kao ulog', 'OUTPUT', false, NULL, 11, 1102, true),
('11.3',  'Promet dobara i usluga iz člana 6. Zakona, osim iz tačke 11.2', 'OUTPUT', false, NULL, 11, 1103, true),
('11.8',  'Ostali promet i promet koji nije predmet PDV - primljeni', 'INPUT', false, NULL, 11, 1108, true),
('11.9',  'Ostali promet i promet koji nije predmet PDV - izdati', 'OUTPUT', false, NULL, 11, 1109, true);
