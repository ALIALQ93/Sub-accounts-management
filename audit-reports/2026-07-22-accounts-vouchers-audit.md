# تدقيق دقيق — دليل الحسابات والسندات وعلاقاتهما

منهجية: قراءة الكود الفعلي (SQL + TypeScript) وتتبّع ترتيب تطبيق الـpatches الحقيقي عبر `database/build_setup_all.ps1`، لأن دوال حرجة (`vouchers_before_update_handle_posting`, `validate_voucher_allocations_capacity`, `get_trial_balance`) أُعيد تعريفها أكثر من مرة عبر عدة ملفات patch — النسخة الفعّالة هي آخر ملف يعيد تعريفها حسب ترتيب البناء، وليست أول نتيجة بحث نصي.

## 0. ملاحظة على آلية البناء نفسها

12 ملف patch موجودة فعلياً بمجلد `database/` لكن **لا تُستدعى إطلاقاً** من `database/build_setup_all.ps1`: `patch_admin_edit_posted_vouchers.sql`, `patch_journal_cost_centers.sql`, `patch_journal_line_currency.sql`, `patch_voucher_delete.sql`, `patch_voucher_line_categories.sql`, `patch_voucher_lines_delete_rls.sql`, `patch_voucher_attachments.sql`, `patch_view_security_invoker.sql`, `patch_sub_code.sql`, `patch_company_logo.sql`, `patch_remove_voucher_line_category_seed.sql`, `patch_post_invoice_discount_rounding.sql`.

تحققتُ أن محتوى هذه الملفات **مدمج فعلياً داخل `01_schema.sql`** (مطابقة حرفية لعناصر مثل `sub_code`, `voucher_attachments`, `is_force_voucher_delete`, `delete_voucher_with_journal`) — فهي أرشيف تاريخي وليست عيباً وظيفياً. لكن هذا **غير موثّق داخل السكربت نفسه** (لا تعليق يوضّح لماذا استُبعدت)، وترويسة `01_schema.sql` (سطر 1-2) تصفه بأنه "الوضع الحالي الكامل" بينما هو فعلياً **ناقص** مقارنة بالحالة الحقيقية بعد التطبيق الكامل — يفتقد بنيوياً: `accounting_periods`، إنفاذ قفل الفترة، `branch_id` على `vouchers`/`journal_entries`، ومقاصة مراكز الكلفة/الفروع (`voucher_netting_lines`). هذه تُضاف فقط بترقيعات لاحقة (`patch_accounting_periods.sql` + `patch_period_enforcement.sql` + `patch_branches.sql` + `patch_reverse_invoice_settlement.sql`).

**النسخة الحيّة الفعلية** من `vouchers_before_update_handle_posting()` هي التي في `patch_reverse_invoice_settlement.sql` (آخر من يعيد تعريفها)، وتتضمن: قفل الفترة، توازن مدين/دائن، حد التخصيص، توازن مركز الكلفة لسندات التصفية، مقاصة CC/فرع، عملة القيد الأساس.

## 1. دليل الحسابات (Chart of Accounts)

الجدول `public.accounts` (`database/01_schema.sql:50-68`):
- هرمية بسيطة (adjacency list) عبر `parent_id` + عمود `level` مُحتسب بالتريغر — **ليست** nested-set ولا materialized path؛ الاستعلامات الشجرية تستخدم `with recursive` مباشرة.
- **لا عمود `account_type`/`nature`** (مدين/دائن) صريح — طبيعة الحساب تُستنتج ضمنياً من كود الحساب الجذري (1-7)، وليست حقلاً منظَّماً قابلاً للاستعلام.
- **لا `branch_id`** على `accounts` نفسها — الفرع مرتبط بالقيد/السند فقط.
- **لا علم `is_system`** يميّز الحسابات الجذرية السبعة عن غيرها؛ الحماية تعتمد فقط على وجود أبناء/حركات.
- **تفصيلي/تجميعي**: عمود `is_postable`، مفروض تلقائياً بـ`accounts_apply_hierarchy_rules()` (`01_schema.sql:504-578`): إضافة ابن لحساب قابل للترحيل تحوّل الأب تلقائياً لغير قابل للترحيل؛ منع جعل حساب له أبناء قابلاً للترحيل؛ منع تحويل حساب له حركات إلى تجميعي؛ منع الحلقات الدائرية.
- **منع الحذف**: `prevent_account_delete_when_used()` (`01_schema.sql:594-609`) يمنع حذف حساب له أبناء أو حركات قيد. حذف حساب مرتبط بـ`customers.receivable_account_id`/`vendors.payable_account_id` محميّ فقط بـ`FK ... on delete restrict` (لا تريغر مخصّص برسالة واضحة).
- **الرصيد**: `SUM` لحظي دائماً — عبر `account_direct_balances` (view) و`get_trial_balance()`. كلاهما يستخدمان `debit_base`/`credit_base` باتساق تام. **تحققتُ بحث شامل: لا أثر لخلل `debit_base_base` القديم في أي ملف حالي — مُصلَح بالكامل.**
- **RLS** (`database/02_rls.sql:49-58`): `select/insert/update` مفتوحة لكل `authenticated` بلا أي `has_permission()`. مفاتيح الصلاحيات (`accounts.create`, `accounts.edit`) موجودة فقط بـ`permission-catalog.ts` وتُستخدم حصراً لإخفاء/تعطيل أزرار الواجهة — **لا حماية فعلية بقاعدة البيانات**. بما أن العميل يتصل مباشرة بـSupabase (لا طبقة API وسيطة)، أي مستخدم `authenticated` (حتى `viewer` بلا أي صلاحية كتابة حسب الإعداد الافتراضي) يستطيع تقنياً استدعاء `insert`/`update` مباشرة عبر devtools/fetch متجاوزاً القيد الظاهر بالواجهة فقط.

## 2. القيود المحاسبية (Journal Entries)

الجداول `journal_entries`/`journal_entry_lines` (`01_schema.sql:83-119`)، وسّعتها لاحقاً patches بـ `branch_id, due_date, party_type/party_id, source_invoice_id` و`currency_id, exchange_rate, debit_base, credit_base`.

- **توازن السطر الواحد**: قيد `check` بنيوي `journal_lines_single_side` يمنع سطراً واحداً من احتواء مدين ودائن معاً.
- **توازن القيد الكامل**: تريغر `journal_entry_validate_balance_before_post()` (`01_schema.sql:998-1025`) — **يفحص فقط عند الانتقال إلى `status='posted'`**؛ القيد يمكن أن يكون غير متوازن أثناء `draft` بلا أي منع. الفحص يقارن `debit`/`credit` الخام (وليس `debit_base`/`credit_base`) — سليم فقط لأن كل أسطر أي قيد فعلي حالياً بنفس العملة وسعر الصرف (لا مسار حالي يخلط عملات ضمن قيد واحد)، لكن **لا يوجد قيد `check` صريح يمنع** إدراج سطرين بعملتين مختلفتين ضمن نفس القيد عبر إدراج يدوي مباشر (RLS مفتوحة).
- **لا واجهة/RPC لإنشاء قيد يدوي حر** — كل القيود تُنشأ آلياً من مصدرين فقط: تريغر السندات، أو `post_invoice()`. لكن RLS المفتوحة تسمح تقنياً بإدخال مباشر (`INSERT` على `journal_entries`/`journal_entry_lines`) بلا أي فحص فترة محاسبية على هذا المسار البديل.
- **الربط بالفترات المحاسبية**: عبر `assert_accounting_period_open(p_entry_date, p_branch_id)` (`patch_period_enforcement.sql:7-42`) — يُستدعى من: تريغر ترحيل السندات، `post_invoice()`، دوال تسوية المخزون. **لا يُستدعى إطلاقاً من `delete_voucher_with_journal()` ولا من فرع إلغاء السند الأصلي داخل `reverse_posted_voucher()`** (انظر §3).
- `source_type`/`source_id` بقيم مشاهدة فعلياً `'voucher'`/`'invoice'` — نص حر بلا قيد `check` يقصره على قيم معيّنة.

## 3. السندات (Vouchers)

جدول موحّد `public.vouchers` (وليس جداول منفصلة لكل نوع) — `01_schema.sql:259-291`:
- `voucher_type in ('receipt','payment','settlement')` فقط. **لا نوع "عكسي" منفصل** — العكس سند عادي برقم `RV-` مسبوق.
- `settlement_mode in ('account','invoice')`.
- `journal_entry_id unique references journal_entries` — علاقة 1:1 سند↔قيد.
- `voucher_allocations`: `target_journal_line_id references journal_entry_lines`, `applied_amount` — آلية تخصيص السند لسطر قيد مفتوح (فاتورة/حركة سابقة). **لا حقل مباشر `invoice_id`** — الربط بالفاتورة غير مباشر بالكامل عبر `journal_entry_lines.source_invoice_id`.

### حد التخصيص (allocation cap) — مُصلَح فعلياً بقفل صف

- تريغر `voucher_allocations_validate()` يفحص عند كل `INSERT`/`UPDATE` (فحص عام بلا قفل — عرضة نظرياً لـTOCTOU بمفرده).
- **الحماية الحاسمة** تحدث عند الترحيل الفعلي: `validate_voucher_allocations_capacity(new.id, p_lock_lines=true)` تستخدم `select ... for update of jel` على أسطر القيد المستهدفة (`01_schema.sql:1473-1480`) — **يقفل صف سطر القيد المستهدف أثناء المعاملة**، فيمنع فعلياً سندين متزامنين من تخصيص نفس المبلغ المتاح قبل الترحيل النهائي. **هذه المشكلة الموثّقة سابقاً (TOCTOU) تبدو مُصلَحة فعلياً** — القفل يحدث فقط عند اللحظة الحرجة الحقيقية (الترحيل)، ولسندات `settlement_mode='invoice'` فقط.

### دالة الترحيل والحماية بعد الترحيل

عند تعديل سند **مرحّل مسبقاً** يُسمح فقط لـ `is_admin()` (أو أعلام جلسة داخلية `is_force_voucher_delete`/`is_force_voucher_reverse` تضبطها الدالتان أدناه فقط داخلياً) — وحتى عندها تُحدَّث بيانات رأس القيد فقط (تاريخ/وصف/فرع)، **وليس أسطره**؛ إعادة بناء الأسطر يتطلب استدعاء صريح لـ`sync_posted_voucher_journal()` (مقيّدة أيضاً بـ`is_admin()`).

### سند "العكسي" (Reversal) — `reverse_posted_voucher()`

- الصلاحية المطلوبة: `has_permission('vouchers.edit')` **فقط** — لا مفتاح مخصّص `vouchers.reverse`، ولا يتطلب admin.
- ينشئ سنداً جديداً `RV-<original>-<suffix>` **بتاريخ اليوم الحالي** (وليس تاريخ السند الأصلي)، بأسطر معكوسة الجهة، مُرحَّلاً فوراً، ثم يُلغي الأصلي (`status='cancelled'`).
- **واجهة المستخدم تحتوي فعلياً `window.confirm(...)`** قبل التنفيذ (`web/src/modules/vouchers/components/voucher-form.tsx:362-388`)، برسالة تختلف حسب `settlementMode` — **المشكلة الموثّقة سابقاً (عكس بضغطة واحدة بلا تأكيد) تبدو مُصلَحة بالواجهة**.
- **اكتشاف دقيق غير موثّق سابقاً**: التجاوز الخاص بالحذف/العكس (`is_force_voucher_reverse()`) يقع **فقط ضمن فرع `old.status='posted'`** بالتريغر. إنشاء السند العكسي الجديد ينتقل `approved→posted` (فرع مختلف تماماً، بلا تجاوز) — فيُنفَّذ الفحص الكامل بما فيه `assert_accounting_period_open` على **تاريخ اليوم الحالي**. لكن **إلغاء السند الأصلي** (`posted→cancelled`) يمر عبر الفرع الأول **المتجاوَز بالكامل** — بلا أي فحص فترة على **تاريخ السند الأصلي**. النتيجة: يمكن عكس سند تاريخه ضمن فترة مقفلة/مدققة (تغيير حالته إلى `cancelled` دون اعتراض)، طالما فترة *اليوم* مفتوحة — وهذا يُدخل تصحيحاً محاسبياً في اليوم الحالي على سند من فترة مغلقة بلا أي تنبيه.

### دالة الحذف `delete_voucher_with_journal()`

- تتطلب `has_permission('vouchers.delete')` (ليست admin بالضرورة).
- تمنع حذف سند `cancelled`، وتمنع الحذف إن كان لسندات **أخرى** تخصيصات على أسطر قيد هذا السند.
- **لا تفحص فترة محاسبية مغلقة إطلاقاً.**
- تنفّذ **حذفاً فعلياً (hard delete)**: تحذف تخصيصات السند، تفصل `journal_entry_id`، ثم `DELETE` كامل لـ`journal_entries` (يكسح `journal_entry_lines` عبر `cascade`)، ثم تحذف السند نفسه. **حذف نهائي غير قابل للتراجع لسند مرحّل وقيده، بلا أي أثر تدقيقي متبقٍ** (خلافاً للعكس الذي يُبقي السجل ويغيّر حالته فقط).

### مراكز التكلفة

- `voucher_lines.cost_center_id` اختياري (`cc_optional` يعفي السطر). الإلزام الفعلي **فقط لسندات `voucher_type='settlement'`**، ويشترط توازن مدين=دائن **لكل مركز كلفة على حدة** ضمن نفس السند (وليس فقط توازن السند ككل).

### RLS على جداول السندات

`vouchers`, `voucher_lines`, `voucher_allocations`, `voucher_attachments` — كلها `insert/update/delete to authenticated using(true)` **بلا أي `has_permission()`** (`02_rls.sql:249-297`). الحماية الحقيقية الوحيدة داخل القاعدة تقتصر على تريغرات "سند مرحّل" وثلاث دوال `SECURITY DEFINER` محدَّدة (`delete_voucher_with_journal`, `reverse_posted_voucher`, `sync_posted_voucher_journal`) التي تفحص الصلاحية داخلياً؛ أما CRUD المباشر على الجداول فغير محمي بأي صلاحية دقيقة على مستوى القاعدة — نموذج الصلاحيات (`vouchers.create/edit/delete/post`) UI-only تماماً مثل الحسابات.

## 4. العلاقة مع الفواتير

- `post_invoice()` آلية **منفصلة تماماً** عن آلية السندات — لا تمر عبر تريغر مبني على `status`، بل دالة `SECURITY DEFINER` تُستدعى صراحة من الواجهة، تُدرج مباشرة بـ`journal_entries`/`journal_entry_lines` حسب `commercial_kind`، مع `source_type='invoice'`. تستدعي `assert_accounting_period_open` صراحة وتقفل صف الفاتورة (`for update`).
- الحماية من تعديل فاتورة مرحّلة (`invoices_before_update_guard()`) نمط مطابق تماماً لنمط السندات (علم جلسة `is_invoice_posting()`) — لكن **بلا أي كود مشترك** بين الطرفين (منطقان منفصلان مكرّران لنفس الفكرة).
- **خطر خلط عملات محتمل، لم يُعالج بعد**: مقارنة سعة التخصيص (`validate_allocation_row_capacity`) و`open_items_view` تعتمدان على `jel.debit`/`jel.credit` **الخام** (بعملة سطر القيد الأصلية) مقابل `voucher_allocations.applied_amount` (بعملة السند)، **وليس** `debit_base`/`credit_base`. **لا يوجد أي فحص يضمن تطابق `currency_id`** بين سطر القيد المفتوح المستهدف وعملة السند المخصِّص. فاتورة بالدولار وسند قبض بعملة مختلفة أو بسعر صرف مختلف قد تُقارَن أرقامهما الخام مباشرة دون تحذير — هذا يطابق فئة "خلط العملتين" المُشار إليها بتدقيق سابق (`AUDIT_REPORTS.md`) ولا يزال قائماً؛ لم أجد أي patch عالج هذه المقارنة تحديداً.

## 5. جدول ملخّص الفجوات

| # | الملاحظة | الموقع | الحالة |
|---|---|---|---|
| 1 | 12 ملف patch غير مُستدعاة من `build_setup_all.ps1`؛ محتواها مدمج فعلياً بـ`01_schema.sql` لكن بلا توثيق صريح لذلك داخل السكربت | `database/build_setup_all.ps1` | توثيقي |
| 2 | `01_schema.sql` يصف نفسه "الوضع الحالي الكامل" لكنه يفتقد بنيوياً الفترات المحاسبية/الفروع/المقاصة المضافة لاحقاً | `01_schema.sql:1-8` | فجوة دقة وصفية |
| 3 | حذف سند مرحّل وقيده (hard delete) بلا أي فحص فترة محاسبية مغلقة، وبصلاحية `vouchers.delete` فقط (ليست admin) | `01_schema.sql:2139-2198` | غير محلول |
| 4 | حد التخصيص (allocation cap): قفل صف فعلي عند الترحيل | `01_schema.sql:1379-1511` | **مُصلَح** |
| 5 | تأكيد قبل عكس السند بالواجهة | `voucher-form.tsx:362-388` | **مُصلَح** |
| 6 | إلغاء السند الأصلي أثناء العكس يمر عبر فرع تريغر متجاوَز بالكامل — بلا فحص فترة على تاريخ السند الأصلي؛ صلاحية العكس = `vouchers.edit` فقط | `01_schema.sql:1772-1932` | غير محلول (اكتشاف جديد) |
| 7 | RLS مفتوحة بالكامل (`using(true)`) على `accounts`, `vouchers`, `voucher_lines`, `voucher_allocations`, `journal_entries`, `journal_entry_lines` — نموذج الصلاحيات التفصيلي UI-only بالكامل | `database/02_rls.sql` | غير محلول |
| 8 | مقارنة مبالغ خام (غير `_base`) بين تخصيص السند وسطر القيد المفتوح، بلا تحقق تطابق `currency_id` — خطر خلط عملات | `patch_journal_dimensions.sql:92-160`, `01_schema.sql:1379-1447` | غير محلول |
| 9 | لا عمود `account_type`/`nature` منظَّم ولا علم `is_system` للحسابات الجذرية | `01_schema.sql:50-64` | غير محلول (تصميمي) |
| 10 | خلل `debit_base_base` القديم | — | **مُصلَح بالكامل** (تحقق شامل) |
| 11 | فهرسة جيدة على `account_id`, `journal_entry_id`, `cost_center_id`, `branch_id`, `currency_id`, `source_invoice_id`, `voucher_date` | `01_schema.sql` + patches | جيد |
| 12 | لا واجهة لقيد يدوي حر، لكن RLS المفتوحة تسمح تقنياً بإدخال مباشر بلا فحص فترة | `02_rls.sql:71-91` | ثغرة نظرية |

## 6. الخلاصة المعمارية

نموذج السندات والقيود **أنضج ملحوظاً** من قسم المخزون من حيث معالجة التزامن — حد التخصيص محمي فعلياً بقفل صف عند اللحظة الحرجة، وتأكيد عكس السند مُضاف بالواجهة. أكبر فجوتين متبقيتين فعلياً:
- **حذف سند/قيد مرحّل نهائي (hard delete) بلا أي بوابة فترة محاسبية**، بصلاحية عادية وليست إدارية — هذا أخطر من مشكلة العكس لأنه لا يُبقي أثراً على الإطلاق.
- **نموذج RLS مفتوح بالكامل على كل جداول الحسابات/السندات/القيود** — الصلاحيات الدقيقة (`accounts.edit`, `vouchers.delete`, ...) شكلية بمستوى الواجهة فقط، ولا تحمي فعلياً من استدعاء مباشر لقاعدة البيانات عبر العميل.

كذلك، خلل خلط العملات المحتمل عند تخصيص السندات (مبالغ خام لا `_base`) لم يُعالج بعد رغم الإشارة إليه سابقاً بتدقيق التقارير.

---

## توصيات التطوير (مرتّبة حسب الأولوية)

### 🔴 حرج

1. **إضافة فحص فترة محاسبية مغلقة إلى `delete_voucher_with_journal()`** — استدعِ `assert_accounting_period_open(voucher_date, branch_id)` قبل الحذف الفعلي؛ إن كانت الفترة مغلقة، ارفض الحذف (اطلب عكساً بدل حذف). هذا يسد الفجوة الأخطر: حذف نهائي بلا أثر لبيانات مدققة ومقفلة.
2. **رفع صلاحية الحذف الفعلي (`vouchers.delete`) لتتطلب `is_admin()` أيضاً**، أو تقييدها بفترة قصيرة بعد الترحيل مباشرة (مثلاً "يمكن الحذف فقط خلال نفس اليوم قبل الإقفال")، تماشياً مع خطورة أنها العملية الوحيدة بلا أثر تدقيقي مقارنة بالعكس.
3. **إغلاق فجوة فحص الفترة عند إلغاء السند الأصلي أثناء العكس** — عدّل `reverse_posted_voucher()` أو التريغر بحيث يستدعي `assert_accounting_period_open(old.voucher_date, old.branch_id)` صراحة قبل تحويل السند الأصلي إلى `cancelled`، حتى ضمن فرع التجاوز، بدل الاعتماد فقط على فحص فترة اليوم الحالي للسند الجديد.

### 🟠 عالٍ

4. **إصلاح مقارنة العملات في تخصيص السندات** — عدّل `validate_allocation_row_capacity`/`open_items_view` لاستخدام `debit_base`/`credit_base` بدل القيم الخام، أو أضف تحققاً صريحاً يرفض التخصيص إن اختلفت `currency_id` بين السند وسطر القيد المستهدف بلا تحويل معلن.
5. **إضافة مفتاح صلاحية مخصّص `vouchers.reverse`** منفصل عن `vouchers.edit` العام، بما أن العكس عملية بمفعول محاسبي مختلف تماماً عن تعديل عادي (يُنشئ ويُرحّل سنداً جديداً ويُلغي آخر).
6. **تفعيل RLS دقيق على الأقل لعمليات الكتابة الحساسة** (`journal_entries`, `journal_entry_lines`, `vouchers` INSERT/UPDATE/DELETE) عبر `has_permission()` داخل السياسة نفسها، بدل الاعتماد فقط على واجهة تُخفي الأزرار — أولوية أعلى إن كان أي مستخدم غير موثوق (مثلاً حساب فرعي بصلاحيات محدودة) سيصل مباشرة لمفاتيح Supabase العامة من المتصفح.

### 🟡 متوسط

7. **توحيد آلية "حماية عنصر مرحّل" بين الفواتير والسندات** — دمج `is_invoice_posting()`/`is_force_voucher_delete()`/`is_force_voucher_reverse()` في نمط مشترك واحد (دالة مساعدة عامة تأخذ اسم الجدول/العلم) بدل تكرار نفس الفكرة بكود منفصل مرتين.
8. **توثيق صريح داخل `build_setup_all.ps1`** لسبب استبعاد الـ12 ملف patch (تعليق يشير إلى أنها دُمجت في `01_schema.sql` وتاريخ الدمج)، وتحديث ترويسة `01_schema.sql` لتصف نفسها بدقة (أو فصل قسم "ما لا يزال يُضاف عبر patches لاحقة" بوضوح).
9. **إضافة عمود `account_type` منظَّم (enum: asset/liability/equity/revenue/expense) وعلم `is_system`** على `accounts` بدل الاعتماد الضمني على كود الحساب الجذري — يسهّل تقارير مالية مستقبلية (قائمة الدخل/المركز المالي) ويمنع حذف/تعديل الحسابات الجذرية بشكل صريح بدل الاعتماد على قيود عامة فقط.
10. **إضافة قيد `check` يمنع خلط عملات ضمن نفس القيد** (`journal_entry_lines.currency_id` موحّد لكل أسطر نفس `journal_entry_id`) على مستوى قاعدة البيانات، حتى لو لم يحدث ذلك حالياً بالمسارات الموجودة — يمنع دخول هذا الخلل مستقبلاً عبر أي مسار إدخال مباشر.

### 🔵 توصية معمارية

11. **النظر في طبقة API وسيطة (Next.js route handlers) لعمليات الكتابة الحساسة** (سندات، قيود، حسابات) بدل اتصال العميل المباشر بـSupabase لكل شيء — يتيح فرض صلاحيات دقيقة مركزياً بمنطق واحد بدل الاعتماد الكلي على RLS + تريغرات متفرقة، ويسهّل تدقيق كل عملية كتابة حساسة من نقطة واحدة.

## ملحق — ملفات مرجعية رئيسية

- `database/01_schema.sql` — `accounts` (50-68)، قواعد الهرمية (504-609)، `journal_entries`/`journal_entry_lines` (83-119)، توازن القيد (998-1025)، `vouchers`/`voucher_lines`/`voucher_allocations` (259-337)، حد التخصيص (1379-1566)، العكس والحذف (1772-2198).
- `database/patch_period_enforcement.sql` — `assert_accounting_period_open()`.
- `database/patch_reverse_invoice_settlement.sql` — النسخة الفعّالة النهائية من `vouchers_before_update_handle_posting()` و`reverse_posted_voucher()`.
- `database/patch_voucher_delete.sql` (مدمج بـ`01_schema.sql`) — `delete_voucher_with_journal()`.
- `database/patch_trial_balance_opening.sql` — `get_trial_balance()` النهائية.
- `database/patch_journal_dimensions.sql` — `open_items_view`، أبعاد القيد الإضافية.
- `database/patch_post_invoice.sql` — `post_invoice()`, `invoices_before_update_guard()`.
- `database/02_rls.sql` — سياسات RLS لكل الجداول أعلاه.
- `web/src/modules/vouchers/components/voucher-form.tsx` — منطق العكس والتأكيد بالواجهة.
- `web/src/modules/settings/permissions/permission-catalog.ts` — تعريف مفاتيح الصلاحيات (UI-only حالياً).
