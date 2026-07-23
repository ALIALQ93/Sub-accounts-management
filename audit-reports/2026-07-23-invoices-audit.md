# تدقيق دقيق — قسم الفواتير (Invoices)

> **حالة المعالجة (مستودع الكود، 2026-07-23):** #1 حد الخصم SQL ✓ · #2 سقف مرتجع تراكمي ✓ · #3 صلاحية داخل post_invoice ✓ · #4 cancel_draft_invoice ✓ · #5 RLS كتابة فواتير/أنماط ✓ · #6 منع تعديل رأس مرحّل ✓ · #8 إخفاء line_amount rounding ✓ · #9 حقل خصم مبلغ ✓ · #10 توثيق صيغة السطر ✓ · #11 حقول نمط ميتة معطّلة بالواجهة ✓ · #7 حجز الرقم / #12–14 معلّقة.

منهجية: قراءة الكود الفعلي (SQL + TypeScript) وتتبّع ترتيب تطبيق الـpatches عبر `database/build_setup_all.ps1`. الملفات ذات الصلة بترتيب التنفيذ: `patch_invoices.sql`(#5) → `patch_invoice_seeds.sql`(#6) → `patch_invoice_reservation_discount.sql`(#7) → `patch_invoice_discount_rounding.sql`(#8) → `patch_settlement_foundation.sql`(#9) → `patch_post_invoice.sql`(#10) → `patch_invoice_multiple_references.sql`(#11) → `patch_invoice_reference_close.sql`(#12) → ... → `patch_invoice_line_adjustments.sql`(#33) → `patch_invoice_pattern_tracking.sql`(#35) → ... → `patch_invoice_pricing_cost.sql`(#39) → ... → `patch_invoice_material_require_base_unit.sql`(#47، الأخير). النسخة الفعّالة من `post_invoice()`, `invoices_before_update_guard()`, `invoice_material_lines_apply_quantities()` هي دائماً آخر ملف يعيد تعريفها — أهمها `patch_invoice_pricing_cost.sql` و`patch_invoice_line_adjustments.sql`.

هذا التقرير مكمّل لتدقيقي `2026-07-22-materials-warehouses-audit.md` و`2026-07-22-accounts-vouchers-audit.md` اللذين غطّيا `post_invoice()` من زاوية المخزون والقيود؛ التركيز هنا على قسم الفواتير كنظام كامل: الأنماط، دورة الحياة، التسعير، المرتجعات، العملاء، الصلاحيات، والواجهة.

## 1. أنماط الفواتير (`invoice_patterns`) — محرك الإعداد

الجدول `patch_invoices.sql:12-78`، وسّعته patches لاحقة. إعدادات **مُعرَّفة لكن بلا أي استهلاك مؤكَّد** (لا SQL ولا TS خارج تعريف العمود/نموذج الإعداد نفسه):
- `paired_input_pattern_id`, `inter_branch_account_id`, `inter_cc_account_id` (`patch_invoices.sql:39-41`)
- `cc_on_goods`, `cc_on_party`, `load_party_currency` (`patch_invoices.sql:44-49`) — تظهر بنموذج الإعداد والـTS types فقط.
- `generate_journal` — يظهر بالنموذج، لكن `post_invoice()` **لا يتحقق منه إطلاقاً** قبل توليد القيد (لا شرط مقابل).
- `peek_invoice_no()` — دالة SQL معرَّفة (معاينة رقم بلا حجز) بلا أي استدعاء لها من كود TS الحالي.

**آلية الترقيم** (`reserve_invoice_no`, `patch_invoices.sql:425-483`): `INSERT ... ON CONFLICT DO NOTHING` ثم `SELECT ... FOR UPDATE` على `invoice_pattern_sequences` — **محمية فعلياً من تصادم رقمين لنفس النمط في نفس اللحظة**. لكن الحجز يحدث عند **إنشاء المسودة** (`invoice-api.ts:270-276,296`)، وليس عند الترحيل. بما أنه لا يوجد مسار حذف ولا إلغاء (§2)، **أي مسودة تُترك بلا ترحيل تستهلك رقماً نهائياً يبقى فجوة دائمة في التسلسل**.

`pricing_cost_mode`/`pricing_consumed_mode` تُقرأ في **SQL فقط** لحساب COGS — غائبة تماماً عن `invoice-form.tsx` (لا معاينة حية لأثرها بالواجهة، منطق أحادي الجانب).

`reference_settings` (jsonb) تُقرأ **حصراً في TS** (`reference-settings.ts`) — لا وجود لأي تحقق منها في SQL إطلاقاً؛ فحص التطابق المرجعي (`validate-reference-match.ts`) والقيود على المرجع كلها client-side بحتة، قابلة للتجاوز بنداء مباشر لـSupabase.

## 2. دورة حياة الفاتورة

الحالات: `status in ('draft','posted','cancelled')` (`patch_invoices.sql:197-198`) — **لا حالة اعتماد وسيطة** (بخلاف السندات التي تملك `'approved'`)، الانتقال `draft → posted` مباشرة.

`invoices_before_update_guard()` (النسخة الفعّالة: `patch_invoice_line_adjustments.sql:967-987`):
- إن كانت الفاتورة `posted`: **يُسمح بالتعديل فقط لـ`is_admin()`**، لأي حقل برأس الفاتورة، بلا استثناء آخر.
- **اكتشاف دقيق**: هذا الحارس يغطي جدول `invoices` فقط. أما `invoice_lines_prevent_change_when_posted()` (نفس الملف، سطر 994-1014) يمنع **أي** تعديل على `invoice_material_lines`/`invoice_account_lines` لفاتورة مرحّلة **بلا استثناء للأدمن إطلاقاً** (لا يستدعي `is_admin()`). النتيجة: الأدمن يستطيع تعديل رأس فاتورة مرحّلة (تاريخ، عميل، حساب، خصم) مباشرة عبر UPDATE **دون أن يُعاد ترحيل القيد المحاسبي المرافق** — احتمال انحراف صامت بين رأس الفاتورة المعدَّل والقيد الذي تولّد وقت الترحيل الأصلي، لكنه لا يستطيع لمس الأسطر.

**الإلغاء (Cancel) — تأكيد نهائي**: `'cancelled'` قيمة موجودة بقيد الفحص فقط، وتُستخدم دفاعياً في `post_invoice()` لرفض ترحيل فاتورة ملغاة، وفي شارات العرض. **لا يوجد أي مسار كتابة يضع `status='cancelled'`** — لا RPC، لا زر واجهة، لا استعلام UPDATE، في كامل الكود (بحث شامل). **ولا سياسة RLS للحذف (`DELETE`) على `invoices`** — الحذف مرفوض ضمنياً. **مسار الإلغاء/الحذف غائب كلياً**، يطابق ما ورد بتدقيق السندات ولم يتغيّر.

**الصلاحيات على الترحيل**: `post_invoice(uuid)` ممنوحة لكل `authenticated` **بلا أي فحص صلاحية داخلي** (لا `has_permission`, لا `is_admin`). كتالوج الصلاحيات لا يملك مفتاحاً `invoices.post` أصلاً — زر الترحيل بالواجهة محمي فقط بمظلة `invoices.edit` **UI فقط**. أي مستخدم `authenticated` (حتى بلا أي صلاحية ممنوحة) يستطيع ترحيل أي فاتورة عبر استدعاء RPC مباشر.

قفل تزامن الترحيل موجود وسليم: `post_invoice()` يبدأ بـ`select ... for update` على صف الفاتورة، يمنع ترحيل نفس الفاتورة مرتين بالتوازي، ويستدعي `assert_accounting_period_open()` قبل المتابعة.

## 3. التسعير، الخصم، التقريب

**الخصم على مستوى السطر** (`invoice_material_lines_apply_quantities`, `patch_invoice_line_adjustments.sql:41-93`): النسبة لها أولوية على المبلغ الثابت — إن أُدخلت نسبة > 0 يُعاد حساب `discount_amount` من الصفر متجاهلاً أي قيمة يدوية سابقة له.

**الخصم/التقريب على مستوى الفاتورة** (`post_invoice`, `patch_invoice_pricing_cost.sql`): الخصم يُطبَّق على مجموع الأسطر بعد خصم السطر. التقريب يُطبَّق **فقط عندما `rounding_target in ('invoice_total','both')`**.

**`rounding_target='line_amount'` — إعداد ميت بالكامل**: قيمة مسموحة بقيد الفحص لكن **غير مُنفَّذة إطلاقاً**، لا في SQL (`post_invoice` لا يتحقق سوى من `invoice_total`/`both`) ولا في TS (`applyRounding()` يُستدعى مرة واحدة فقط بـ`scope="invoice"` — لا استدعاء بـ`scope="line"` في كامل الملف).

**منطق مكرر TS ↔ SQL بفروق تقريب داخلية دقيقة**: `invoice-line-utils.ts:14-72` يعيد تطبيق نفس صيغة `gross - discount + extra` الموجودة بالتريغر، لكن بترتيب تقريب مختلف داخلياً (SQL يُقرِّب `discount_amount` لمنزلتين ثم يطرح؛ TS يحسب بدقة أعلى وسيطة قبل التقريب النهائي). الفرق يُمتَص غالباً بالتقريب النهائي للـ`line_amount`، لكنه يبقى تطبيقين مستقلين لنفس الصيغة — نفس نمط الازدواجية الموثّق سابقاً لتحويل الوحدات بتدقيق المخزون.

**`max_discount_percent` — تحقق UI فقط، لم يتغيّر منذ التدقيق السابق**: بحث شامل يؤكد صفر استخدام SQL لهذا العمود خارج تعريفه. الاستخدام الوحيد هو `validate-invoice.ts:96-122`، يُستدعى فقط من فحص الواجهة عند الحفظ. **أي نداء API مباشر يتجاوز الحد الأقصى للخصم كلياً بلا أي رادع خادمي.**

**`discount_applies_to` غير معروف لـSQL**: `post_invoice` يطبّق خصم السطر وخصم الفاتورة **معاً ومستقلَّين** بغض النظر عن هذا الإعداد؛ لو أُدخل كلا النوعين عبر نداء مباشر (متجاوزاً إخفاء الحقول بالواجهة) سيُطبَّق الاثنان معاً بالقيد المحاسبي.

**`invoice_discount_amount` (خصم فاتورة كمبلغ ثابت) — مُنفَّذ بـSQL بالكامل لكن بلا أي طريق وصول من الواجهة**: العمود موجود ومُعالَج في `post_invoice`، لكن `invoice-form.tsx` لا يملك أي حقل إدخال له، و`buildHeaderPayload()` بـ`invoice-api.ts:127-157` لا يرسله إطلاقاً بحمولة الحفظ — يبقى دائماً `0` الافتراضي.

**لا ضريبة (VAT) إطلاقاً**: لا عمود `tax`/`vat_rate`/`tax_amount` في `invoices`/`invoice_material_lines`/`invoice_patterns` بحث شامل. `company_settings.tax_number` بيانات تعريفية فقط (الرقم الضريبي للشركة)، وليس منطق حساب ضريبة على الفاتورة.

## 4. المرتجعات والربط المرجعي

`invoice_reference_links` (many-to-many مراجع إضافية، `patch_invoice_multiple_references.sql:8-19`): كان بلا RLS، أُصلح لاحقاً بتفعيل RLS في `patch_audit_governance_security.sql:100-108` — **لكن السياسة الحالية بعد "الإصلاح" ما زالت `for all using(true) with check(true)`**: أي أن الإصلاح فعّل RLS لكن لم يُقيِّده فعلياً، نفس نمط الانفتاح العام على كل الجداول الأخرى.

**تحميل أسطر المرتجع**: `reference-invoice-api.ts` ينسخ الكمية كاملة كما بالفاتورة الأصلية (لا خصم لما أُرجع مسبقاً عند التحميل الأولي).

**سقف الكمية المُطبَّق (`reference-line-caps.ts`) client-side بالكامل**، ويقارن فقط بكمية الفاتورة المرجعية المُحمَّلة نفسها.

**فجوة مؤكَّدة: تجاوز كمية المرتجع عبر فواتير متعددة** — لا استعلام واحد (لا TS ولا SQL) يجمع كميات فواتير `return_sale`/`return_purchase` **سابقة** تشير لنفس `reference_invoice_id` عند حساب السقف. يمكن إنشاء عدة فواتير مرتجع مستقلة، كل واحدة بحدها الأقصى الكامل (كمية الفاتورة الأصلية نفسها)، فيتجاوز إجمالي المرتجعات الكمية المباعة/المشتراة أصلاً دون أي رفض — لا فحص TS ولا SQL. قابل للتجاوز الكامل حتى عبر الواجهة العادية (ليس فقط نداء مباشر).

`close_invoice_reference()` (`patch_invoice_reference_close.sql:17-48`) إغلاق يدوي لإخفاء فاتورة مرحّلة من قائمة المراجع المتاحة مستقبلاً — **ليس آلية تتبّع كمية**، لا علاقة له بالفجوة أعلاه.

## 5. العملاء والموردون

`customers`/`vendors` (`01_schema.sql:121-147`): أعمدة أساسية فقط. **لا يوجد عمود `credit_limit` أو أي حقل حد ائتماني بتاتاً** — بحث شامل صفر نتائج بكامل المشروع. بالتبعية: **لا فحص حد ائتمان قبل ترحيل فاتورة بيع آجلة**، ليس فقط "غير مُفعَّل" بل **البنية ذاتها غير موجودة بالمخطط**. الرصيد المفتوح يُدار حصراً عبر لوحة الحركات المفتوحة (تسوية بعد الترحيل)، لا رقابة استباقية.

## 6. RLS والصلاحيات

| الجدول | select/insert/update | delete |
|---|---|---|
| `invoice_patterns` وجداولها الفرعية | `using(true)`/`with check(true)` | لا توجد (بعضها) |
| `invoices` | `using(true)`/`with check(true)` | **لا توجد سياسة حذف إطلاقاً** |
| `invoice_material_lines`/`invoice_account_lines` | `for all using(true) with check(true)` | مسموح (منفتح) |
| `invoice_reference_links` | `for all using(true) with check(true)` | — |
| `customers`/`vendors` | `using(true)`/`with check(true)` | لا توجد |

RLS مُفعَّلة على كل الجداول لكن كل سياسة فعلياً مفتوحة بالكامل — الحماية الحقيقية الوحيدة هي منع `anon`. أي مستخدم `authenticated` بغض النظر عن دوره يملك وصولاً كاملاً read/write لكل بيانات الفواتير/الأنماط/العملاء/الموردين، بلا عزل بالفرع/الدور.

مفاتيح `permission-catalog.ts` (`invoices.view/create/edit/settings`) **UI-only بحتة** — لا مقابل SQL/RLS لها، ولا مفتاح `invoices.post` مستقل. يطابق تماماً النمط الموثّق بتدقيقي المخزون والحسابات.

## 7. بنية الواجهة

`web/src/modules/invoices/`: خدمات (`invoice-api.ts` 427 سطر، `invoice-pattern-api.ts` 548 سطر، +8 خدمات أخرى)، مكونات (14 ملفاً)، utils (13 ملفاً منطق تحقق/تسعير/تقريب/مرجعية).

**ملفات كبيرة تستحق تقسيماً:**
- `invoice-form.tsx` — **1975 سطراً**: مكوّن أحادي ضخم، ~40 `useState`، منطق تحقق/حفظ/ترحيل/عرض كله بملف واحد بلا تقسيم لمكونات فرعية (باستثناء الجداول).
- `invoice-pattern-form.tsx` — **1179 سطراً**: 14 قسماً متسلسلاً بنموذج واحد ضخم.
- `invoice-material-lines-table.tsx` — 762 سطراً.

**لا وظيفة طباعة/PDF للفاتورة إطلاقاً** — لا `@media print`، لا زر تصدير، بحث شامل بكامل قسم الفواتير.

## 8. ملخص الفجوات

| # | الفجوة | الموقع | الخطورة |
|---|---|---|---|
| 1 | لا مسار إلغاء/حذف فاتورة — `cancelled` بالمخطط فقط، بلا أي مسار كتابة إليه | عبر كامل الكود | عالٍ |
| 2 | أرقام الفواتير تُحجز عند إنشاء المسودة لا عند الترحيل — فجوات دائمة بالتسلسل من مسودات متروكة | `invoice-api.ts:270-296` | متوسط |
| 3 | `max_discount_percent` تحقق UI فقط، صفر إنفاذ SQL | `validate-invoice.ts:96-122` | عالٍ |
| 4 | `rounding_target='line_amount'` إعداد ميت بالكامل | `post_invoice`, `rounding-utils.ts` | متوسط |
| 5 | `invoice_discount_amount` منفَّذ بـSQL لكن بلا أي حقل إدخال بالواجهة | `invoice-form.tsx`, `invoice-api.ts:127-157` | منخفض-متوسط |
| 6 | تجاوز كمية المرتجع عبر فواتير مرتجع متعددة — لا فحص تراكمي أصلاً | `reference-line-caps.ts` | عالٍ |
| 7 | لا حد ائتماني للعملاء — العمود غير موجود بالمخطط | `customers` | متوسط (فجوة ميزة لا خلل) |
| 8 | RLS مفتوحة بالكامل على كل جداول الفواتير/الأنماط/العملاء | `database/02_rls.sql` وملحقاته | عالٍ |
| 9 | صلاحيات `invoices.*` UI-only، لا مفتاح `invoices.post`، الترحيل بلا فحص صلاحية داخل `post_invoice` | `permission-catalog.ts`, `post_invoice()` | عالٍ |
| 10 | ازدواجية منطق TS/SQL لحساب صافي السطر بفروق تقريب داخلية | `invoice-line-utils.ts` مقابل التريغر | منخفض |
| 11 | تعديل رأس فاتورة مرحّلة من الأدمن بلا إعادة ترحيل القيد المرافق | `invoices_before_update_guard()` | متوسط |
| 12 | حقول نمط معرَّفة وغير مُستهلكة (`paired_input_pattern_id`, `inter_branch_account_id`, `inter_cc_account_id`, `cc_on_goods`, `cc_on_party`, `load_party_currency`, `generate_journal`, `peek_invoice_no()`) | `patch_invoices.sql` | معماري |
| 13 | لا منطق ضريبة (VAT) إطلاقاً | — | فجوة ميزة |
| 14 | لا وظيفة طباعة/PDF للفاتورة | — | فجوة ميزة |

## 9. الخلاصة

قسم الفواتير هو **الأكثر تعقيداً وغنى بالإعدادات** في النظام (أنماط قابلة للتخصيص بعمق)، لكنه أيضاً القسم الذي يحمل أكبر عدد من "الفجوات بين الإعداد المعروض والتنفيذ الفعلي" مجتمعة في مكان واحد: حد الخصم، تقريب السطر، خصم الفاتورة الثابت، وحقول نمط كاملة بلا أثر. النمط المتكرر عبر كل الأقسام التي دُقِّقت (مخزون، حسابات/سندات، فواتير) واضح الآن: **التحقق دائماً بالواجهة (client-side)، بينما القاعدة (RLS + الدوال) مفتوحة بالكامل تقريباً** — أي حماية فعلية تعتمد كلياً على أن المستخدم يستخدم الواجهة الرسمية ولا يستدعي Supabase مباشرة. أخطر فجوتين عمليتين هنا تحديداً: تجاوز حد الخصم، وتجاوز كمية المرتجع عبر فواتير متعددة — كلتاهما قابلة للاستغلال حتى من مستخدم عادي بالواجهة (المرتجع) أو بنداء مباشر بسيط (الخصم).

---

## توصيات التطوير (مرتّبة حسب الأولوية)

### 🔴 حرج

1. **إنفاذ `max_discount_percent` داخل `post_invoice()`/التريغر** — أضف فحصاً في `invoice_material_lines_apply_quantities()` (على مستوى السطر) وفي `post_invoice()` (على مستوى الفاتورة) يرفض الترحيل إن تجاوز الخصم الفعلي الحد المسموح بالنمط، بدل ترك ذلك للواجهة فقط.
2. **إصلاح سقف كمية المرتجع ليكون تراكمياً عبر كل فواتير المرتجع السابقة لنفس المرجع** — عدّل `reference-line-caps.ts` (أو أضف دالة SQL) لتطرح مجموع الكميات المرتجعة فعلياً بفواتير `return_sale`/`return_purchase` مرحّلة سابقة تشير لنفس `reference_invoice_id`، قبل السماح بإدخال كمية جديدة.
3. **حماية `post_invoice()` بفحص صلاحية داخلي** — أضف `has_permission('invoices.edit')` (أو مفتاح `invoices.post` جديد) كشرط داخل الدالة نفسها، بنفس نمط `SECURITY DEFINER` المستخدم أصلاً بدوال السندات الحساسة، بدل الاعتماد فقط على إخفاء زر بالواجهة.

### 🟠 عالٍ

4. **إضافة مسار إلغاء فاتورة فعلي (`cancel_invoice`)** — دالة `SECURITY DEFINER` تضع `status='cancelled'` لفاتورة `draft` (أو `posted` مع توليد قيد عكسي مشابه لآلية عكس السندات)، مع فحص فترة محاسبية وصلاحية مخصّصة. هذا يفتح الباب أيضاً لتفعيل `release_on_cancel` (فجوة موثّقة سابقاً بتدقيق المخزون تعتمد أصلاً على وجود هذا المسار).
5. **تفعيل RLS دقيق مبني على `has_permission()`** لعمليات الكتابة على `invoices`, `invoice_patterns`, `customers`, `vendors` — نفس التوصية الواردة بتدقيقي المخزون والحسابات، لأنها الفجوة الجذرية المشتركة بين الأقسام الثلاثة.
6. **معالجة تعديل رأس فاتورة مرحّلة من الأدمن** — إما امنعه بالكامل (اطرح مرتجع/تصحيح رسمي بدلاً منه)، أو أضف منطقاً يُعيد مزامنة القيد المحاسبي المرافق تلقائياً عند أي تعديل كهذا (نفس التوصية الواردة بتدقيق المخزون لتعديل فاتورة مرحّلة).

### 🟡 متوسط

7. **نقل حجز رقم الفاتورة إلى لحظة الترحيل بدل إنشاء المسودة**، أو أضف مسار تنظيف/إعادة تدوير لأرقام مسودات متروكة (يتطلب أولاً حل التوصية #4 — مسار الإلغاء — لتحرير الرقم بأمان).
8. **حذف أو تفعيل `rounding_target='line_amount'`** — بنفس أسلوب المشروع المُثبت مع FIFO سابقاً: إما نفّذه فعلياً بالتريغر والواجهة، أو أزله من القيم المسموحة وأضف رسالة توضيحية.
9. **ربط `invoice_discount_amount` بالواجهة** — أضف حقل إدخال فعلي في `invoice-form.tsx` وأرسله ضمن `buildHeaderPayload()`، أو احذفه من SQL إن لم يعد مطلوباً كخيار.
10. **توحيد منطق حساب صافي السطر (خصم/إضافي) بين TS وSQL** — إما استخرج صيغة مشتركة (RPC خفيف للمعاينة الحية)، أو وثّق الفرق صراحة بتعليق متبادل في كلا الملفين لتقليل خطر انحراف صامت مستقبلاً.
11. **تنظيف حقول النمط غير المُستهلكة** — إما فعّل `paired_input_pattern_id`/`inter_branch_account_id`/`inter_cc_account_id`/`cc_on_goods`/`cc_on_party`/`load_party_currency`/`generate_journal` فعلياً، أو أزلها من نموذج الإعداد لتفادي إيهام المستخدم بضمانات غير موجودة (نفس نمط الفجوات المتكرر بهذا القسم).

### 🔵 توصية معمارية / فجوة ميزة (ليست خطأ)

12. **إضافة حد ائتماني للعملاء (`credit_limit`)** إن كان ضمن النطاق المستقبلي — يتطلب إضافة عمود جديد بالمخطط وفحصاً استباقياً بـ`post_invoice()` قبل ترحيل بيع آجل يتجاوز الحد، وليس فقط تسوية لاحقة.
13. **إضافة دعم ضريبة القيمة المضافة (VAT)** إن كانت متطلبات العمل تستوجبها — تصميم جديد كامل (عمود/جدول ضريبة، حساب مستحقات ضريبية، بند بالقيد المحاسبي)، غير موجود إطلاقاً حالياً.
14. **إضافة وظيفة طباعة/تصدير PDF للفاتورة** — غائبة كلياً حالياً.

## ملحق — ملفات مرجعية رئيسية

- `database/patch_invoices.sql` — `invoice_patterns`, `invoices`, `reserve_invoice_no`/`peek_invoice_no`.
- `database/patch_invoice_reservation_discount.sql` — `max_discount_percent`, `discount_applies_to`, الحجز.
- `database/patch_invoice_discount_rounding.sql` — `invoice_discount_amount`, `rounding_*`.
- `database/patch_invoice_line_adjustments.sql` — النسخة الفعّالة من `invoices_before_update_guard()`, `invoice_lines_prevent_change_when_posted()`, `invoice_material_lines_apply_quantities()`.
- `database/patch_invoice_pricing_cost.sql` — النسخة الفعّالة من `post_invoice()` كاملة.
- `database/patch_invoice_multiple_references.sql` + `database/patch_invoice_reference_close.sql` — `invoice_reference_links`, `close_invoice_reference()`.
- `web/src/modules/invoices/components/invoice-form.tsx` (1975 سطراً) — النموذج الرئيسي.
- `web/src/modules/invoices/components/invoice-pattern-form.tsx` (1179 سطراً) — إعداد الأنماط.
- `web/src/modules/invoices/utils/{validate-invoice,reference-line-caps,rounding-utils,invoice-line-utils}.ts`
- `web/src/modules/invoices/services/{invoice-api,invoice-pattern-api,reference-invoice-api}.ts`
- `web/src/modules/settings/permissions/permission-catalog.ts` — مفاتيح `invoices.*` (UI-only).
