# إعداد قاعدة البيانات

مجلد `database/` يحتوي الملفات التالية، كل ملف SQL مستقل بذاته:

| الملف | الاستخدام |
|--------|-----------|
| `setup_all.sql` | **تثبيت كامل من الصفر** — المخطط المحاسبي والمخزوني والفواتير، بلا بيانات عرض. **يحذف كل البيانات**. |
| `setup_demo_restaurant.sql` | **تثبيت كامل + عرض مطعم** — نفس `setup_all.sql` + بيانات `OPEN-*` / `DEMO-*` (انظر `TRIAL_SETUP.md`). **يحذف كل البيانات**. |
| `init_material_lifecycle.sql` | **تهيئة تزايدية** — أنواع المواد (`semi` / تفكيك) + سياسة صلاحية ناتج التصنيع + الدوال المرتبطة. **لا يحذف بيانات**. يُشغَّل على قاعدة مُثبَّتة مسبقاً. |

> **2026-07-27:** كان المجلد يحتوي سابقاً ~80 ملف `patch_*.sql`. حُذفت؛ `setup_all.sql` / `setup_demo_restaurant.sql` هما مصدر الحقيقة للتثبيت الكامل ويُعدَّلان مباشرة. `init_material_lifecycle.sql` للتطبيق التزايدي على قاعدة موجودة أثناء البناء.

## ⚠️ تحذير

تشغيل `setup_all.sql` أو `setup_demo_restaurant.sql` يحذف **جميع** البيانات المحاسبية قبل إعادة إنشاء المخطط من الصفر — للتطوير/التجربة أو إعادة الضبط فقط.

`init_material_lifecycle.sql` آمن على بيانات موجودة (قيود/أعمدة/استبدال دوال فقط).

## الطريقة

في **Supabase → SQL Editor**:

```
# تثبيت جديد (يحذف كل شيء)
database/setup_all.sql                 ← إنتاج / تثبيت نظيف
database/setup_demo_restaurant.sql     ← تجربة/عرض

# قاعدة موجودة — تهيئة دورة المواد وصلاحية التصنيع فقط
database/init_material_lifecycle.sql
```

التثبيت الكامل يشغّل داخلياً: **حذف → مخطط → RLS → الدوال/المحفزات → Storage** (والتجريبي يضيف بيانات العرض بالنهاية).

بعد التثبيت الكامل:

```sql
select public.get_schema_setup_status();
```

بعد `init_material_lifecycle.sql`:

```sql
select manufacturing_produce_expiry_policy
from public.company_inventory_settings
where id = 1;
```

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

## ما يشمله المخطط

- **العملات** — IQD أساسية + USD/EUR/SYP/AED + سجل أسعار تاريخي
- **دليل الحسابات** — قوالب (`coa_templates`) تُطبَّق عند التهيئة + أدوار ختامية؛ لا زرع جذور ثابتة قبل الاختيار
- **مراكز الكلفة، الفروع، المستودعات، المواد** — بدون بيانات افتراضية (`setup_all.sql`) أو ببيانات عرض مطعم (`setup_demo_restaurant.sql`)
- **السندات** — قبض / صرف / تصفية + عملة + سعر صرف
- **الفواتير** — كتالوج أنماط (`invoice_pattern_catalog`) يختار المستخدم منه عند التهيئة؛ قفل الحقول الجوهرية عند وجود فواتير
- **القيود** — عملة وأساس على كل سطر، ترحيل تلقائي من السند/الفاتورة
- **المصادقة والصلاحيات** — `profiles` + `user_permissions` + `has_permission()` + `is_admin()`
- **تقارير** — ميزان مراجعة، كشف حساب، مخزون، COGS، أعمار ذمم، مبيعات/مشتريات تفصيلي

## تعديل المخطط لاحقاً

أي تعديل على التثبيت الكامل يُكتَب **مباشرة** داخل `setup_all.sql` (ويُنسَخ لنفس المكان في `setup_demo_restaurant.sql` إن كان مشتركاً، أو بقسم بيانات العرض إن كان خاصاً بالديمو).  
حدّث أيضاً `init_material_lifecycle.sql` إن كان التغيير يخص دورة المواد/صلاحية التصنيع ويُطبَّق تزايدياً.

## مراجع أخرى

- `TRIAL_SETUP.md` — دليل مختصر للتجربة الأولى
- `INVENTORY_MOVEMENTS_CHECKLIST.md` — قائمة تحقق عند تعديل `post_invoice`/`inventory_movements`
- [`audit-reports/2026-07-26-materials-invoices-audit.md`](../audit-reports/2026-07-26-materials-invoices-audit.md) — تدقيق دقيق لقسمي المواد والفواتير
