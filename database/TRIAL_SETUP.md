# إعداد قاعدة البيانات — التجربة الأولى

دليل مختصر لتشغيل النظام قبل **التجربة الأولى** (إصدار `0.1.0+trial-1`).

## 1) بيئة جديدة (موصى بها للتجربة / عرض العملاء)

في **Supabase → SQL Editor** شغّل ملفاً واحداً كاملاً:

```
database/setup_demo_restaurant.sql
```

ملف واحد مكتفٍ بذاته: حذف المخطط القديم → إنشاء المخطط الكامل (جداول، دوال، محفزات، RLS، Storage) → بيانات عرض مطعم جاهزة (حسابات، مواد، فواتير نموذجية).

> **تحذير:** يحذف جميع البيانات. استخدم مشروع Supabase تجريبي فقط.

للتثبيت بلا بيانات عرض (بيئة إنتاج فعلية لاحقاً): `database/setup_all.sql` بنفس الطريقة.

> **2026-07-27:** لم يعد هناك نظام ترقيعات منفصل (`patch_*.sql`) — `setup_all.sql`/`setup_demo_restaurant.sql` كل واحد ملف واحد شامل. راجع `database/README.md` للتفاصيل.

### قصة الافتتاحي في العرض (متسقة محاسبياً)

| المستند | الدور |
|---------|--------|
| `OPEN-YYYY-MAIN` | قيد افتتاحي **مالي**: صندوق + بنك + ذمم / رأس مال (بدون مخزون) |
| `DEMO-OPS-001` | فاتورة **بضاعة أول المدة** مرحّلة → كميات مخزون + قيد مدين 1201 / دائن 3101، معلَّم `is_opening_entry` |

ثم سلسلة التشغيل: مشتريات تبريد → مناقلة مطبخ → تصنيع → مناقلة فرع → مبيعات.

### قائمة تحقق سريعة أمام العميل

1. **ميزان المراجعة** — عمود الرصيد الافتتاحي: صندوق/بنك/ذمم من `OPEN-*`، ومخزون 1201 من قيد `DEMO-OPS-001`.
2. **الفواتير** — افتح `DEMO-OPS-001` (بضاعة أول المدة) ثم `DEMO-PUR-001` / `DEMO-MFG-*` / `DEMO-SAL-001`.
3. **المخزون** — رصيد المطبخ يعكس OPS + الحركات اللاحقة؛ دفعات الجبن/اللبن لها تواريخ صلاحية متسقة.
4. لا يُفترض وجود حركات `source_type = 'demo'` لرصيد أول المدة (المسار عبر فاتورة فقط).

---

## 2) ترقية قاعدة موجودة (بدون حذف)

**لا تشغّل `setup_all.sql`/`setup_demo_restaurant.sql`** على بيانات حقيقية — كلاهما يبدأ بحذف كامل للمخطط.

لا يوجد حالياً مسار ترقية تدريجي لقاعدة قديمة (كان يعتمد على ملفات ترقيع محذوفة الآن). لترقية قاعدة إنتاج فعلية: قارن مخططها الحالي بـ`setup_all.sql` (عبر `pg_dump --schema-only` أو أداة migration diff) واكتب سكربت ترقية يدوي للفروق فقط — لا تُشغّل الملف الكامل على بيانات حية.

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

-- اتساق عرض الافتتاحي
select invoice_no, status, journal_entry_id is not null as has_je
from public.invoices
where invoice_no = 'DEMO-OPS-001';

select entry_no, is_opening_entry, status
from public.journal_entries
where entry_no like 'OPEN-%-MAIN'
   or id = (select journal_entry_id from public.invoices where invoice_no = 'DEMO-OPS-001');
```

**المتوقع:**
- 4 أعمدة على `journal_entry_lines`
- عمود `amount_base` على `voucher_lines`
- 7 حسابات جذر (1–7)
- 3 أنواع سندات في `voucher_type_defaults`
- `DEMO-OPS-001` مرحّلة مع قيد؛ قيد OPS و`OPEN-*-MAIN` بـ`is_opening_entry = true`

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
- `audit-reports/2026-07-26-materials-invoices-audit.md` — تدقيق المواد/الفواتير
