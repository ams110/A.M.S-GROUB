# Tiandy Store — CLAUDE.md

دليل للـ AI عند العمل على هذا المشروع.

## نظرة عامة

بوابة طلبات B2B لموزع Tiandy الرسمي في إسرائيل. الموزعون المعتمدون يسجلون دخولهم ويتصفحون الكتالوج بأسعار الجملة ويضعون الطلبات. المدير يدير المنتجات والأسعار والمخزون من لوحة إدارة.

- **Next.js 15** (App Router, TypeScript) + Tailwind CSS
- **Supabase** — Postgres, Auth, Row Level Security
- **Static export** مستضاف على GitHub Pages على دومين مخصّص **`ams-groub.linko.services`** (ملف `CNAME`). كل الكود يعمل في المتصفح، بلا SSR.
- واجهة بالعبرية (RTL) — العلامة **Â.M.Ŝ GROUP**.

## بنية المشروع

```
src/
  app/           # صفحات Next.js (كلها "use client")
    page.tsx     # صفحة الدخول (إيميل/username + passkey)
    admin/       # لوحة الإدارة — محمية بـ AdminLayout (admins, dealers, products, orders, quotes, inventory, suppliers, purchase-orders, customer-prices, settings)
    account/     # صفحات الموزع (orders, quotes, order, security=passkey)
    register/    # تسجيل موزع جديد (مغلق)
    welcome/     # splash screen بعد الدخول (ثم redirect لـ /products)
  components/
    AuthGuard.tsx  # حماية كل الـ routes — يُعرض في layout.tsx
    Header.tsx     # nav bar + bottom nav للموبايل (يظهر فقط للمسجّلين)
    CartProvider, ProductCard, AddToCart, Toast
  lib/
    auth.ts      # useProfile hook — جلسة المستخدم وبياناته
    passkey.ts   # WebAuthn (تسجيل/دخول بالبصمة) — ينادي Edge Functions
    pricing.ts   # applyEffectivePrices — أسعار العميل الخاصة
    supabase/
      client.ts  # Supabase browser client (singleton)
    config.ts    # SUPABASE_URL, SUPABASE_ANON_KEY, BASE_PATH
    types.ts     # TypeScript types للـ DB
src/middleware.ts  # يجدد الـ session token (لا يعمل على static export)
```

## Auth — أهم قواعد العمل

### Singleton Client
`createClient()` في `src/lib/supabase/client.ts` يُعيد **نفس الـ instance** دائماً (singleton). **لا تحذف هذا النمط أبداً** — إنشاء instance جديد في كل استدعاء يتسبب في ضياع الجلسة عند الـ refresh.

### useProfile Hook
`src/lib/auth.ts` يعتمد على `onAuthStateChange` كمصدر وحيد للجلسة. يطلق `INITIAL_SESSION` فوراً عند mount الـ component بالـ session الحالية من الـ cookies. **لا تضيف استدعاء منفصل لـ `getSession()`** — هاد كان يسبب race condition وتعليق الصفحة.

### Middleware
`src/middleware.ts` يستدعي `getUser()` على كل request لتجديد الـ session cookies قبل انتهاء صلاحية الـ access token (~ساعة). **لا تحذف هذا الملف**.
> ⚠️ ملاحظة: مع `output: export` (GitHub Pages) **الـ middleware لا يعمل في الإنتاج** — تجديد الجلسة يعتمد عملياً على عميل supabase-js في المتصفح. الملف مفيد للتطوير المحلي فقط.

### الدخول باسم المستخدم (username) أو الإيميل
نموذج الدخول (`src/app/page.tsx`) يقبل إيميل **أو** username. إذا لم يحتوِ النص على `@` يستدعي RPC `get_email_by_username` لتحويل الـ username إلى إيميل ثم `signInWithPassword`. الـ username يُخزّن في `store.profiles.username` ويُضبط من `/admin/dealers`.

### passkeys (WebAuthn / بصمة)
دخول بلا كلمة مرور عبر بصمة/Face ID:
- العميل: `src/lib/passkey.ts` (يستخدم `@simplewebauthn/browser`) + زر في صفحة الدخول وصفحة `/account/security`.
- الخادم: Edge Functions `passkey-register` (تتطلب JWT) و`passkey-auth` (عامة، تُستدعى قبل الدخول).
- التخزين: أعمدة `passkey_*` على `store.profiles` + جدول `store.passkey_challenges` (للتحدّيات، service-role فقط).
- **مهم:** `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` في الدالتين يجب أن يطابقا الدومين الفعلي **`ams-groub.linko.services`** (WebAuthn يفرض ذلك).

### AuthGuard — حماية كل الـ Routes
`src/components/AuthGuard.tsx` يغلّف كل التطبيق في `layout.tsx`. المنطق:
- `/` و `/login` فقط public (بدون header/footer) — كل الباقي يتطلب تسجيل دخول
- زائر غير مسجّل → redirect فوري لـ `/?redirect=<path>`
- أثناء التحقق من الجلسة → splash screen داكن (بدون وميض أبيض)
- بعد الدخول وريثما تكتمل الـ navigation → overlay داكن يمنع الشاشة البيضاء
- **لا تضيف header أو footer داخل أي صفحة** — AuthGuard يتكفّل بهما

### صلاحيات المستخدمين
الدور في `store.profiles.role`؛ دالة `store.is_admin()` تعيد true لـ `admin` و`super_admin`.
| الحالة | القدرات |
|--------|---------|
| زائر | صفحة الدخول فقط |
| موزع (pending) | ينتظر موافقة المدير |
| موزع (approved) | رؤية الأسعار، إضافة للسلة، الدفع |
| admin | كل شيء + إنشاء حسابات |
| super_admin | كل شيء + إدارة المدراء (`/admin/admins`) |

## قاعدة البيانات

كل شيء في **schema منفصل `store`** داخل مشروع Supabase، منفصل تماماً عن جداول الموقع الرئيسي (`public.tiandy_il_*`). **انتبه:** نفس مشروع Supabase يستضيف تطبيقاً آخر (contractor-pro) — لا تلمس أي شيء خارج schema `store`.

### ⭐ نمط الوصول: public views وسيطة + RLS (الأهم للفهم)
PostgREST يكشف schema `public` فقط، لذا العميل **لا يستعلم عن `store.*` مباشرة**. لكل جدول `store` يوجد **view بنفس الاسم في `public`** يمرّر إليه (`public.products` → `store.products` …). العميل (supabase-js، schema افتراضي `public`) يستعلم عن هذه الـ views.

- كل الـ views مضبوطة على **`security_invoker = on`** → تُطبَّق RLS الخاصة بجداول `store` باسم المستخدم المُستدعي. **عند إنشاء/تعديل view لا تنسَ `with (security_invoker = on)`** وإلا تتجاوز RLS (ثغرة كشف بيانات).
- التحكّم الحقيقي بالوصول هو **RLS على جداول `store`** (anon/authenticated ممنوحة صلاحيات كاملة على الجداول، وRLS هي التي تفلتر).
- عند إضافة عمود جديد لجدول `store` يحتاجه العميل → **حدّث الـ view المقابل** ليكشفه (وإلا 400).
- دوال RPC: لكل دالة `store.fn` يجب وجود **wrapper في `public.fn`** يستدعيها (وإلا العميل يحصل 404). نمط الـ wrapper: `SECURITY DEFINER` + `set search_path = store, public`.
- **`service_role`** (تستخدمه Edge Functions) يملك وصولاً كاملاً على schema `store` (USAGE + كل الجداول/الدوال) — ضروري لأي Edge Function تلمس `store`.

### الجداول الرئيسية
- `store.profiles` — حسابات الموزعين/الإدارة (تُنشأ تلقائياً عند التسجيل بحالة `pending`؛ تحوي `username` وأعمدة `passkey_*`)
- `store.products`, `store.categories` — الكتالوج
- `store.orders`, `store.order_items` — الطلبات
- `store.quotes`, `store.quote_items`, `store.invoices`, `store.customer_prices` — عروض/فواتير/أسعار خاصة
- `store.suppliers`, `store.purchase_orders`, `store.purchase_order_items`, `store.warehouses`, `store.stock_movements` — المستودع (admin فقط)
- `store.passkey_challenges` — تحدّيات WebAuthn (service-role فقط)
- `store.settings`, `store.banners`

### أمان الطلبات
الطلبات تُنشأ عبر دالة Postgres `store.place_order` (SECURITY DEFINER) — تعيد حساب الأسعار من DB، تتحقق من المخزون، تُنقصه، وتكتب الطلب atomically. **العميل لا يضع الأسعار أبداً**.

### Migrations
```
supabase/migrations/
  0001_store_schema.sql                       # الـ schema الأساسي
  20260601_pricing_and_credit.sql             # نظام التسعير والائتمان
  20260601_tax_invoices.sql                   # فواتير ضريبية
  20260601_warehouse_module.sql               # إدارة المستودع
  20260603_super_admin.sql                    # دور super_admin
  20260603_username_login.sql                 # store.get_email_by_username
  20260603_passkeys.sql                       # أعمدة passkey + جدول passkey_challenges
  20260604_fix_profiles_view.sql              # public.profiles view (username + passkey_credential_id + security_invoker)
  20260604_fix_username_login.sql             # wrapper public.get_email_by_username (كان 404)
  20260604_store_security_invoker_views.sql   # الـ14 view → security_invoker (إصلاح أمني)
  20260604_store_fk_indexes.sql               # فهارس المفاتيح الأجنبية
  20260604_store_rls_perf.sql                 # تحسين سياسات RLS ((select auth.uid()) …)
  20260604_grant_service_role_store_access.sql # منح service_role وصول store
```

### Edge Functions (`supabase/functions/`)
- `admin-create-customer` — إنشاء حساب موزّع جديد (service role).
- `passkey-register` — تسجيل passkey (تتطلب JWT، `verify_jwt=true`).
- `passkey-auth` — دخول بـ passkey (عامة، `verify_jwt=false`).
> الدوال تستخدم `service_role` + `.schema("store")`. متغيرات `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` يجب أن تطابق `ams-groub.linko.services`.

## أوامر مفيدة

```bash
npm run dev      # تشغيل محلي على localhost:3000
npm run build    # بناء static export
npm run lint     # فحص الكود
```

## سير العمل مع Git

- **ادفع مباشرة على `main`** — لا حاجة لـ PRs أو branches وسيطة.
- تأكد من نجاح `npm run build` قبل الـ push.

## GitHub Actions

`.github/workflows/nextjs.yml` — بيبني وبينشر تلقائياً على GitHub Pages عند كل push لـ main.

## مشاكل سبق حلّها

| المشكلة | السبب | الحل | PR |
|---------|-------|------|----|
| ضياع الجلسة عند refresh | `createClient()` تنشئ instance جديد في كل استدعاء | Singleton pattern في `client.ts` | #18 |
| تعليق الصفحة بعد الدخول | Race condition: `load()` تُستدعى مرتين (مباشرة + INITIAL_SESSION) | الاعتماد على `onAuthStateChange` فقط | #18 |
| انتهاء الجلسة بعد ~ساعة | لا middleware لتجديد الـ token | إضافة `src/middleware.ts` | #18 |
| Header يكرر نفس race condition | `Header.tsx` كان ينشئ client مستقل مع `getSession()` | استخدام `useProfile()` hook مباشرة | #19 |
| الزوار يقدرون يدخلون الكتالوج بدون login | لا حماية على الـ routes | `AuthGuard` component يغلّف كل التطبيق | #29 |
| شاشة بيضاء لحظة بعد الدخول | `LoginForm` يُرجع null بعد الـ auth بينما الـ navigation لم تكتمل | AuthGuard يعرض overlay داكن بدل null خلال الانتقال | #29 |
| كل مستخدم يرى بيانات الآخرين (profiles/orders…) | الـ public views كانت `security_definer` فتتجاوز RLS | تحويل الـ14 view إلى `security_invoker = on` | #40 |
| الدخول باسم المستخدم يفشل (404) | `get_email_by_username` في `store` فقط، والعميل يستدعيها عبر `public` | إضافة wrapper `public.get_email_by_username` | #40 |
| صفحة `/account/security` تفشل (400) | schema الـ passkeys لم يُطبَّق + الـ view ناقص `passkey_credential_id` | تطبيق `20260603_passkeys.sql` + تحديث الـ view | #40 |
| Edge Functions تفشل: "permission denied for schema store" | `service_role` بلا صلاحيات على `store` | منح `service_role` وصولاً كاملاً | #40 |
| passkey لا يعمل في الإنتاج | `WEBAUTHN_RP_ID` افتراضي `ams110.github.io` لا يطابق الدومين | تصحيحه إلى `ams-groub.linko.services` | #40 |

## قرارات معمارية مهمة

### التسجيل مغلق للعموم
صفحة `/register` تعرض رسالة مغلق فقط. الحسابات الجديدة تُنشأ **حصراً** من `/admin/dealers` عبر Edge Function `admin-create-customer`.

### Toast System
`src/components/Toast.tsx` — `ToastProvider` موجود في `layout.tsx` ويغلّف كل الصفحات. أي component يحتاج toast يستخدم `useToast()` hook.

```ts
const toast = useToast();
toast("تم الحفظ");          // success (أخضر)
toast("خطأ ما", "error");   // error (أحمر)
toast("ملاحظة", "info");    // info (رمادي)
```

### Mobile Bottom Navigation
`src/components/Header.tsx` يعرض bottom nav ثابت في الأسفل على الموبايل (4 أزرار). الزر الرابع يتغير حسب الدور: زائر→كניسה، تاجر→הזמנות، admin→ניהול. Desktop nav ما تغير.

### صلاحيات المستخدمين
| الحالة | القدرات |
|--------|---------|
| زائر | تصفح الكتالوج (الأسعار مخفية) |
| موزع (pending) | لا شيء — ينتظر موافقة Admin |
| موزع (approved) | رؤية الأسعار، إضافة للسلة، الدفع |
| admin | كل شيء + إنشاء حسابات جديدة |
