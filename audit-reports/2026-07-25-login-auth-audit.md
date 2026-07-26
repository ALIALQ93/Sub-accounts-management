# تدقيق دقيق — تسجيل الدخول (Login/Auth)

منهجية: قراءة الكود الفعلي لـ `web/src/app/login/**`, `web/src/modules/auth/auth-context.tsx`, `web/src/lib/supabase/env.ts`, `web/src/lib/supabase/middleware.ts`, `web/src/middleware.ts`, و`web/src/app/api/admin/users/route.ts` (كمرجع لاستخدام مفتاح الخادم). تم البحث عن `NEXT_PUBLIC_SKIP_AUTH` عبر كامل الشجرة (كود + إعدادات) للتحقق من أنه لا يُفعَّل في أي مسار نشر فعلي، وليس فقط في الكود المصدري.

## 1. ✅ `NEXT_PUBLIC_SKIP_AUTH` — تحقّق: لا يزال محصوراً في CI فقط، لا أثر له في أي إعداد نشر

- التعريف: `web/src/lib/supabase/env.ts:16-18` — `isAuthDisabled()` يرجع `true` فقط إذا `process.env.NEXT_PUBLIC_SKIP_AUTH === "true"` حرفياً.
- الاستخدام: `web/src/middleware.ts` → `updateSession()` في `web/src/lib/supabase/middleware.ts:31-33` يتخطى كل فحص الجلسة/الجلسة إن كان `isAuthDisabled()`، وكذلك `auth-context.tsx:56-70` يستخدم `DEV_PROFILE`/`DEV_PERMISSIONS` (صلاحيات admin كاملة، `authDisabled` من `env.ts`) بدل تحميل مستخدم حقيقي.
- أماكن الضبط الموجودة فعلياً في المشروع:
  - `.github/workflows/web-ci.yml:23` — `NEXT_PUBLIC_SKIP_AUTH: "true"` ضمن خطوة `lint-and-build` فقط (بيئة CI معزولة، لا نشر فعلي من هذا الـworkflow — فقط `lint`/`build`).
  - `web/.env.example:7` — السطر معلَّق (`# NEXT_PUBLIC_SKIP_AUTH=true`) مع تعليق صريح "not for production".
  - `web/.env.local` (ملف محلي فعلي على هذا الجهاز) — **لا يحتوي** `NEXT_PUBLIC_SKIP_AUTH` إطلاقاً (تحقَّق منه مباشرة).
  - لا يوجد `vercel.json`/`netlify.toml`/أي ملف إعداد نشر آخر في المستودع يضبط متغيرات بيئة.

**الخلاصة: الافتراض السابق لا يزال صحيحاً — لا مسار نشر فعلي في هذا المستودع يُفعِّل `NEXT_PUBLIC_SKIP_AUTH`.** المخاطرة الوحيدة المتبقية تشغيلية بحتة: لو ضبط أحدهم يدوياً هذا المتغير على منصة الاستضافة (Vercel/غيرها) بالخطأ نقلاً من CI، يتعطل تسجيل الدخول بالكامل فوراً لكل المستخدمين — أي أن الخطر العملي هو "تعطيل الحماية بالكامل" وليس تسرّباً تدريجياً، وهو غياب الحد الأدنى، وهذا فقط عند إعداد يدوي خاطئ خارج ما يوثّقه هذا الكود.

## 2. الـmiddleware يحمي كل المسارات بشكل صحيح، بما فيها `/api/*`... تقريباً

`web/src/lib/supabase/middleware.ts:73` يحوّل أي زائر غير مسجَّل دخول لصفحة `/login` **إلا** إن كان المسار ضمن `PUBLIC_PATHS = ["/login"]` (`middleware.ts:5`) أو `isApiRoute` (يبدأ بـ`/api/`، `middleware.ts:70`). أي طلب `/api/*` **لا يُحجب على مستوى الـmiddleware مهما كانت حالة تسجيل الدخول** — الاعتماد الكامل على أن كل route handler يتحقق بنفسه (كما يفعل `/api/admin/users/route.ts` عبر `assertAdmin()`). هذا نمط معقول (fail-open على مستوى الـmiddleware، fail-closed داخل كل route)، لكنه هش: أي `route.ts` مستقبلي يُضاف تحت `/api/` **بلا** استدعاء فحص مصادقة داخلي يكون مكشوفاً بالكامل بلا أي شبكة أمان من الـmiddleware. حالياً يوجد route واحد فقط (`/api/admin/users`) وهو محمي بشكل صحيح، لكن هذا يستحق توثيقاً كقاعدة معمارية يجب الانتباه لها عند إضافة أي `/api/*` جديد.

## 3. لا قفل بعد محاولات فاشلة متكررة (Rate limiting) على مستوى التطبيق

`LoginForm` (`web/src/app/login/login-form.tsx:17-30`) يستدعي `settingsApi.signIn()` → `supabase.auth.signInWithPassword()` مباشرة بلا أي تقييد محلي (لا عدّاد محاولات، لا تأخير تصاعدي، لا CAPTCHA). الاعتماد الكامل على حماية Supabase Auth المدمجة (rate limiting على مستوى المشروع)، وهذا مقبول كخط دفاع أساسي لتطبيق بحجم "محاسب واحد + عدد محدود من الموظفين"، لكنه يستحق ملاحظة: لا توجد طبقة تطبيق إضافية (مثل قفل الحساب محلياً بعد N محاولة) تتحكم بها الشركة نفسها.

## 4. لا مسار "نسيت كلمة المرور" في واجهة تسجيل الدخول

`login-form.tsx` (الملف كاملاً) لا يحتوي أي رابط أو زر لإعادة تعيين كلمة المرور (لا `resetPasswordForEmail`، ولا رابط "نسيت كلمة المرور؟"). بحث شامل عن `resetPassword`/`forgotPassword` في `web/src` لم يُظهر أي نتيجة. المستخدم الذي ينسى كلمة مروره يعتمد كلياً على تدخّل يدوي من مدير النظام عبر لوحة Supabase مباشرة (نفس الفجوة المذكورة في تقرير المستخدمين، البند 4) — فجوة وظيفية وليست أمنية، لكنها تجعل استرداد الحساب بطيئاً وغير موثَّق داخل التطبيق نفسه.

## 5. رسائل الخطأ في `login-form.tsx` تمرَّر كما هي من Supabase دون تعريب/تنميط موحّد

`onSubmit` (`login-form.tsx:17-30`) يعرض `err.message` الخام من Supabase مباشرة عند الفشل (`catch (err) { setError(err instanceof Error ? err.message : ...) }`) — رسائل Supabase الافتراضية بالإنجليزية (مثل `"Invalid login credentials"`) ستظهر للمستخدم العربي دون ترجمة، خلافاً لبقية شاشات التطبيق التي تستخدم رسائل عربية مخصصة (`"فشل تسجيل الدخول."` تظهر فقط إن لم يكن `err` من نوع `Error`، وهي حالة نادرة عملياً — الحالة الشائعة "بيانات دخول خاطئة" تمر كنص Supabase الخام).

## 6. تنسيق العناصر في `login-form.tsx` لا يتبع نظام الأزرار/الألوان المشترك

- خطأ تسجيل الدخول: `border-rose-200 bg-rose-50 text-rose-700` (`login-form.tsx:61-65`) بدل `var(--danger)` المستخدم في صفحات أخرى (`web/src/app/globals.css:23`).
- زر الدخول: `rounded-lg bg-[var(--brand-navy)] ...` (`login-form.tsx:67-73`) — يستخدم متغير الهوية اللونية مباشرة لكن بصياغة يدوية كاملة بدل كلاس `.btn`/`.btn-primary` المُعرَّف في `globals.css:123-157`. لا يكسر الوظيفة، لكنه لا يستفيد تلقائياً من أي تحديث مستقبلي على `.btn-primary` (مثل تغيير الحشو أو نصف القطر).

## ملخّص الفجوات

| # | الملاحظة | الموقع | الخطورة |
|---|---|---|---|
| 1 | `NEXT_PUBLIC_SKIP_AUTH` محصور فعلياً بـCI فقط — لا أثر في أي إعداد نشر بالمستودع | `web/src/lib/supabase/env.ts:16-18`, `.github/workflows/web-ci.yml:23` | ✅ تحقّق سليم (خطر تشغيلي فقط عند ضبط يدوي خاطئ) |
| 2 | مسارات `/api/*` غير محمية على مستوى الـmiddleware — الاعتماد الكامل على فحص داخلي لكل route | `web/src/lib/supabase/middleware.ts:70-78` | 🟡 متوسط (معماري، لا استغلال حالي) |
| 3 | لا rate limiting على مستوى التطبيق لمحاولات الدخول الفاشلة | `login-form.tsx:17-30` | 🟡 متوسط |
| 4 | لا مسار "نسيت كلمة المرور" في الواجهة | `login-form.tsx` (كامل الملف) | 🟡 متوسط |
| 5 | رسائل خطأ Supabase الخام (إنجليزية) تظهر للمستخدم دون تعريب | `login-form.tsx:25-27` | 🔵 معماري |
| 6 | أزرار/رسائل خطأ صفحة الدخول تخرج عن نظام التصميم المشترك | `login-form.tsx:61-73` | 🔵 معماري |

## توصيات مرتّبة حسب الأولوية

### 🟡 متوسط

1. **أضف تعليقاً/فحصاً معمارياً صريحاً**: أي `route.ts` جديد تحت `/api/` يجب أن يبدأ بفحص مصادقة (نمط `assertAdmin()` في `api/admin/users/route.ts:23-46`) — فكِّر بإضافة سطر توثيقي في `middleware.ts` نفسه يذكّر بذلك، بما أن الـmiddleware لا يوفر حماية افتراضية لهذه المسارات.
2. **أضف رابط "نسيت كلمة المرور؟"** يستدعي `supabase.auth.resetPasswordForEmail()`، مع صفحة تأكيد بسيطة — يغلق فجوة الاعتماد الكلي على تدخل المدير اليدوي.
3. **قيّم إضافة تقييد محلي بسيط لمحاولات الدخول** (مثلاً تعطيل الزر لثوانٍ بعد كل فشل متتالٍ) كطبقة دفاع إضافية فوق حماية Supabase، خاصة أن التطبيق يخدم بيانات محاسبية حساسة.

### 🔵 معماري

4. **ترجم/وحّد رسائل الخطأ في `login-form.tsx`** — طبّق تعريب نمطي على `err.message` بدل عرضه كما يصل من Supabase.
5. **استبدل التنسيق اليدوي في `login-form.tsx` بكلاسات `.btn`/`.btn-primary` و`var(--danger)`** أسوة ببقية شاشات التطبيق.

## ملحق — ملفات مرجعية رئيسية

- `web/src/lib/supabase/env.ts` — `isAuthDisabled()`/`getSupabaseEnv()`.
- `web/src/lib/supabase/middleware.ts` — منطق الحماية الكامل لكل الطلبات (`updateSession`).
- `web/src/middleware.ts` — نطاق تطبيق الـmiddleware (`matcher`).
- `web/src/app/login/login-form.tsx`, `web/src/app/login/page.tsx` — نموذج الدخول والصفحة المضيفة.
- `web/src/modules/auth/auth-context.tsx` — `DEV_PROFILE`/`DEV_PERMISSIONS` عند `authDisabled`.
- `.github/workflows/web-ci.yml`, `web/.env.example`, `web/.env.local` — كل مواضع ضبط `NEXT_PUBLIC_SKIP_AUTH` الموجودة فعلياً في المستودع.
