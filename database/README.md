# إعداد قاعدة البيانات

ملفات SQL منظّمة لإعادة تثبيت المخطط المحاسبي من الصفر على Supabase.

> **للتجربة الأولى:** ابدأ من [`TRIAL_SETUP.md`](TRIAL_SETUP.md) — دليل مختصر مع التحقق والتحذيرات.

## ⚠️ تحذير

تشغيل **`setup_all.sql`** أو **`00_reset.sql`** يحذف **جميع** البيانات المحاسبية (حسابات، سندات، قيود، عملاء، مستخدمين، …).  
استخدمه في بيئة التطوير أو عند إعادة ضبط المشروع — وليس على بيانات إنتاج حقيقية.

## الطريقة السريعة (موصى بها)

في **Supabase → SQL Editor**، انسخ والصق محتوى:

```
database/setup_all.sql
```

ملف واحد يشغّل بالترتيب: **حذف → مخطط → RLS → ترقيعات (#27+) → Storage**.

> `setup_all.sql` يجمع: `00_reset.sql` + `01_schema.sql` + `02_rls.sql` + **15 ترقيعاً** + `06_storage.sql`.  
> بعد تعديل أي ملف مصدر، أعد التوليد: `powershell -File database/build_setup_all.ps1`

## الطريقة المرحلية

| الترتيب | الملف | الوظيفة |
|--------|-------|---------|
| 1 | `00_reset.sql` | حذف الجداول والدوال والمحفزات |
| 2 | `01_schema.sql` | إنشاء المخطط الكامل + البيانات الأولية |
| 3 | `02_rls.sql` | سياسات Row Level Security + مزامنة Auth |
| 4 | `06_storage.sql` | buckets Storage للشعار ومرفقات السندات |
| 5 | `03_test_cases.sql` | *(اختياري)* سيناريوهات اختبار |

### ترقية قاعدة موجودة (بدون حذف البيانات)

| الملف | متى |
|-------|-----|
| `04_auth.sql` | قاعدة قديمة بدون `profiles` / مصادقة |
| `05_permissions.sql` | بعد `04_auth.sql` — `user_permissions` و `has_permission` |
| `06_storage.sql` | buckets Storage غير مُنشأة بعد |
| `patch_*.sql` | ميزة محددة ناقصة — راجع الجدول أدناه |

**ترتيب آمن للترقيعات الوظيفية (على قاعدة قديمة):**

1. ترقيعات الأعمدة/الجداول فقط (`patch_sub_code`, `patch_company_logo`, …)
2. `patch_admin_edit_posted_vouchers.sql` *(إن لم يكن مدمجاً)*
3. **`patch_journal_line_currency.sql` أخيراً** — يحدّث دوال الترحيل بالعملة والأساس

**ترتيب ترقيعات الفواتير (#27) على قاعدة موجودة:**

1. `patch_branches.sql`
2. `patch_materials_minimal.sql`
3. `patch_company_inventory.sql`
4. `patch_journal_dimensions.sql`
5. `patch_invoices.sql`
6. `patch_invoice_seeds.sql`
7. `patch_settlement_foundation.sql`
8. `patch_post_invoice.sql`

**لا تُعاد تشغيل** `patch_voucher_line_categories.sql` أو `patch_journal_cost_centers.sql` **لاستبدال دوال الترحيل** بعد المخطط الحالي.

## ما يشمله المخطط الحالي

- **العملات** — IQD أساسية + USD/EUR/SYP/AED + سجل أسعار تاريخي
- **دليل الحسابات** — 7 حسابات جذر + قواعد التسلسل الهرمي + `sub_code`
- **مراكز الكلفة** — جدول فارغ؛ يُضاف من صفحة «مراكز الكلفة» عند الحاجة
- **السندات** — قبض / صرف / تصفية + عملة + سعر صرف + `amount_base` على الأسطر
- **القيود** — `currency_id`, `exchange_rate`, `debit_base`, `credit_base` على أسطر القيود من السندات
- **تصنيفات أسطر السند** — جدول فارغ؛ يُعرَّف من `/vouchers/settings/line-categories`
- **ترقيم السندات** — RCP / PAY / SET مع `peek_voucher_no` و `reserve_voucher_no`
- **إعدادات افتراضية** — حساب / عملة / مركز كلفة + `auto_post_enabled`
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

| الملف | الغرض | ملاحظة |
|-------|--------|--------|
| `patch_view_security_invoker.sql` | إصلاح تحذير Security Definer على العرض | مدمج في `01_schema` |
| `patch_sub_code.sql` | حقل `sub_code` | مدمج |
| `patch_voucher_line_categories.sql` | جدول تصنيفات الأسطر | مدمج — لا تُعد تشغيل دوال الترحيل |
| `patch_journal_cost_centers.sql` | مراكز كلفة على القيود | مدمج — لا تُعد تشغيل دوال الترحيل |
| `patch_company_logo.sql` | `logo_url` في `company_settings` | مدمج |
| `patch_voucher_attachments.sql` | `voucher_attachments` | مدمج |
| `patch_admin_edit_posted_vouchers.sql` | تعديل السندات المرحّلة لمدير النظام | مدمج — يُستبدل بـ journal_line_currency |
| `patch_voucher_lines_delete_rls.sql` | حذف أسطر السند | مدمج |
| `patch_voucher_auto_post.sql` | `auto_post_enabled` | مدمج |
| `patch_journal_line_currency.sql` | عملة وأساس على القيود والسندات | **شغّله على قواعد قديمة — آخر ترقيع للدوال** |
| `patch_remove_voucher_line_category_seed.sql` | حذف تصنيفات الأسطر الافتراضية | قواعد مُثبتة سابقاً بالبذور الثلاثة |
| `patch_voucher_delete.sql` | حذف السند مع القيد المرتبط | **شغّله على قواعد قديمة** |
| `patch_branches.sql` | `branches` + `company_settlement_accounts` + توسيع `cost_centers` | **أول patch الفواتير (#27)** |
| `patch_materials_minimal.sql` | `material_categories`, `warehouses`, `materials`, **`material_units`** + تحويل | بعد `patch_branches` |
| `patch_company_inventory.sql` | `company_inventory_settings` + قفل + `get_company_inventory_settings()` | بعد `patch_materials_minimal` |
| `patch_journal_dimensions.sql` | أبعاد `journal_entry_lines` + `open_items_view` + `get_open_items()` | بعد `patch_company_inventory` |
| `patch_invoices.sql` | أنماط + فواتير + مناقلة + `inventory_movements` + ترقيم | بعد `patch_journal_dimensions` |
| `patch_invoice_seeds.sql` | 8 أنماط جاهزة (§12) | بعد `patch_invoices` |
| `patch_settlement_foundation.sql` | `voucher_netting_lines` + توسيع `voucher_allocations` | بعد `patch_invoice_seeds` |
| `patch_post_invoice.sql` | `post_invoice()` — كل الأنواع التجارية + حماية الفاتورة المرحّلة | بعد `patch_settlement_foundation` |
| `patch_invoice_multiple_references.sql` | مراجع متعددة للفاتورة | بعد `patch_post_invoice` |
| `patch_invoice_reference_close.sql` | إغلاق المرجع يدوياً | #12 |
| `patch_opening_entry.sql` | قيد افتتاحي + فهرس per فرع/سنة | بعد branches + journal_dimensions |
| `patch_trial_balance_opening.sql` | عمود `opening_entry_balance` في ميزان المراجعة | بعد #13 |
| `patch_accounting_periods.sql` | فترات محاسبية | بعد branches |
| `patch_inventory_reports.sql` | رصيد مخزون + دفتر حركة + `post_stock_adjustment` | بعد period_enforcement |
| `patch_period_enforcement.sql` | قفل الفترة + مقاصة CC/فرع في ترحيل السند | بعد accounting_periods |
| `patch_inventory_phase2.sql` | تسوية مجمّعة + تحليل نواقص/راكد | بعد inventory_reports |
| `patch_inventory_phase7.sql` | تقرير مبيعات تفصيلي | #23 |
| `patch_audit_fixes.sql` | RLS (authenticated فقط) + أرصدة base + دورة حياة الحساب | **#24 — أمني/محاسبي** |
| `patch_voucher_allocation_cap.sql` | حد التخصيص على مستوى DB + قفل عند الترحيل | **#25 — race condition** |
| `patch_voucher_line_cc_optional.sql` | علم `cc_optional` بدل مطابقة نص «تصفية —%» | **#26 — تدقيق** |
| `patch_reverse_voucher_rpc.sql` | `reverse_posted_voucher()` — عكس ذرّي | **#27 — تدقيق** |
| `patch_voucher_atomic_ops.sql` | استبدال أسطر/تخصيصات + استيراد حسابات ذرّي | **#28 — تدقيق** |
| `patch_reverse_invoice_settlement.sql` | عكس سندات invoice + إصلاح ترحيل المقاصة | **#29 — تدقيق** |
| `patch_audit_remaining.sql` | دوران تصنيفات المواد + قفل فرع المستودع | **#30 — تدقيق** |
| `patch_materials_item_card.sql` | مواصفات بطاقة المادة + أسعار per وحدة | **#31 — مواد** |
| `patch_materials_tracking.sql` | صلاحية + رقم تسلسلي + إجبار إدخال/إخراج | **#32 — مواد** |
| `patch_invoice_line_adjustments.sql` | خصم/إضافي per سطر + تأثير على تكلفة المخزون | **#33 — فواتير** |
| `patch_expiry_from_invoice.sql` | تاريخ الانتهاء في سطر الفاتورة؛ الإعدادات من بطاقة المادة | **#34 — فواتير/مواد** |
| `patch_invoice_pattern_tracking.sql` | إظهار صلاحية/تسلسلي على أسطر النمط + تحميل من المرجع | **#35 — فواتير** |
| `patch_outbound_stock_check.sql` | منع إخراج يتجاوز الرصيد (مادة + مستودع) | **#36 — مخزون** |
| `patch_outbound_lot_stock.sql` | رصيد دفعات صلاحية/تسلسلي + قوائم الاختيار | **#37 — مخزون** |
| `patch_inventory_cost_dimensions.sql` | فصل تكلفة بالصلاحية/التسلسلي + قفل الإعدادات | **#38 — تكلفة** |
| `patch_invoice_pricing_cost.sql` | ربط pricing_*_mode بـ post_invoice + **إصلاح خصم شراء / استلام جزئي** | **#39/#43 — تسعير** |
| `patch_audit_governance_security.sql` | فهرس افتتاحي بدون فرع + RLS فترات/فروع + reference_links | **#40 — تدقيق أمني** |
| `patch_revoke_anon_table_access.sql` | إزالة `anon` من سياسات الجداول (استثناء company_settings SELECT) | **#41 — أمني حرج** |
| `patch_create_material_with_base_unit.sql` | إنشاء مادة + وحدة أساس ذرّياً | **#42 — مواد** |
| `patch_materials_warehouses_audit_fix.sql` | قفل رصيد متزامن + ترتيب تريغر الدفعات + منع تعديل أسطر مرحّلة | **#44 — تدقيق مواد** |
| `patch_invoice_material_require_base_unit.sql` | رفض سطر فاتورة لمادة بلا وحدة أساس | **#45 — مواد** |
| `06_storage.sql` | Storage buckets | مدمج في `setup_all` |

## إعادة توليد setup_all.sql

```powershell
cd database
powershell -File build_setup_all.ps1
```

أو يدوياً (بدون ترقيعات):

```powershell
Get-Content 00_reset.sql, 01_schema.sql, 02_rls.sql, 06_storage.sql | Set-Content setup_all.sql -Encoding UTF8
```

## البيانات الأولية

| الكيان | المحتوى |
|--------|---------|
| عملات | IQD (أساسية)، USD، EUR، SYP، AED |
| حسابات | 1–7 (موجودات، التزامات، …) |
| مراكز كلفة | *(لا بيانات افتراضية)* |
| ترقيم | RCP-YYYY-0001، PAY-YYYY-0001، SET-YYYY-0001 |
| تصنيفات أسطر السند | *(لا بيانات افتراضية)* |

## الملفات القديمة (محذوفة)

استُبدلت بمجلد `database/`:

- `accounting_schema.sql`
- `accounting_currencies.sql`
- `accounting_voucher_settings.sql`
- `accounting_voucher_extensions.sql`
- `accounting_rls_policies.sql`
- `accounting_migration_name_en.sql`
- `accounting_test_cases.sql`
