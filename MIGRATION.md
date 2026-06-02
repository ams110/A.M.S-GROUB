# نقل قاعدة بيانات المتجر إلى مشروع Supabase جديد (أوروبا)

الهدف: نقل المتجر إلى مشروع قريب جغرافياً (أوروبا) لأداء أسرع. البيانات صغيرة
والنقل يدوي وبسيط. اتبع الخطوات بالترتيب.

> مشروعك الجديد: `ovucqyfomywkzukzjsfs`
> الرابط: `https://ovucqyfomywkzukzjsfs.supabase.co`

## 1) إنشاء المشروع
أنشئ مشروع Supabase جديد واختر منطقة **أوروبا** (مثل Frankfurt / `eu-central-1`).
(إن كنت أنشأته بالفعل في منطقة بعيدة، يُفضّل إعادة إنشائه في أوروبا — هذا هو الهدف.)

## 2) تشغيل ملفّي SQL
من لوحة المشروع → **SQL Editor** → New query، شغّل بالترتيب:
1. الصق محتوى `supabase/migrations/0001_store_schema.sql` كاملاً ثم Run.
2. الصق محتوى `supabase/seed/0002_store_data.sql` كاملاً ثم Run.

تأكد بعدها (في SQL Editor):
```sql
select count(*) from store.products;   -- المفروض 114
select count(*) from store.categories; -- المفروض 9
```

## 3) تعريض schema المتجر للـ API
**Settings → API → Exposed schemas** → أضف `store` واحفظ.

## 4) التخزين (الصور)
الـ bucket باسم `store-media` يُنشأ تلقائياً من السكربت (للصور الجديدة). صور
المنتجات الحالية روابطها تشير للمشروع القديم وتبقى تعمل؛ يمكن إعادة رفعها لاحقاً.

## 5) الدالة (إنشاء حسابات الزبائن)
انشر الـ Edge Function على المشروع الجديد. إن كان لديك Supabase CLI:
```bash
supabase link --project-ref ovucqyfomywkzukzjsfs
supabase functions deploy admin-create-customer
```
(المصدر موجود في `supabase/functions/admin-create-customer/`.) إن لم يكن لديك
CLI، أخبرني وأرشدك خطوة بخطوة — أو نؤجّلها (باقي التطبيق يعمل بدونها).

## 6) إنشاء حساب الأدمن
سجّل دخول/أنشئ مستخدماً مرّة من التطبيق بإيميلك، أو من اللوحة:
**Authentication → Users → Add user** (فعّل "Auto confirm"). ثم في SQL Editor:
```sql
update store.profiles
set role = 'admin', status = 'approved'
where id = (select id from auth.users where email = 'EMAIL_HERE');
```

## 7) ربط التطبيق بالمشروع الجديد
أرسل لي:
- **Project URL**: `https://ovucqyfomywkzukzjsfs.supabase.co`
- **مفتاح anon / publishable**: من **Settings → API** (المفتاح العام، آمن للنشر).

وأنا أحدّث `src/lib/config.ts` وأعمل نشر — وعندها يعمل التطبيق بالكامل على
المشروع الأوروبي الجديد. (لا تنسَ أن GitHub Pages يبقى كما هو؛ فقط قاعدة البيانات تتغيّر.)
