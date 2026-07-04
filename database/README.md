# إعداد قاعدة البيانات

ملفات SQL منظّمة لإعادة تثبيت المخطط المحاسبي من الصفر على Supabase.

## ⚠️ تحذير

تشغيل **`setup_all.sql`** أو **`00_reset.sql`** يحذف **جميع** البيانات المحاسبية (حسابات، سندات، قيود، عملاء، مستخدمين، …).  
استخدمه في بيئة التطوير أو عند إعادة ضبط المشروع — وليس على بيانات إنتاج حقيقية.

## الطريقة السريعة (موصى بها)

في **Supabase → SQL Editor**، انسخ والصق محتوى:

```
database/setup_all.sql
```

ملف واحد يشغّل بالترتيب: **حذف → مخطط → RLS → مزامنة مستخدمي Auth**.

> `setup_all.sql` يُولَّد من الملفات `00_reset.sql` + `01_schema.sql` + `02_rls.sql`.  
> بعد تعديل أي منها، أعد توليده بنفس الأمر في PowerShell (انظر أسفل الملف).

## الطريقة المرحلية

| الترتيب | الملف | الوظيفة |
|--------|-------|---------|
| 1 | `00_reset.sql` | حذف الجداول والدوال والمحفزات |
| 2 | `01_schema.sql` | إنشاء المخطط الكامل + البيانات الأولية |
| 3 | `02_rls.sql` | سياسات Row Level Security + مزامنة Auth |
| 4 | `03_test_cases.sql` | *(اختياري)* سيناريوهات اختبار |

### ترقية قاعدة موجودة (بدون حذف البيانات)

| الملف | متى |
|-------|-----|
| `04_auth.sql` | قاعدة قديمة بدون `profiles` / مصادقة |
| `05_permissions.sql` | بعد `04_auth.sql` — إضافة `user_permissions` و `has_permission` |
| `06_storage.sql` | بعد `05_permissions.sql` — buckets للشعار ومرفقات السندات |

## ما يشمله المخطط الحالي

- **العملات** — IQD أساسية + USD/EUR/SYP/AED + سجل أسعار تاريخي
- **دليل الحسابات** — 7 حسابات جذر + قواعد التسلسل الهرمي + `sub_code`
- **مراكز الكلفة** — جدول فارغ؛ يُضاف من صفحة «مراكز الكلفة» عند الحاجة
- **السندات** — قبض / صرف / تصفية + عملة + سعر صرف + مركز كلفة
- **تصنيفات أسطر السند** — PAY-FOOD، PAY-NUTR، PAY-CONST
- **ترقيم السندات** — RCP / PAY / SET مع `peek_voucher_no` و `reserve_voucher_no`
- **إعدادات افتراضية** — حساب / عملة / مركز كلفة لكل نوع سند
- **إعدادات العملاء/الموردين** — `party_settings` (حساب أب افتراضي للذمم)
- **الترحيل التلقائي** — من السند إلى قيد يومية عند `status = posted`
- **عرض** `account_direct_balances` — `security_invoker = true`
- **المصادقة** — `profiles` + `company_settings` + trigger على `auth.users`
- **الصلاحيات** — `user_permissions` + `has_permission()` + `is_admin()`

## بعد التثبيت

1. **Supabase → Authentication → Providers** — فعّل Email/Password.
2. **Environment Variables** (Vercel أو `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - *(اختياري)* `SUPABASE_SERVICE_ROLE_KEY` — لإنشاء مستخدمين من `/settings/users`
3. افتح التطبيق → **`/login`** → سجّل **أول مستخدم** (يصبح **admin** تلقائياً).
4. من **`/settings/users`** أدر المستخدمين.
5. من **`/settings/permissions`** اضبط الصلاحيات التفصيلية.
6. من **`/vouchers/settings`** حدّد حسابات القبض/الصرف/التصفية الافتراضية.
7. من **`/customers`** و **`/vendors`** حدّد حساب أب الذمم الافتراضي.
8. *(اختياري)* شغّل `03_test_cases.sql` للتحقق من سيناريوهات القبض والصرف.

## ترقيعات جزئية (بدون إعادة تثبيت)

| الملف | الغرض |
|-------|--------|
| `patch_view_security_invoker.sql` | إصلاح تحذير Security Definer على العرض |
| `patch_sub_code.sql` | إضافة حقل `sub_code` |
| `patch_voucher_line_categories.sql` | إضافة جدول تصنيفات الأسطر |
| `patch_journal_cost_centers.sql` | مراكز كلفة على القيود |
| `patch_company_logo.sql` | إضافة حقل `logo_url` في `company_settings` |
| `patch_voucher_attachments.sql` | جدول `voucher_attachments` + محفزات |
| `patch_admin_edit_posted_vouchers.sql` | تعديل السندات المرحّلة لمدير النظام |
| `patch_voucher_lines_delete_rls.sql` | سياسة حذف أسطر السند |
| `patch_voucher_auto_post.sql` | ترحيل تلقائي عند حفظ السند |
| `patch_journal_line_currency.sql` | عملة وسعر صرف وقيمة أساسية على أسطر القيود والسندات |
| `06_storage.sql` | إنشاء buckets Storage + سياسات RLS للملفات |

## إعادة توليد setup_all.sql

```powershell
cd database
# (نفس أمر التوليد في المستودع — أو عدّل الملفات المصدرية يدوياً)
```

## البيانات الأولية

| الكيان | المحتوى |
|--------|---------|
| عملات | IQD (أساسية)، USD، EUR، SYP، AED |
| حسابات | 1–7 (موجودات، التزامات، …) |
| مراكز كلفة | *(لا بيانات افتراضية)* |
| ترقيم | RCP-YYYY-0001، PAY-YYYY-0001، SET-YYYY-0001 |
| تصنيفات صرف | اطعام، تغذية، انشائية |

## الملفات القديمة (محذوفة)

استُبدلت بمجلد `database/`:

- `accounting_schema.sql`
- `accounting_currencies.sql`
- `accounting_voucher_settings.sql`
- `accounting_voucher_extensions.sql`
- `accounting_rls_policies.sql`
- `accounting_migration_name_en.sql`
- `accounting_test_cases.sql`
