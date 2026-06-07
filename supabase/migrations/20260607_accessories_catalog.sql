-- =============================================================================
-- Accessories & infrastructure catalog — cables (CAT5e/6/7), camera boxes &
-- mounts, connectors & accessories.
--
-- Adds 3 new categories and 19 products with price=0 / stock=0 as a skeleton;
-- the admin fills in real prices, costs and stock later via /admin/products.
-- Idempotent: re-running is safe (ON CONFLICT (slug) DO NOTHING).
-- =============================================================================

-- ----- categories -----
INSERT INTO store.categories (slug, name_he, sort) VALUES
  ('cables',                 'כבלים ותקשורת',        40),
  ('camera-boxes',           'קופסאות ומתקני התקנה',  50),
  ('connectors-accessories', 'מחברים ואביזרים',       60)
ON CONFLICT (slug) DO NOTHING;

-- ----- products: cables (CAT5e / CAT6 / CAT7 + coax) -----
INSERT INTO store.products (category_id, slug, name_he, short_desc_he, sort, sku)
SELECT c.id, v.slug, v.name_he, v.short_desc_he, v.sort, v.sku
FROM (VALUES
  ('cat5e-utp-305',       'כבל רשת CAT5e UTP — גליל 305 מ׳',            'כבל רשת מסוג CAT5e, גליל 305 מטר', 4010, 'CAT5E-UTP-305'),
  ('cat6-utp-305',        'כבל רשת CAT6 UTP — גליל 305 מ׳',             'כבל רשת מסוג CAT6, גליל 305 מטר',  4020, 'CAT6-UTP-305'),
  ('cat6-outdoor-305',    'כבל רשת CAT6 UTP חיצוני (חוץ) — גליל 305 מ׳','כבל רשת CAT6 לשימוש חיצוני עמיד',  4030, 'CAT6-OUT-305'),
  ('cat6-sftp-305',       'כבל רשת CAT6 SFTP מסוכך — גליל 305 מ׳',      'כבל רשת CAT6 מסוכך SFTP',          4040, 'CAT6-SFTP-305'),
  ('cat7-sftp-305',       'כבל רשת CAT7 SFTP מסוכך — גליל 305 מ׳',      'כבל רשת CAT7 מסוכך SFTP',          4050, 'CAT7-SFTP-305'),
  ('coax-rg59-power-305', 'כבל קואקס משולב RG59 + מתח — גליל 305 מ׳',   'כבל קואקס משולב וידאו + מתח',      4060, 'RG59-PWR-305')
) AS v(slug, name_he, short_desc_he, sort, sku)
CROSS JOIN store.categories c
WHERE c.slug = 'cables'
ON CONFLICT (slug) DO NOTHING;

-- ----- products: camera boxes & mounts -----
INSERT INTO store.products (category_id, slug, name_he, short_desc_he, sort, sku)
SELECT c.id, v.slug, v.name_he, v.short_desc_he, v.sort, v.sku
FROM (VALUES
  ('junction-box-ip66',  'קופסת הסתעפות למצלמה אטומה IP66', 'קופסת חיבורים אטומה למים IP66',     5010, 'JB-IP66'),
  ('junction-box-white', 'קופסת הסתעפות למצלמה — לבנה',     'קופסת חיבורים למצלמה',              5020, 'JB-WHITE'),
  ('wall-mount-bullet',  'זרוע התקנה לקיר למצלמת בולט',     'זרוע/תושבת קיר למצלמת צינור',       5030, 'MNT-WALL-BULLET'),
  ('ceiling-mount-dome', 'תושבת תקרה למצלמת כיפה (Dome)',   'תושבת התקנה לתקרה למצלמת כיפה',     5040, 'MNT-CEIL-DOME'),
  ('pole-corner-mount',  'מתקן עמוד/פינה למצלמה',           'מתאם להתקנה על עמוד או פינה',       5050, 'MNT-POLE'),
  ('back-box-camera',    'קופסת בסיס (Back Box) למצלמה',    'קופסת בסיס להתקנה מתחת למצלמה',     5060, 'BACKBOX')
) AS v(slug, name_he, short_desc_he, sort, sku)
CROSS JOIN store.categories c
WHERE c.slug = 'camera-boxes'
ON CONFLICT (slug) DO NOTHING;

-- ----- products: connectors & accessories -----
INSERT INTO store.products (category_id, slug, name_he, short_desc_he, sort, sku)
SELECT c.id, v.slug, v.name_he, v.short_desc_he, v.sort, v.sku
FROM (VALUES
  ('rj45-cat6-100',   'מחבר RJ45 CAT6 (אריזת 100 יח׳)', 'מחברי RJ45 לכבל CAT6, אריזת 100',  6010, 'RJ45-CAT6-100'),
  ('rj45-waterproof', 'מחבר RJ45 אטום למים',            'מחבר RJ45 עמיד למים להתקנה חיצונית',6020, 'RJ45-WP'),
  ('bnc-compression', 'מחבר BNC לחיצה (Compression)',   'מחבר BNC ללחיצה לכבל קואקס',        6030, 'BNC-COMP'),
  ('keystone-cat6',   'שקע רשת Keystone CAT6',          'שקע רשת מסוג Keystone לכבל CAT6',   6040, 'KEYSTONE-CAT6'),
  ('psu-12v-2a',      'ספק כוח 12V / 2A למצלמה',        'ספק כוח יחיד 12V 2A',               6050, 'PSU-12V-2A'),
  ('psu-12v-box-4ch', 'ספק כוח מרכזי 12V — 4 ערוצים',   'ספק כוח מרכזי 12V ל-4 מצלמות',      6060, 'PSU-12V-4CH'),
  ('cable-ties-pack', 'אזיקוני כבל (אריזה)',            'אזיקוני פלסטיק לקשירת כבלים',       6070, 'TIES-PACK')
) AS v(slug, name_he, short_desc_he, sort, sku)
CROSS JOIN store.categories c
WHERE c.slug = 'connectors-accessories'
ON CONFLICT (slug) DO NOTHING;
