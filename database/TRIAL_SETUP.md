# إعداد قاعدة البيانات — التجربة الأولى

دليل مختصر لتشغيل النظام قبل **التجربة الأولى** (إصدار `0.1.0+trial-1`).

## 1) بيئة جديدة (موصى بها للتجربة)

في **Supabase → SQL Editor** شغّل ملفاً واحداً:

```
database/setup_all.sql
```

يشمل بالترتيب:
- `00_reset.sql` — حذف المخطط القديم
- `01_schema.sql` — جداول، دوال، محفزات، بيانات أولية
- `02_rls.sql` — سياسات الأمان والصلاحيات
- `06_storage.sql` — buckets الملفات (شعار الشركة ومرفقات السندات)

> **تحذير:** يحذف جميع البيانات. استخدم مشروع Supabase تجريبي فقط.

### اختياري — سيناريوهات اختبار

```
database/03_test_cases.sql
```

يُنشئ سندات قبض/صرف/تصفية ويتحقق من توازن القيود.

---

## 2) ترقية قاعدة موجودة (بدون حذف)

**لا تشغّل `setup_all.sql`** على بيانات حقيقية.

### إذا كانت القاعدة قديمة جداً (بدون مصادقة)

| الترتيب | الملف |
|--------|-------|
| 1 | `04_auth.sql` |
| 2 | `05_permissions.sql` |
| 3 | `06_storage.sql` |

### إذا كانت القاعدة حديثة لكن تفتقد ميزات

شغّل **فقط** الملفات الناقصة من جدول الترقيعات في `README.md`.

**آخر ترقيع مهم للعملات على القيود:**

```
database/patch_journal_line_currency.sql
```

### ⚠️ لا تُعاد تشغيل هذه الملفات بعد المخطط الحالي

قد تستبدل دالة `vouchers_before_update_handle_posting` بنسخة أقدم:

- `patch_voucher_line_categories.sql` (جزء الدوال)
- `patch_journal_cost_centers.sql` (جزء الدوال)
- `patch_admin_edit_posted_vouchers.sql` (إذا شغّلت `patch_journal_line_currency.sql` بعده)

---

## 3) التحقق بعد التثبيت

شغّل في SQL Editor:

```sql
-- أعمدة العملة على القيود
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'journal_entry_lines'
  and column_name in ('currency_id', 'exchange_rate', 'debit_base', 'credit_base');

-- قيمة أساسية على أسطر السند
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'voucher_lines'
  and column_name = 'amount_base';

-- حالة الترحيل التلقائي
select voucher_type, auto_post_enabled
from public.voucher_type_defaults;

-- عدد الحسابات الجذر
select count(*) as root_accounts from public.accounts where parent_id is null;
```

**المتوقع:**
- 4 أعمدة على `journal_entry_lines`
- عمود `amount_base` على `voucher_lines`
- 7 حسابات جذر (1–7)
- 3 أنواع سندات في `voucher_type_defaults`

---

## 4) إعداد التطبيق

1. **Authentication → Email** — فعّل تسجيل الدخول
2. متغيرات البيئة في `web/.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. أنشئ أول مستخدم من لوحة Auth → يصبح **مدير**
4. `/login` ثم معالج **`/setup`** (إلزامي حتى `is_setup_complete`)
5. `/vouchers/settings` — حسابات القبض/الصرف/التصفية الافتراضية
6. `/customers` و `/vendors` — حساب أب الذمم

لنشر عميل منفصل: [`docs/deploy-new-client.md`](../docs/deploy-new-client.md).

---

## 5) حدود معروفة في التجربة الأولى

| الموضوع | الوضع الحالي |
|---------|----------------|
| كشف الحساب | يقرأ `debit_base`/`credit_base` من القيود المرحّلة من السندات |
| ميزان المراجعة | يجمع `debit`/`credit` — قد يختلف عن العرض بالعملة الأساسية |
| قيود يدوية | لا تُعبّأ حقول العملة/الأساس تلقائياً |
| مرفقات سند مرحّل | لا يمكن تعديلها حتى لمدير النظام |

---

## 6) مراجع

- `database/README.md` — توثيق المخطط الكامل
- `docs/deploy-new-client.md` — نشر عميل جديد + نسخ احتياطي + ترقيات
- `RELEASE_CHECKLIST.md` — قائمة تحقق ما قبل التجربة
- `CHANGELOG.md` — سجل إصدارات التطبيق
