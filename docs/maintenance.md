# دليل الصيانة والتشغيل — Â.M.Ŝ GROUP

> الهدف: أي مطوّر (حتى لو مش اللي بنى المشروع) يقدر يصونه ويشغّله ويتصرّف وقت الطوارئ.
> هاد الدليل يقلّل خطر "الاعتماد على شخص واحد" (bus factor). لصاحب المشروع غير المبرمج: استعمل قسم **"وقت الطوارئ"** و**"جهات الاتصال"**.

---

## 1) من وين يبدأ أي مطوّر جديد

1. اقرأ `CLAUDE.md` (نظرة كاملة عن المشروع + قواعد العمل + مشاكل سبق حلّها).
2. اقرأ `docs/screen-guide.md` (دليل الشاشات والأزرار).
3. اقرأ ملفات المقارنة في `docs/` لفهم الموقع التنافسي.
4. شغّل محلياً (القسم 3 تحت).

---

## 2) المعمارية بسطرين

- **الواجهة:** Next.js 15 (static export) → تُستضاف على **GitHub Pages** (`ams-groub.linko.services`).
- **الخلفية:** **Supabase** (Postgres + Auth + Edge Functions). كل المنطق بالمتصفح، بلا سيرفر خاص.
- **النشر تلقائي:** عند الدفع لـ`main` → GitHub Actions يبني وينشر الموقع + يطبّق ميجريشن قاعدة البيانات.

---

## 3) التشغيل المحلي

```bash
npm ci          # تركيب الحزم (نسخة مطابقة للـlock)
npm run dev     # تشغيل محلي على http://localhost:3000
npm run lint    # فحص الكود
npm run test    # تشغيل الاختبارات (Jest)
npm run build   # بناء static export (مجلد out/)
```

> ⚠️ قبل أي دفع لـ`main`: تأكّد إنه `npm run lint` و`npm run test` و`npm run build` كلهم ناجحين (نفس ما يفعل الـCI).

---

## 4) الأسرار والمتغيّرات (وين كل مفتاح)

| المفتاح | وين | عام/سري |
|---------|-----|---------|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | `src/lib/config.ts` (وenv override) | عام (آمن بالمتصفح) |
| `VAPID_PUBLIC_KEY` (Web Push) | `src/lib/config.ts` | عام |
| المفاتيح الخاصة (VAPID private, `push_hook_secret`) | جدول `store.app_config` (service_role فقط) | **سري — لا يظهر بالمتصفح ولا بالريبو** |
| `SUPABASE_SERVICE_ROLE_KEY` | أسرار Edge Functions على Supabase | **سري** |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` | أسرار Edge Functions = `ams-groub.linko.services` | إعداد |

### أسرار GitHub Actions المطلوبة
| السر | لشو | وين تجيبه |
|------|-----|-----------|
| `SUPABASE_DB_URL` | تطبيق الميجريشن تلقائياً عبر CI | Supabase → Project Settings → Database → Connection string (URI) |

> أضِفها من: GitHub repo → Settings → Secrets and variables → Actions.

---

## 5) قاعدة البيانات والميجريشن

- كل تغيير على القاعدة = **ملف ميجريشن جديد** في `supabase/migrations/` (تسمية بالتاريخ، مثل `20260608_*.sql`).
- التطبيق صار **تلقائياً** عبر `.github/workflows/supabase-migrations.yml` عند الدفع لـ`main` (يطبّق فقط الملفات الجديدة).
- تطبيق يدوي وقت الحاجة (عبر Supabase MCP `apply_migration` أو CLI):
  ```bash
  supabase db push --db-url "<SUPABASE_DB_URL>"
  ```
- **قاعدة ذهبية:** لكل جدول `store.x` لازم **view في `public.x`** بـ`security_invoker = on`، ولكل دالة `store.fn` لازم **wrapper في `public.fn`**. (تفاصيل في `CLAUDE.md`).

---

## 6) Edge Functions

موجودة في `supabase/functions/`: `passkey-register`, `passkey-auth`, `push-send`, `admin-create-customer`, `admin-reset-password`.

- النشر: `supabase functions deploy <name>`.
- `passkey-*` تستخدم `@simplewebauthn/server@10` — **عند أي ترقية لهالمكتبة لازم اختبار فعلي على جهاز حقيقي** (بصمة/Face ID) بعد النشر، لأنها لا تُختبر تلقائياً.
- متغيّرات `WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN` يجب أن تطابق الدومين الفعلي.

---

## 7) وقت الطوارئ (Runbook) — لصاحب المشروع والمطوّر

| العطل | أول خطوة |
|-------|-----------|
| **الموقع لا يفتح** | افحص GitHub → Actions: هل آخر deploy نجح؟ افحص حالة GitHub Pages وصلاحية دومين `linko.services`. |
| **الدخول بالبصمة فشل للجميع** | افحص سجلّات Edge Functions `passkey-auth`/`passkey-register` على Supabase. تأكّد `WEBAUTHN_RP_ID`=الدومين. الدخول بكلمة المرور يبقى بديلاً دائماً. |
| **لا أحد يقدر يدخل** | افحص حالة مشروع Supabase (مش متوقّف). افحص صلاحية مفاتيح Auth. |
| **الأسعار/الطلبات غلط** | المنطق في `place_order` (خادمي). افحص آخر ميجريشن طُبّق. |
| **الإشعارات Push وقفت** | افحص Edge Function `push-send` + مفاتيح VAPID في `store.app_config`. |
| **توقّف الموقع بعد تعديل** | ارجع للوراء: `git revert <commit>` ثم push لـ`main` (النشر تلقائي). |

> 🆘 **التراجع السريع عن أي تغيير كسر الموقع:** ارجع لآخر commit سليم على `main` (revert) — GitHub Actions يعيد النشر تلقائياً خلال دقائق.

---

## 8) النسخ الاحتياطي (Backup)

- **قاعدة البيانات:** Supabase يعمل نسخ احتياطية تلقائية (حسب الباقة). للباقة المدفوعة: Point-in-Time Recovery. **يُنصح بتفعيل Pro plan للإنتاج** (بلا توقّف + نسخ أفضل).
- **الكود:** محفوظ على GitHub (هو النسخة الاحتياطية).
- **تصدير يدوي دوري مقترح:** تصدير جداول `store` المهمّة (orders, profiles, products) CSV شهرياً للأمان.

---

## 9) جهات الاتصال والاعتماديات الخارجية

| الخدمة | الدور | لوحة التحكّم |
|--------|-------|--------------|
| GitHub | الكود + النشر (Pages + Actions) | github.com/ams110/A.M.S-GROUB |
| Supabase | قاعدة البيانات + Auth + Functions | supabase.com (مشروع المتجر) |
| الدومين | `ams-groub.linko.services` (CNAME) | مزوّد دومين linko.services |

> ✍️ **املأ هون:** اسم/إيميل المطوّر الأساسي + مطوّر احتياطي + من يملك حسابات GitHub/Supabase/الدومين.

---

## 10) خطة صيانة دورية مقترحة

| كل | المهمة |
|----|--------|
| أسبوعياً | فحص أن آخر deploy نجح + فحص الطلبات الجديدة تصل |
| شهرياً | `npm audit` للثغرات + تحديث الحزم الصغيرة + تصدير backup يدوي |
| ربع سنوي | مراجعة استهلاك Supabase (هل يحتاج ترقية باقة؟) + اختبار الدخول بالبصمة على جهاز |
| سنوياً | تجديد الدومين + مراجعة أمنية (RLS/الأسرار) + ترقية Next.js للنسخة المستقرة |
