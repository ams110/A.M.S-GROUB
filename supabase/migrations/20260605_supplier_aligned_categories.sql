-- Align catalogue categories to the supplier's (Tiandy) price-list sheets, so
-- the storefront mirrors the supplier's own grouping and naming and avoids
-- cross-referencing confusion.
--
-- 1) "AK Series" sheet holds both AK cameras AND AK NVRs (TC-R3104/R3108), so
--    the category that used to be "מצלמות AK" ("AK cameras") is renamed to
--    "סדרת AK" ("AK series") — it no longer mislabels the NVRs as cameras.
-- 2) The supplier lists the entry "Super Lite" line on its own sheet, so it
--    gets its own category here.
--
-- Per-product re-categorisation and the supplier-exact name alignment (e.g.
-- "Spec:" → "Spec: " for the AK/Wireless entries) were applied as data
-- operations against store.products and are not reproduced here.

update store.categories set name_he = 'סדרת AK' where slug = 'ak-series';

insert into store.categories (name_he, slug, sort)
select 'Super Lite', 'super-lite', coalesce(max(sort), 0) + 1 from store.categories
where not exists (select 1 from store.categories where slug = 'super-lite');
