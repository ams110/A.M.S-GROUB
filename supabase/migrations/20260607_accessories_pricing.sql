-- =============================================================================
-- Accessories pricing + expansion.
--
-- (1) Sets market-estimate prices on the 19 accessory products from
--     20260607_accessories_catalog.sql (wholesale `price`; contractor = −7%).
-- (2) Adds 3 more categories (storage / network-infra / tools) and 21 products,
--     all with market-estimate prices. cost stays 0 (no real cost basis).
--
-- ⚠️ Prices are MARKET ESTIMATES (₪, excl. VAT) — review before relying on them.
-- Idempotent: re-running is safe.
-- =============================================================================

-- ----- (1) price the existing 19 accessory products (wholesale + contractor −7%) -----
UPDATE store.products AS p SET price = v.price, price_contractor = round(v.price * 0.93, 2)
FROM (VALUES
  ('cat5e-utp-305',       220.0),
  ('cat6-utp-305',        320.0),
  ('cat6-outdoor-305',    480.0),
  ('cat6-sftp-305',       520.0),
  ('cat7-sftp-305',       750.0),
  ('coax-rg59-power-305', 380.0),
  ('junction-box-ip66',    45.0),
  ('junction-box-white',   30.0),
  ('wall-mount-bullet',    55.0),
  ('ceiling-mount-dome',   40.0),
  ('pole-corner-mount',    90.0),
  ('back-box-camera',      35.0),
  ('rj45-cat6-100',        60.0),
  ('rj45-waterproof',      12.0),
  ('bnc-compression',       8.0),
  ('keystone-cat6',        15.0),
  ('psu-12v-2a',           35.0),
  ('psu-12v-box-4ch',     120.0),
  ('cable-ties-pack',      15.0)
) AS v(slug, price)
WHERE p.slug = v.slug;

-- ----- (2) new categories -----
INSERT INTO store.categories (slug, name_he, sort) VALUES
  ('storage',       'אחסון והקלטה',  70),
  ('network-infra', 'רשת ותקשורת',   80),
  ('tools',         'כלי עבודה',      90)
ON CONFLICT (slug) DO NOTHING;

-- helper: insert a batch of priced products into one category (contractor = −7%)
-- more cables
INSERT INTO store.products (category_id, slug, name_he, short_desc_he, sort, sku, price, price_contractor)
SELECT c.id, v.slug, v.name_he, v.short_desc_he, v.sort, v.sku, v.price, round(v.price * 0.93, 2)
FROM (VALUES
  ('coax-rg6-305',    'כבל קואקס RG6 — גליל 305 מ׳',        'כבל קואקס RG6 לגלילים',          4070, 'RG6-305',        350.0),
  ('power-2x075-100', 'כבל מתח 2×0.75 ממ״ר — גליל 100 מ׳', 'כבל הזנת מתח למצלמות',           4080, 'PWR-2X075-100',  110.0),
  ('hdmi-4k-5m',      'כבל HDMI 4K — 5 מ׳',               'כבל HDMI 4K באורך 5 מטר',         4090, 'HDMI-4K-5',      60.0),
  ('hdmi-4k-15m',     'כבל HDMI 4K — 15 מ׳',              'כבל HDMI 4K באורך 15 מטר',        4100, 'HDMI-4K-15',     160.0),
  ('fiber-patch-lc-3m','כבל פאצ׳ פייבר LC/LC — 3 מ׳',      'כבל תקשורת אופטי LC/LC',          4110, 'FIBER-LC-3',     45.0)
) AS v(slug, name_he, short_desc_he, sort, sku, price)
CROSS JOIN store.categories c WHERE c.slug = 'cables'
ON CONFLICT (slug) DO NOTHING;

-- storage
INSERT INTO store.products (category_id, slug, name_he, short_desc_he, sort, sku, price, price_contractor)
SELECT c.id, v.slug, v.name_he, v.short_desc_he, v.sort, v.sku, v.price, round(v.price * 0.93, 2)
FROM (VALUES
  ('hdd-1tb-surv',     'דיסק קשיח למעקב 1TB',          'דיסק קשיח ייעודי למצלמות אבטחה', 7010, 'HDD-1TB',     260.0),
  ('hdd-2tb-surv',     'דיסק קשיח למעקב 2TB',          'דיסק קשיח ייעודי למצלמות אבטחה', 7020, 'HDD-2TB',     360.0),
  ('hdd-4tb-surv',     'דיסק קשיח למעקב 4TB',          'דיסק קשיח ייעודי למצלמות אבטחה', 7030, 'HDD-4TB',     560.0),
  ('hdd-6tb-surv',     'דיסק קשיח למעקב 6TB',          'דיסק קשיח ייעודי למצלמות אבטחה', 7040, 'HDD-6TB',     780.0),
  ('microsd-128-surv', 'כרטיס זיכרון MicroSD 128GB',   'כרטיס זיכרון למצלמות',            7050, 'SD-128',      110.0),
  ('microsd-256-surv', 'כרטיס זיכרון MicroSD 256GB',   'כרטיס זיכרון למצלמות',            7060, 'SD-256',      180.0)
) AS v(slug, name_he, short_desc_he, sort, sku, price)
CROSS JOIN store.categories c WHERE c.slug = 'storage'
ON CONFLICT (slug) DO NOTHING;

-- network-infra
INSERT INTO store.products (category_id, slug, name_he, short_desc_he, sort, sku, price, price_contractor)
SELECT c.id, v.slug, v.name_he, v.short_desc_he, v.sort, v.sku, v.price, round(v.price * 0.93, 2)
FROM (VALUES
  ('patch-panel-24', 'פאנל תקשורת 24 פורט CAT6', 'פאנל תקשורת 24 פורטים',        8010, 'PP-24',       140.0),
  ('patch-cord-1m',  'כבל פאצ׳ CAT6 — 1 מ׳',     'כבל גישור רשת מוכן',            8020, 'PATCH-1M',    9.0),
  ('patch-cord-3m',  'כבל פאצ׳ CAT6 — 3 מ׳',     'כבל גישור רשת מוכן',            8030, 'PATCH-3M',    16.0),
  ('rack-9u-wall',   'ארון תקשורת קיר 9U',       'ארון תקשורת לתלייה על קיר',     8040, 'RACK-9U',     480.0),
  ('ups-650va',      'אל-פסק UPS 650VA',         'גיבוי מתח למערכת אבטחה',        8050, 'UPS-650',     290.0),
  ('surge-rj45',     'הגנת ברק לרשת RJ45',       'מגן נחשולי מתח לרשת',           8060, 'SURGE-RJ45',  45.0),
  ('surge-bnc',      'הגנת ברק לקואקס BNC',      'מגן נחשולי מתח לקואקס',         8070, 'SURGE-BNC',   40.0)
) AS v(slug, name_he, short_desc_he, sort, sku, price)
CROSS JOIN store.categories c WHERE c.slug = 'network-infra'
ON CONFLICT (slug) DO NOTHING;

-- tools
INSERT INTO store.products (category_id, slug, name_he, short_desc_he, sort, sku, price, price_contractor)
SELECT c.id, v.slug, v.name_he, v.short_desc_he, v.sort, v.sku, v.price, round(v.price * 0.93, 2)
FROM (VALUES
  ('crimp-rj45',      'מכשיר הידוק (קלמפ) RJ45', 'כלי הידוק למחברי רשת',     9010, 'CRIMP-RJ45', 95.0),
  ('lan-tester',      'בודק כבלי רשת',           'מכשיר בדיקת כבלי תקשורת',  9020, 'LAN-TESTER', 130.0),
  ('punch-down-tool', 'כלי נעיצה Punch-Down',    'כלי נעיצה לשקעי רשת',       9030, 'PUNCH-TOOL', 55.0)
) AS v(slug, name_he, short_desc_he, sort, sku, price)
CROSS JOIN store.categories c WHERE c.slug = 'tools'
ON CONFLICT (slug) DO NOTHING;
