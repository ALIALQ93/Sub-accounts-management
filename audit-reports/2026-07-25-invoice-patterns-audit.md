# تدقيق دقيق — أنماط الفواتير (Invoice Patterns)

منهجية: قراءة الكود الفعلي (SQL + TypeScript)، باعتبار `database/setup_all.sql` (20287 سطراً) المرجع المُجمَّع الفعلي — يُعاد توليده من `database/build_setup_all.ps1` بتطبيق كل ملفات `patch_*.sql` بالتسلسل؛ عند تكرار تعريف نفس الدالة (`create or replace function`) في أكثر من patch فإن **آخر تعريف بالملف المُجمَّع هو الفعّال فعلياً** وقت التشغيل. تم تتبّع كل حقل بجدول `invoice_patterns` (والجداول الفرعية `invoice_pattern_conditions`, `invoice_pattern_allowed_materials`, `invoice_pattern_allowed_categories`, `invoice_pattern_sequences`) عبر بحث نصي شامل في `database/setup_all.sql` للتأكد من وجود استهلاك فعلي خارج تعريف العمود نفسه، وقورن بما تعرضه `invoice-pattern-form.tsx` (1196 سطراً) للمستخدم.

هذا التقرير مكمّل لـ`2026-07-23-invoices-audit.md` (غطّى الفواتير ككل) و`AUDIT_INVOICE_PATTERNS.md` (دقّق 3 حالات ميتة، أصبحت الآن ✓ — راجع الترويسة المُضافة لذلك الملف). لا تكرار لما أُغلق: **لا** إعادة فحص لـ`max_discount_percent`, سقف المرتجع التراكمي, صلاحية `post_invoice`, `release_on_cancel`, `cancel_draft_invoice`, أو حقول `paired_input_pattern_id`/`inter_branch_account_id`/`inter_cc_account_id`/`cc_on_goods`/`cc_on_party`/`load_party_currency`/`generate_journal`/`peek_invoice_no()` (تحققتُ أنها ما زالت مغلقة كما هو موثّق، انظر §5) — التركيز هنا على ما لم يُفحص بعد.

## 1. تخصيص المواد/الأصناف المسموحة بالنمط (`allowed_material_ids`/`allowed_category_ids`) — بلا أي إنفاذ خادمي، خلافاً لنقاط البيع

**المكان:** الجدولان `invoice_pattern_allowed_materials` (`database/setup_all.sql:4050-4054`) و`invoice_pattern_allowed_categories` (`database/setup_all.sql:4056-4060`) — مفتاح مركّب `(pattern_id, material_id)`/`(pattern_id, category_id)`. تُكتب من الواجهة عبر `invoicePatternApi.replaceAllowedMaterials`/`replaceAllowedCategories` (`web/src/modules/invoices/services/invoice-pattern-api.ts:312-348`)، وتُعرض بقسم "تخصيص المواد والأصناف" بالنموذج (`web/src/modules/invoices/components/pattern-allowed-section.tsx`).

**بحث شامل بكامل `database/setup_all.sql`** عن `invoice_pattern_allowed_materials`/`invoice_pattern_allowed_categories` يُظهر **3 مواضع فقط**: تعريف الجدول، تفعيل RLS (`4567-4568`)، والسياسة المفتوحة `for all using(true)` (`4608-4614`). **لا استعلام `select`/`exists` واحد يقرأ من أي من الجدولين بأي دالة أو محفز بكامل الملف** — لا `post_invoice()`, لا `assert_invoice_may_post()`, لا أي محفز على `invoice_material_lines`.

**المقارنة المباشرة — نفس الميزة منفَّذة فعلياً لنقاط البيع:** آخر نسخة فعّالة من `assert_invoice_may_post()` (`database/setup_all.sql:15854-16068`) تحوي تعليقاً صريحاً `-- إنفاذ إعدادات نقطة البيع (لو الفاتورة صادرة من POS) — AUDIT_POS.md #3` (`:15999-16001`)، وتتحقق فعلياً — **لكن فقط عندما `v_inv.pos_point_id is not null`** (`:16002`) — من `pos_point_allowed_materials`/`pos_point_allowed_categories` لكل سطر مادة قبل السماح بالترحيل (`:16038-16063`، ترفض الترحيل برسالة `'Material on line % is not allowed for POS point %.'`). أي أن المشروع يملك بالفعل النمط الصحيح لتطبيق هذا القيد على مستوى SQL — طُبِّق لنقاط البيع فقط ولم يُطبَّق مطلقاً على نمط الفاتورة نفسه.

**الأثر:** أي فاتورة عادية (غير صادرة من نقطة بيع) — بيع، شراء، مناقلة، بضاعة أول مدة — **لا يوجد أي رادع خادمي يمنع إدخال مادة خارج قائمة "مواد/أصناف مسموحة" المحدَّدة بالنمط**. الإنفاذ الوحيد موجود بالواجهة فقط: `isMaterialAllowedForPattern()` (`web/src/modules/invoices/utils/material-filter.ts:32-42`) تُستدعى من `invoice-form.tsx:1041-1048` عند الحفظ لترفض بالواجهة برسالة "المادة ... غير مسموحة في هذا النمط." — أي نداء مباشر لـ Supabase (إدراج `invoice_material_lines` ثم استدعاء `post_invoice`) يتجاوز هذا القيد بالكامل، تماماً كنمط "تحقق واجهة فقط" الموثَّق سابقاً لحقول أخرى، لكن هذا تحديداً غير مُشار له بأي تقرير سابق رغم وجود آلية مطابقة جاهزة ومُختبَرة (نقاط البيع) يمكن تعميمها.

## 2. شروط النمط (`invoice_pattern_conditions`) — 11 علم إلزام، صفر إنفاذ SQL

**المكان:** جدول `invoice_pattern_conditions` (`database/setup_all.sql:4034-4048`) — 11 عمود `boolean`: `require_party`, `require_sales_rep`, `require_cost_center`, `require_receipt_no`, `prevent_duplicate_receipt_no`, `require_payment_terms`, `require_warehouse`, `require_color`, `require_size`, `require_source`, `require_caliber`. يُعرض بقسم "شروط النمط" بالنموذج (`invoice-pattern-form.tsx:978-992`) كمفاتيح تبديل عادية (غير معطَّلة، توحي بأنها فعّالة).

**بحث شامل** عن `invoice_pattern_conditions` بكامل `database/setup_all.sql` يُظهر استخدامها في 3 سياقات فقط: تعريف الجدول، محفز الإنشاء التلقائي عند نمط جديد (`invoice_patterns_after_insert()`, `:4425-4440`)، وإدراجَي seed لنمطين افتراضيين (`:17062-17067`, `:19045-19050`). **لا `select` واحد من هذا الجدول داخل `post_invoice()` أو `assert_invoice_may_post()`** — بحثت في كل النسخ الفعّالة الأخيرة لكلتا الدالتين (`:17074` و`:19103` لـ`post_invoice`، `:15854` لـ`assert_invoice_may_post`).

**الإنفاذ الوحيد الموجود بالكامل client-side**: `web/src/modules/invoices/utils/validate-invoice.ts` — كل الأعلام الـ11 تُقرأ وتُتحقق فقط هناك (أسطر 58, 67, 71, 76, 83, 156, 159, 162, 165, 168 وما يقابلها من عرض/إخفاء حقول بالسطر 288-320). **أي نداء مباشر لـ Supabase (إدراج فاتورة/سطر بلا عميل، بلا مركز كلفة، بلا رقم إيصال، بلا مندوب مبيعات، بلا لون/مقاس/مصدر/عيار رغم إلزامها بالنمط) يمر للترحيل بلا أي رفض خادمي** — نفس نمط `max_discount_percent` قبل إصلاحه، لكن بـ11 حقلاً بدل حقل واحد ولم يُفحص بأي تدقيق سابق.

**ملاحظة فرعية دقيقة على `prevent_duplicate_receipt_no`:** هذا العلم تحديداً **مزدوج الزيف** — ليس فقط غير مقروء من SQL، بل السلوك الفعلي بقاعدة البيانات **ثابت بغض النظر عن قيمته**: `create unique index ... idx_invoices_receipt_no_unique on public.invoices(receipt_no) where receipt_no is not null and trim(receipt_no) <> ''` (`database/setup_all.sql:4149-4151`) — فهرس فريد **شامل لكل الفواتير بكل الأنماط دون تمييز**، يُفعَّل دائماً سواء كان `prevent_duplicate_receipt_no = true` أو `false` بنمط معيّن، **وأيضاً بلا تمييز بين الأنماط** (نمطان مختلفان لا يستطيعان مشاركة نفس رقم الإيصال حتى لو كلاهما لم يفعّل هذا الخيار). المستخدم الذي يعطّل هذا الخيار متوقعاً السماح بتكرار رقم الإيصال سيُفاجأ برفض الفهرس له بلا أي علاقة بإعداده المختار.

## 3. `invoice_patterns.is_active` — غير مُتحقَّق منه عند إنشاء/ترحيل فاتورة

**المكان:** العمود `is_active` (`database/setup_all.sql:3945` وما يليه ضمن تعريف `invoice_patterns`)، مستخدَم فقط كفهرس فرز (`idx_invoice_patterns_active_sort`, `:4013-4014`). **بحث شامل عن `is_active` بسياق النمط بكل دوال SQL (`post_invoice`, `assert_invoice_may_post`, `reserve_invoice_no`, محفزات `invoice_material_lines`) يُظهر صفر نتائج** — لا تحقق واحد يمنع إنشاء أو ترحيل فاتورة من نمط `is_active = false`.

**الإنفاذ الوحيد بالواجهة فقط**: صفحة قائمة الفواتير `web/src/app/invoices/page.tsx:39` تفلتر `patternsData.filter((p) => p.is_active)` قبل عرض روابط "فاتورة جديدة" — إن عُطِّل نمط بعد أن كان له فواتير مسودة سابقة (أو عبر نداء مباشر بـ`pattern_id` صريح), `reserve_invoice_no()` و`post_invoice()` كلاهما ينفذان بلا اعتراض. أثر عملي منخفض نسبياً (يتطلب معرفة `pattern_id` مسبقاً) لكنه يتبع نفس نمط الفجوات المتكرر: تعطيل نمط بالإعدادات يُخفيه بالواجهة فقط، لا يمنعه فعلياً.

## 4. عدم اتساق نظام التصميم — `invoice-pattern-form.tsx` لا يستخدم مكوّنات `.btn` المشتركة

**المكان:** أزرار الحفظ/الإلغاء بأسفل النموذج (`invoice-pattern-form.tsx:1177-1193`) تستخدم Tailwind خام مباشرة: `className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"` للحفظ و`className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"` للإلغاء — بدل الأصناف المشتركة `.btn.btn-primary`/`.btn.btn-outline` المعرَّفة بـ`web/src/app/globals.css:149-176` (تستخدم `var(--brand-navy)`/`var(--shadow-sm)`).

**المقارنة:** نماذج إعداد مشابهة بنفس التطبيق تستخدم الأصناف المشتركة فعلياً — مثال مباشر `web/src/modules/pos/components/pos-point-form.tsx:509,516-518` (`className="btn btn-outline"` و`className="btn btn-primary"`)، وكذلك `material-form.tsx`, `warehouse-form-modal.tsx`, `payment-voucher-form.tsx`. كامل حقول الإدخال بالنموذج أيضاً تستخدم لوناً ثابتاً (`border-slate-300`, `text-slate-700`, إلخ) بدل متغيرات الثيم (`var(--brand-navy)` ونحوها) المستخدمة بمكونات أخرى من نفس القسم (مثلاً `invoices-list-table.tsx`, `transfers-list-table.tsx:72` يستخدم `var(--success)`). النتيجة: نموذج إعداد الأنماط (أهم نموذج إعداد بالقسم، 1196 سطراً) هو الاستثناء المرئي وسط بقية نماذج الإعداد بالتطبيق من ناحية الالتزام بنظام التصميم الموحّد — لا يؤثر وظيفياً لكنه يكسر الاتساق البصري (لون أزرق مختلف عن `--brand-navy` الفعلي المستخدم بباقي الواجهة).

## 5. تحقق إيجابي — ما تم التأكد من إغلاقه فعلياً

- **الترقيم (`reserve_invoice_no`/`peek_invoice_no`, `database/setup_all.sql:4315-4419`)**: آلية سليمة — `INSERT ... ON CONFLICT DO NOTHING` ثم `SELECT ... FOR UPDATE` على `invoice_pattern_sequences` يمنع تصادم رقمين لنفس النمط بالتزامن؛ منطق التصفير السنوي/الشهري (`numbering_reset`) صحيح فقط عند `numbering_include_year = true` لتجنّب تكرار الرقم عبر السنوات؛ `greatest(last_number + 1, numbering_start)` يمنع الرجوع لرقم أقل حتى لو خُفِّض `numbering_start` لاحقاً؛ وفهرس `invoices.invoice_no unique` (`:4098`) يشكّل شبكة أمان أخيرة حتى لو فشل القفل. **لا فجوة تصادم جديدة وُجدت** — فجوة حجز الرقم عند إنشاء المسودة بدل الترحيل (تسبب فجوات دائمة من مسودات متروكة) موثّقة مسبقاً بـ`2026-07-23-invoices-audit.md` #7 ولا تزال معلّقة حسب الترويسة، لم يُعَد فحصها هنا.
- `peek_invoice_no()` **لم يعد كوداً ميتاً** — يُستدعى فعلياً من `invoice-form.tsx:665` لمعاينة الرقم التالي قبل الحفظ (يتفق مع إغلاق البند فيما يخص هذه الدالة تحديداً بترويسة `2026-07-23-invoices-audit.md`).
- `inter_branch_account_id`/`inter_cc_account_id` (كانا موثَّقين كحقلين ميتين بالنمط) **أُزيلا كلياً من `InvoicePatternFormValues`** — لم يعودا يظهران بالنموذج إطلاقاً (بخلاف `paired_input_pattern_id` الذي بقي ظاهراً لكن معطَّلاً بشرح صريح). العمودان لا يزالان موجودين بمخطط `invoice_patterns` (`:3973-3974`) وبجداول `branches`/`cost_centers` المرتبطة (`:3032, 3059-3060, 3079`) لكن بلا أي مسار واجهة يعدِّلهما — غير خطير، يتفق مع نهج "إخفاء بدل حذف" المستخدم لبقية الحقول الميتة.
- `transfer_transit_account_id` **مُستهلَك فعلياً** بآخر نسخة من `post_invoice()` (`database/setup_all.sql:19174`, `v_transit := coalesce(v_inv.transfer_transit_account_id, v_pat.transfer_transit_account_id)`) — ليس حقلاً ميتاً.
- `line_adjustments_affect_material_cost`, `discount_applies_to`, `enforce_stock_availability` — الثلاثة مقروءة فعلياً وبكثافة بآخر نسخ فعّالة من الدوال ذات الصلة (`invoice_material_lines_apply_quantities`, `assert_invoice_may_post`, `inventory_movements_enforce_stock`) — لا فجوة.
- قسم "الحجز" بالنموذج (`invoice-pattern-form.tsx:853-898`) يعرض تحذيراً صريحاً بأن الحجز لا يُطرح من الرصيد المتاح — تحقّقتُ أن هذا صحيح فعلاً: `get_material_warehouse_qty_balance()` (المستخدمة بـ`inventory_movements_enforce_stock`, `:18289-18293`) لا تُدخل `inventory_reservations` بحسابها إطلاقاً. الإفصاح بالواجهة صادق ومطابق للواقع — لا فجوة "إيهام" هنا، فقط قيد فعلي غير منفَّذ ومُعلَن بصراحة.

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **تعميم فحص "المواد/الأصناف المسموحة" على كل الفواتير لا فقط نقاط البيع** — أضف كتلة داخل `assert_invoice_may_post()` تتحقق من `invoice_pattern_allowed_materials`/`invoice_pattern_allowed_categories` لكل سطر بغض النظر عن `pos_point_id`، بنفس المنطق الموجود بالفعل لنقاط البيع (`database/setup_all.sql:16038-16063`) — هذا كود جاهز يحتاج فقط تعميم الشرط (إزالة `if v_inv.pos_point_id is not null` كنطاق حصري وتطبيقه دائماً عبر `invoice_pattern_id`).

### 🟠 عالٍ

2. **إنفاذ شروط النمط الإحدى عشر (`invoice_pattern_conditions`) داخل `assert_invoice_may_post()`** — أضف فحصاً لكل علم (`require_party`, `require_cost_center`, `require_receipt_no`, `require_payment_terms`, `require_sales_rep`, `require_warehouse`, `require_color`, `require_size`, `require_source`, `require_caliber`) يرفض الترحيل إن كان الحقل المطلوب فارغاً، بدل الاعتماد فقط على `validate-invoice.ts` بالواجهة.
3. **توضيح/تصحيح `prevent_duplicate_receipt_no`** — إما اجعل الفهرس الفريد (`idx_invoices_receipt_no_unique`) مشروطاً بالنمط (`unique(pattern_id, receipt_no)` أو معادلها) ليطابق الإعداد الظاهر بالواجهة، أو احذف الحقل من `invoice_pattern_conditions`/النموذج لأن السلوك الفعلي ثابت دائماً بلا علاقة به.

### 🟡 متوسط

4. **التحقق من `invoice_patterns.is_active` عند الحجز/الترحيل** — أضف شرطاً بـ`reserve_invoice_no()` و/أو `assert_invoice_may_post()` يرفض العملية إن كان النمط `is_active = false`، بدل الاعتماد فقط على فلترة قائمة الأنماط بالواجهة (`invoices/page.tsx:39`).
5. **توحيد نموذج إعداد الأنماط مع نظام التصميم المشترك** — استبدل الأصناف الخام (`bg-blue-900`, `border-slate-300`, إلخ) بـ`.btn`/`.btn-primary`/`.btn-outline` ومتغيرات الثيم (`var(--brand-navy)` ونحوها) بـ`invoice-pattern-form.tsx`، بما يطابق `pos-point-form.tsx`/`material-form.tsx`/`warehouse-form-modal.tsx`.

### 🔵 توصية معمارية / ملاحظة (ليست خطأ)

6. لا فجوة تصادم جديدة بآلية الترقيم — التصميم الحالي (`FOR UPDATE` + فهرس فريد احتياطي) سليم فعلياً؛ يبقى فقط البند المعلّق مسبقاً (#7 بتقرير 2026-07-23) بخصوص لحظة الحجز (مسودة لا ترحيل) خارج نطاق هذا التقرير.

## ملحق

- `database/setup_all.sql:3945-4017` — تعريف `invoice_patterns` الكامل.
- `database/setup_all.sql:4022-4060` — `invoice_pattern_sequences`, `invoice_pattern_conditions`, `invoice_pattern_allowed_materials`, `invoice_pattern_allowed_categories`.
- `database/setup_all.sql:4315-4419` — `peek_invoice_no()`, `reserve_invoice_no()`.
- `database/setup_all.sql:4425-4440` — `invoice_patterns_after_insert()` (إنشاء صف شروط/تسلسل تلقائياً عند نمط جديد).
- `database/setup_all.sql:4149-4151` — `idx_invoices_receipt_no_unique` (فهرس فريد شامل بلا تمييز نمط).
- `database/setup_all.sql:15854-16068` — آخر نسخة فعّالة من `assert_invoice_may_post()` (تحوي فحص POS المواد/الأصناف والخصم والمرتجع التراكمي).
- `database/setup_all.sql:19103` وما بعدها — آخر نسخة فعّالة من `post_invoice()`.
- `database/setup_all.sql:18252-18312` — `inventory_movements_enforce_stock()` (يقرأ `enforce_stock_availability`، لا يخصم الحجوزات من الرصيد).
- `web/src/modules/invoices/components/invoice-pattern-form.tsx` (1196 سطراً) — النموذج الكامل.
- `web/src/modules/invoices/components/pattern-allowed-section.tsx` — واجهة اختيار المواد/الأصناف المسموحة.
- `web/src/modules/invoices/services/invoice-pattern-api.ts:292-348` — قراءة/كتابة `invoice_pattern_allowed_materials`/`invoice_pattern_allowed_categories`.
- `web/src/modules/invoices/utils/material-filter.ts` — إنفاذ التخصيص بالواجهة فقط.
- `web/src/modules/invoices/utils/validate-invoice.ts` — إنفاذ شروط النمط بالواجهة فقط.
- `web/src/app/invoices/page.tsx:39` — فلترة `is_active` بالواجهة فقط.
- `web/src/app/globals.css:149-176` — تعريف `.btn`/`.btn-primary`/`.btn-outline`.
