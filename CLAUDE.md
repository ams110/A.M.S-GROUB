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
    admin/       # لوحة الإدارة — محمية بـ AdminLayout (admins, dealers, dealers/new, products, orders, quotes, inventory, suppliers, purchase-orders, customer-prices, settings)
                 #   page.tsx فيه "إجراءات سريعة" (إضافة زبون/منتج/عرض سعر/أمر شراء)
                 #   dealers/new = معالج إضافة تاجر/مقاول من شاشة واحدة + إرسال الدخول بواتساب
    account/     # حساب الموزّع: page.tsx (هَب "האזור האישי") + orders, quotes, order, security=passkey
    register/    # تسجيل موزع جديد (مغلق)
    welcome/     # splash screen بعد الدخول (ثم redirect لـ /products)
  components/
    AuthGuard.tsx  # حماية كل الـ routes — يُعرض في layout.tsx
    Header.tsx     # nav bar + bottom nav للموبايل (يظهر فقط للمسجّلين)
    CartProvider, ProductCard, AddToCart, Toast
  lib/
    auth.ts      # useProfile hook — جلسة المستخدم وبياناته
    passkey.ts   # WebAuthn (تسجيل/دخول بالبصمة) — ينادي Edge Functions + list/remove عبر RPC
    onboarding.ts # helpers لمعالج إضافة تاجر: توليد كلمة مرور، تطبيع هاتف، رسالة واتساب، wa.me link
    pricing.ts   # applyEffectivePrices — أسعار العميل الخاصة
    supabase/
      client.ts  # Supabase browser client (singleton)
    config.ts    # SUPABASE_URL, SUPABASE_ANON_KEY, BASE_PATH
    types.ts     # TypeScript types للـ DB
src/middleware.ts  # يجدد الـ session token (لا يعمل على static export)
public/          # logo.svg, placeholder.svg, icon-180/192/512.png, manifest.json (PWA)
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

### passkeys (WebAuthn / بصمة) — ⭐ متعدد الأجهزة
دخول بلا كلمة مرور عبر بصمة/Face ID. **كل حساب يدعم عدة passkeys (أجهزة متعددة)**:
- العميل: `src/lib/passkey.ts` (يستخدم `@simplewebauthn/browser`) — `registerPasskey()` / `authenticateWithPasskey()` / `listPasskeys()` / `removePasskey(id)`.
- الخادم: Edge Functions `passkey-register` (تتطلب JWT) و`passkey-auth` (عامة، تُستدعى قبل الدخول).
- **التخزين الفعلي:** جدول `store.passkey_credentials` (صف لكل جهاز) — **هو مصدر الحقيقة**. أعمدة `passkey_*` على `store.profiles` صارت **مهجورة** (بقيت للتوافق فقط؛ لا تُستخدم). جدول `store.passkey_challenges` للتحدّيات (service-role فقط).
- **الوصول من العميل عبر RPC** `list_passkeys()` / `remove_passkey(p_id)` — **لا view** لأن `public.passkey_credentials` محجوز لتطبيق آخر بنفس المشروع (نفس قصة push_subscriptions).
- التسجيل: `passkey-register` يستخدم `excludeCredentials` (يمنع تسجيل نفس الجهاز مرتين = يقتل التكرار) ويعمل `upsert` بالجدول مع `device_label` (اسم الجهاز يولّده العميل: "Chrome · Android"…).
- الدخول: `passkey-auth` يبحث عن الـ credential بالجدول عبر كل الأجهزة، يتحقق، يحدّث `counter` + `last_used_at`، ثم يولّد **`email_otp`** (مش hashed_token) ويرجّعه؛ العميل يكمل بـ `verifyOtp({ email, token, type: "email" })`.
- صفحة `/account/security` تعرض **قائمة الأجهزة المسجّلة** (اسم + تاريخ + آخر استخدام) مع إزالة فردية + زر "إضافة جهاز نוסף".
- **مهم:** `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` في الدالتين يجب أن يطابقا الدومين الفعلي **`ams-groub.linko.services`** (WebAuthn يفرض ذلك).
- **مكتبة `@simplewebauthn/server@9` مثبّتة لكن الكود يستخدم API نسخة 10+** (`registrationInfo.credential` و`verifyAuthenticationResponse({credential})`). دالة register تدعم الشكلين دفاعياً. **لا تكتب `registrationInfo.credentialID` فقط** — استخدم النمط الدفاعي الموجود.
- **حذف passkey من تطبيقنا يحذفها من قاعدة بياناتنا فقط — مش من Google Password Manager.** المستخدم لازم يحذف الـ passkey المعزولة من جوجل يدوياً (ما في API لذلك).
- **prompt تفعيل البصمة (مثل البنوك):** `src/components/PasskeyPrompt.tsx` يُعرض من `AuthGuard` بعد الدخول — يظهر بطاقة "فعّل الدخول بالبصمة" مرة واحدة إذا الجهاز يدعمها ولا توجد passkey بعد (يفحص عبر `listPasskeys()`) ولم يُرفض سابقاً (`localStorage: ams_passkey_prompt_dismissed`). زر الدخول بالبصمة بصفحة الدخول يظهر فقط بعد التسجيل على الجهاز (hint محلي).

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
- `store.passkey_credentials` — passkeys مسجّلة (صف لكل جهاز): `credential_id` فريد، `public_key`، `counter`، `device_label`، `last_used_at`. وصول العميل عبر RPC `list_passkeys`/`remove_passkey` فقط
- `store.passkey_challenges` — تحدّيات WebAuthn (service-role فقط)
- `store.settings`, `store.banners`
- `store.sales_targets` — أهداف المبيعات الشهرية (month PK + target) للوحة العمليات
- `store.push_subscriptions` — اشتراكات Web Push (لكل جهاز/مستخدم) — تُدار عبر RPC `push_subscribe`/`push_unsubscribe`
- `store.app_config` — أسرار الخادم (مفاتيح VAPID + `push_hook_secret`) — **RLS بلا policies وبلا grants → لا يقرأها إلا service_role**. لا تكشفها أبداً للعميل
- `store.products.cost` — تكلفة الوحدة (لحساب الربح الحقيقي؛ القيمة 0 ⇒ يُقدَّر من متوسط شراء)

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
  20260604_admin_ops_stats.sql                # RPC admin_ops_stats(days) — لوحة العمليات (نسخة أولى)
  20260604_product_cost.sql                   # عمود store.products.cost + تحديث public.products view
  20260604_sales_targets.sql                  # جدول الأهداف الشهرية + view + RLS
  20260604_push_subscriptions.sql             # جدول اشتراكات Push + RPC push_subscribe/unsubscribe
  20260604_app_config_push.sql                # جدول الأسرار app_config (مفاتيح VAPID + hook secret)
  20260604_admin_ops_dashboard.sql            # RPC admin_ops_dashboard(from,to) — اللوحة الغنية (مقارنة/هوامش/توقع/نشاط/هدف)
  20260604_notify_new_order.sql               # trigger يُشعر الأدمن عبر pg_net→push-send عند طلب جديد
  20260604_multi_passkey.sql                  # جدول store.passkey_credentials (متعدد الأجهزة) + RPC list_passkeys/remove_passkey + ترحيل من profiles
  20260604_accept_my_quote.sql                # RPC accept_my_quote — التاجر يقبل عرض سعره ويحوّله لطلب (تحقق ملكية/صلاحية/مخزون) + wrapper public
```

### محرّكات منطق مشتركة (pure logic، بلا React/Supabase، مختبَرة)
ملفات نقية في `src/lib/` تُعيد استخدامها عدة شاشات — أضف الاختبار في `src/__tests__/lib/`:
- `ar.ts` — تقادم الديون: مستحق/متأخر/buckets حسب `payment_terms`. تستخدمه: `/admin/dealers`، `ReceivablesPanel` (OpsCenter)، `/cart`، `/checkout`.
- `margin.ts` — ربح/هامش% + حارس "تحت التكلفة"/"هامش ضعيف" + تسعير جماعي. تستخدمه: `/admin/customer-prices`، `/admin/quotes`، `/admin/products`.
- `messages.ts` — قوالب واتساب (تذكير دفع، عرض، فاتورة، استرجاع زبون، أمر شراء) فوق `waLink`. تستخدمه: dealers، invoice، quotes، purchase-orders، OpportunitiesPanel.
- `activity.ts` — كشف الزبائن المتوقّفين والمخزون الميت (recency). تستخدمه: `OpportunitiesPanel` (OpsCenter).
- `cartFromOrder.ts` — `resolveReorder`: يحوّل عناصر طلب سابق لأسطر سلة. تستخدمه: `/account/order`، `/account/orders`.

### Edge Functions (`supabase/functions/`)
- `admin-create-customer` — إنشاء حساب موزّع جديد (service role). يقبل: email, password, full_name, company, phone, customer_type. **لا يضبط** username/credit_limit/payment_terms — يضبطها العميل بعد الإنشاء (معالج `/admin/dealers/new`).
- `passkey-register` — تسجيل passkey (تتطلب JWT، `verify_jwt=true`). يكتب في `store.passkey_credentials` (upsert + excludeCredentials). كل خطوة finish بـ try/catch تُرجع رسالة واضحة بدل 500.
- `passkey-auth` — دخول بـ passkey (عامة، `verify_jwt=false`). يبحث في `store.passkey_credentials`، ويُرجع `email_otp` للعميل.
- `push-send` — إرسال Web Push (عامة، `verify_jwt=false`). تتحقق من الصلاحية داخلياً: إما `push_hook_secret` (من trigger الطلبات) أو JWT أدمن (زر الاختبار). تقرأ مفاتيح VAPID من `store.app_config` وترسل لاشتراكات الأدمن.
> الدوال تستخدم `service_role` + `.schema("store")`. متغيرات `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` يجب أن تطابق `ams-groub.linko.services`.

### لوحة العمليات (Operations Center) — `/admin`
- البيانات كلها من RPC واحدة `admin_ops_dashboard(p_from, p_to)` (SECURITY DEFINER، محمية بـ `store.is_admin()`، wrapper في public). ترجّع jsonb: kpi + مقارنة بالفترة السابقة + series يومية + top_products (بهامش) + categories + low_stock (مع توقّع نفاد days_left) + activity + goal.
- الربح = الإيراد − COGS؛ التكلفة = `products.cost` إن >0 وإلا متوسط شراء (`stock_movements`→`purchase_order_items`).
- فلتر تاريخ: أزرار جاهزة + مدى مخصص (from/to). تصدير CSV. تحديث صامت كل 60ث. رسم بياني تفاعلي (revenue/profit/orders + tooltip).

### Web Push — التدفّق الكامل
1. العميل (`src/lib/push.ts`) يسجّل `public/sw.js`، يطلب الإذن، يشترك بـ `PushManager` بمفتاح `VAPID_PUBLIC_KEY` (في `config.ts`)، ويخزّن الاشتراك عبر RPC `push_subscribe`.
2. عند طلب جديد: trigger `trg_notify_new_order` ينادي `push-send` عبر pg_net حاملاً `push_hook_secret`.
3. `push-send` يوقّع بـ VAPID (المفتاح الخاص من `app_config`) ويرسل لكل اشتراكات الأدمن؛ ويحذف الاشتراكات الميتة (404/410).
- التفعيل من `/account/security` (سويتش + زر اختبار للأدمن). **المفتاح الخاص لا يوجد إلا في `store.app_config`** (ليس في env ولا في الريبو).

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
| البصمة وعروض الأسعار بلا مدخل على الموبايل | شريط الموبايل (4 خانات) يُغفلها؛ موصولة بالديسكتوب فقط | صفحة `/account` هَب + التبويب الرابع للموزّع → `/account` | #42 |
| أيقونة التطبيق باهتة على iPhone | `apple-touch-icon` كان SVG (iOS لا يدعمه) | توليد أيقونات PNG (180/192/512) من الشعار وربطها | #43 |
| `public.push_subscriptions` محجوز لتطبيق آخر بنفس المشروع | تصادم نمط "view بنفس اسم الجدول" | إبقاء الجدول في `store` والوصول عبر RPC بدل view عام | — |
| إشعارات Push تحتاج سر VAPID خاص بالخادم وما في طريقة لضبط env secret عبر MCP | — | تخزين المفتاح الخاص في `store.app_config` (RLS بلا policies؛ service_role فقط) وتقرأه `push-send` | — |
| إضافة تاجر مبعثرة على عدة صفحات (إنشاء + شروط + لا طريقة لإرسال الدخول) | الفورم القديم أساسي فقط | معالج `/admin/dealers/new` بأربع خطوات + إرسال الدخول بواتساب (`wa.me`) | #60 |
| تسجيل البصمة يفشل بـ 500 على `finish` بعد التقاط البصمة | الكود يقرأ `registrationInfo.credential` (API v10+) بينما الـ import مثبّت `@9` → `cred` undefined → استثناء غير ملتقط | دعم الشكلين + تغليف finish بـ try/catch يُرجع رسالة | #62 |
| تسجيل البصمة يفشل بـ 401 unauthorized | توكن الجلسة منتهٍ (لا middleware على static export) | `registerPasskey` يجدّد الجلسة (`refreshSession`) قبل النداء | #61 |
| passkey مكرّرة بجوجل + فشل دخول عشوائي | التصميم كان يخزّن passkey وحدة تُكتب فوق بعضها؛ إعادة التسجيل تيتّم القديمة | جدول `store.passkey_credentials` متعدد الأجهزة + `excludeCredentials` يمنع التكرار | #62 |
| الدخول بالبصمة لا يكتمل رغم نجاح `passkey-auth` (200) | الدالة تُرجع `hashed_token` والعميل يمرّره كـ `token` لـ `verifyOtp` (يحتاج OTP فعلي) → الجلسة لا تُنشأ | إرجاع `email_otp` + `verifyOtp({email, token, type:"email"})` | #63 |

## قرارات معمارية مهمة

### التسجيل مغلق للعموم
صفحة `/register` تعرض رسالة مغلق فقط. الحسابات الجديدة تُنشأ **حصراً** من `/admin/dealers` عبر Edge Function `admin-create-customer`.

### معالج إضافة تاجر/مقاول — `/admin/dealers/new`
شاشة واحدة بأربع خطوات (RTL) لإضافة زبون كامل بدون التنقّل بين صفحات:
1. **النوع** (سוחر/קבלן) → 2. **المعلومات** (اسم، شركة، هاتف، إيميل) → 3. **الشروط** (يوزرنيم + كلمة مرور بتوليد تلقائي 🎲؛ وللسوחر: سقف ائتمان + شروط دفع) → 4. **النجاح**.
- الإنشاء عبر `admin-create-customer`، ثم العميل يحدّث `username`/`credit_limit`/`payment_terms` على البروفايل مباشرة (الـ Edge Function لا يضبطها).
- شاشة النجاح: بيانات الدخول قابلة للنسخ + **زر واتساب** يفتح محادثة الزبون برسالة جاهزة (رابط الدخول + يوزرنيم + باسوورد) عبر `wa.me` (يعمل على static export بدون سيرفر؛ تطبيع أرقام إسرائيل `05x`→`9725x` في `src/lib/onboarding.ts`).
- مدخل المعالج: زر بارز أعلى `/admin/dealers` + بطاقة "إجراءات سريعة" في `/admin`. الفورم القديم انطوى داخل `<details>` ("فتح حساب سريع").
- ⚠️ الواتساب يفتح المحادثة بالرسالة معبّأة والأدمن يضغط "إرسال" (سلوك `wa.me`) — لا إرسال تلقائي (ما في WhatsApp Business API بالمشروع).

### Toast System
`src/components/Toast.tsx` — `ToastProvider` موجود في `layout.tsx` ويغلّف كل الصفحات. أي component يحتاج toast يستخدم `useToast()` hook.

```ts
const toast = useToast();
toast("تم الحفظ");          // success (أخضر)
toast("خطأ ما", "error");   // error (أحمر)
toast("ملاحظة", "info");    // info (رمادي)
```

### التنقّل وصفحة "حسابي" (مهم: تطابق ديسكتوب/موبايل)
`src/components/Header.tsx` فيه شريطان: nav علوي للديسكتوب (`md:flex`) وbottom nav للموبايل (`md:hidden`، 4 أزرار).
- **شريط الموبايل (4 خانات):** ראשי / קטלוג / עגלה / [الرابع]. الرابع حسب الدور: زائر→login، **موزّع→חשבون (`/account`)**، admin→ניהول.
- **صفحة `/account` ("האזور האישי")** هي هَب الموزّع: تجمع روابط الطلبات + عروض الأسعار + الأمان/البصمة + تسجيل الخروج. أُنشئت لأن شريط الموبايل (4 خانات) كان يُغفل عروض الأسعار والأمان — والبصمة ميزة موبايل بالأساس.
- شريط الديسكتوب يعرض رابط "חשבون" لكل المسجّلين (شامل الأدمن) → الأمان/البصمة متاح للجميع.
- **القاعدة:** أي صفحة/ميزة جديدة — تأكّد أن لها مدخلاً في **كلا** الشريطين، لا الديسكتوب وحده.

### PWA — التثبيت على الهاتف
التطبيق قابل للتثبيت كتطبيق (يفتح standalone بملء الشاشة).
- `public/manifest.json` مربوط في `layout.tsx` (`<link rel="manifest">`)؛ `display: standalone`، لون `#0D1B36`.
- **الأيقونات:** `icon-180.png` (apple-touch-icon لـ iOS) + `icon-192/512.png` (manifest لأندرويد). ⚠️ iOS لا يدعم SVG لأيقونة الشاشة الرئيسية — لذلك PNG ضروري.
- وسوم iOS في `layout.tsx`: `apple-mobile-web-app-capable` + `-status-bar-style` + `-title` + `theme-color`.
- **إعادة توليد الأيقونات** عند تغيير الشعار: من `public/logo.svg` (نسخة بملء المربّع: `rx="36"`→`0`) عبر Chromium بأحجام 180/192/512.
- التثبيت: iPhone (Safari → مشاركة → "إضافة إلى الشاشة الرئيسية")؛ Android (Chrome → ⋮ → "تثبيت التطبيق"). ملاحظة: iOS يخزّن الأيقونة بالكاش — احذف وأعد الإضافة بعد تغييرها.

### صلاحيات المستخدمين
| الحالة | القدرات |
|--------|---------|
| زائر | تصفح الكتالوج (الأسعار مخفية) |
| موزع (pending) | لا شيء — ينتظر موافقة Admin |
| موزع (approved) | رؤية الأسعار، إضافة للسلة، الدفع |
| admin | كل شيء + إنشاء حسابات جديدة |
