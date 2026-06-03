# Tiandy Store — CLAUDE.md

دليل للـ AI عند العمل على هذا المشروع.

## نظرة عامة

بوابة طلبات B2B لموزع Tiandy الرسمي في إسرائيل. الموزعون المعتمدون يسجلون دخولهم ويتصفحون الكتالوج بأسعار الجملة ويضعون الطلبات. المدير يدير المنتجات والأسعار والمخزون من لوحة إدارة.

- **Next.js 15** (App Router, TypeScript) + Tailwind CSS
- **Supabase** — Postgres, Auth, Row Level Security
- **Static export** مستضاف على GitHub Pages (كل الكود يعمل في المتصفح، بلا SSR)
- واجهة بالعبرية (RTL)

## بنية المشروع

```
src/
  app/           # صفحات Next.js (كلها "use client")
    admin/       # لوحة الإدارة — محمية بـ AdminLayout
    account/     # صفحات الموزع (طلبات، عروض أسعار)
    login/       # تسجيل الدخول
    register/    # تسجيل موزع جديد
  components/    # Header, CartProvider, ProductCard, AddToCart
  lib/
    auth.ts      # useProfile hook — جلسة المستخدم وبياناته
    supabase/
      client.ts  # Supabase browser client (singleton)
    config.ts    # SUPABASE_URL, SUPABASE_ANON_KEY
    types.ts     # TypeScript types للـ DB
src/middleware.ts  # يجدد الـ session token تلقائياً
```

## Auth — أهم قواعد العمل

### Singleton Client
`createClient()` في `src/lib/supabase/client.ts` يُعيد **نفس الـ instance** دائماً (singleton). **لا تحذف هذا النمط أبداً** — إنشاء instance جديد في كل استدعاء يتسبب في ضياع الجلسة عند الـ refresh.

### useProfile Hook
`src/lib/auth.ts` يعتمد على `onAuthStateChange` كمصدر وحيد للجلسة. يطلق `INITIAL_SESSION` فوراً عند mount الـ component بالـ session الحالية من الـ cookies. **لا تضيف استدعاء منفصل لـ `getSession()`** — هاد كان يسبب race condition وتعليق الصفحة.

### Middleware
`src/middleware.ts` يستدعي `getUser()` على كل request لتجديد الـ session cookies قبل انتهاء صلاحية الـ access token (~ساعة). **لا تحذف هذا الملف**.

### صلاحيات المستخدمين
| الحالة | القدرات |
|--------|---------|
| زائر | تصفح الكتالوج (الأسعار مخفية) |
| موزع (pending) | تسجيل — ينتظر موافقة المدير |
| موزع (approved) | رؤية الأسعار، إضافة للسلة، الدفع |
| admin | كل شيء |

## قاعدة البيانات

كل شيء في **schema منفصل `store`** داخل مشروع Supabase، منفصل تماماً عن جداول الموقع الرئيسي (`public.tiandy_il_*`).

### الجداول الرئيسية
- `store.profiles` — حسابات الموزعين/الإدارة (تُنشأ تلقائياً عند التسجيل بحالة `pending`)
- `store.products`, `store.categories` — الكتالوج
- `store.orders`, `store.order_items` — الطلبات
- `store.settings`, `store.banners`

### أمان الطلبات
الطلبات تُنشأ عبر دالة Postgres `store.place_order` (SECURITY DEFINER) — تعيد حساب الأسعار من DB، تتحقق من المخزون، تُنقصه، وتكتب الطلب atomically. **العميل لا يضع الأسعار أبداً**.

### Migrations
```
supabase/migrations/
  0001_store_schema.sql                # الـ schema الأساسي
  20260601_pricing_and_credit.sql      # نظام التسعير والائتمان
  20260601_tax_invoices.sql            # فواتير ضريبية
  20260601_warehouse_module.sql        # إدارة المستودع
```

## أوامر مفيدة

```bash
npm run dev      # تشغيل محلي على localhost:3000
npm run build    # بناء static export
npm run lint     # فحص الكود
```

## GitHub Actions

`.github/workflows/nextjs.yml` — بيبني وبينشر تلقائياً على GitHub Pages عند كل push لـ main.

## مشاكل سبق حلّها

| المشكلة | السبب | الحل | PR |
|---------|-------|------|----|
| ضياع الجلسة عند refresh | `createClient()` تنشئ instance جديد في كل استدعاء | Singleton pattern في `client.ts` | #18 |
| تعليق الصفحة بعد الدخول | Race condition: `load()` تُستدعى مرتين (مباشرة + INITIAL_SESSION) | الاعتماد على `onAuthStateChange` فقط | #18 |
| انتهاء الجلسة بعد ~ساعة | لا middleware لتجديد الـ token | إضافة `src/middleware.ts` | #18 |
| Header يكرر نفس race condition | `Header.tsx` كان ينشئ client مستقل مع `getSession()` | استخدام `useProfile()` hook مباشرة | #19 |

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
