# تدقيق دقيق — تقرير المشتريات التفصيلي (Purchase Lines)

> **حالة المعالجة (2026-07-26):** #3 إشارة مرتجع المشتريات في `summarize()` ✓؛ صلاحية الواجهة ✓ (`ReportsAccessGate`). فصل/استبعاد `opening_stock` من الصافي لا يزال اختيارياً مفتوحاً.

منهجية: قراءة الكود الفعلي لشاشة `web/src/app/reports/purchase-lines/page.tsx` وطبقة الخدمة `web/src/modules/reports/services/purchase-lines-report-api.ts`، وتتبّع دالة `get_purchase_lines_report()` عبر `database/build_setup_all.ps1` إلى تعريفها الفعلي بـ`database/patch_inventory_phase6.sql` — **مُعرَّفة مرة واحدة فقط** بكامل قاعدة الكود، لا تعارض إصدارات. كجزء من نطاق التدقيق، تحقّقت **مجدداً من الصفر** (وليس بالاعتماد على `AUDIT_INVOICES_JOURNAL.md` كما هو) من حالة الخلل الموصوف فيه (البند 1: "فاتورة الشراء بخصم سطري تُنتج قيداً غير متوازن ولا تُرحَّل إطلاقاً") بقراءة النسخة **الفعّالة اليوم** من `post_invoice()`، عبر تتبّع ترتيب الباتشات بـ`build_setup_all.ps1` (`patch_post_invoice.sql` ← `patch_invoice_line_adjustments.sql` ← `patch_invoice_pricing_cost.sql`، الأخير هو الفعّال لأنه آخرها بالقائمة).

---

## 1. تحديث حالة: خلل "فاتورة الشراء بخصم سطري" في `AUDIT_INVOICES_JOURNAL.md` **مُصلَح فعلياً بالكود الحالي** — ولا أثر رقمي متبقٍّ على هذا التقرير

فرع الشراء الفعّال اليوم (`database/patch_invoice_pricing_cost.sql:816-910`):
- سطر القيد المدين لتكلفة المخزون/المشتريات يستخدم `v_line_cost` (السطر 856-863 أو 868-875)، حيث `v_line_cost := calc_inbound_inventory_amount(...)` (سطر 844-850).
- سطر الخصم المنفصل دائن (`v_discount_acct`) **أصبح الآن مشروطاً صراحةً** بـ`not coalesce(v_pat.line_adjustments_affect_material_cost, true)` (سطر 878-888) — **مطابق تماماً** لشرط سطر "الإضافي" المجاور (سطر 890-898)، وهو بالضبط الإصلاح الذي أوصى به `AUDIT_INVOICES_JOURNAL.md` البند 1 ("تطبيق نفس شرط الإضافي على سطر الخصم").
- عندما `line_adjustments_affect_material_cost = true` (القيمة الافتراضية)، `calc_inbound_inventory_amount()` (`patch_invoice_pricing_cost.sql:41-63`) ترجع `p_line_amount` (=`v_row.line_amount`) مباشرة — **نفس القيمة تماماً** المُستخدَمة لسطر القيد الدائن الوحيد (`v_row.line_amount`, سطر 900-910). مدين = دائن لكل سطر مادة → **القيد متوازن، والفاتورة تُرحَّل بنجاح** بخصم سطري بالإعدادات الافتراضية.

**الأثر على هذا التقرير تحديداً:** `get_purchase_lines_report()` (`patch_inventory_phase6.sql:39-75`) يقرأ `discount_amount`/`line_amount` مباشرة من `invoice_material_lines` (وليس من القيد المُرحَّل) ويُصفّي فقط `i.status = 'posted'`. بما أن الخلل كان **يمنع الترحيل بالكامل** (فشل تام، وليس رقماً خاطئاً)، أثره على هذا التقرير — عندما كان الخلل قائماً — لم يكن "أرقام خاطئة بالتقرير"، بل **غياب تام** لهذه الفواتير من التقرير أصلاً (لأنها لن تصل لحالة `posted` إطلاقاً فتفشل بشرط `i.status = 'posted'`). بما أن الخلل مُصلَح الآن، **لا يوجد أي أثر رقمي متبقٍّ على هذا التقرير** طالما كل الفواتير المعروضة به فعلاً بحالة `posted` (وهذا مضمون بشرط `where i.status = 'posted'` بالدالة نفسها). أضفتُ سطر حالة معالجة لـ`AUDIT_INVOICES_JOURNAL.md` يوثّق هذا التأكيد (انظر أسفل).

## 2. 🔴 لا فحص صلاحية إطلاقاً — نفس فجوة تقرير المبيعات بالضبط

`web/src/app/reports/purchase-lines/page.tsx` (كامل الملف) **لا يستدعي `hasPermission`/`PermissionGate` إطلاقاً**، ولا صفحة المحور `web/src/app/reports/page.tsx`. صلاحية `reports.view` (`permission-catalog.ts:53`) مُعرَّفة وغير مستخدَمة بأي مكان بالواجهة. على مستوى القاعدة، `get_purchase_lines_report()` مُعرَّفة `security definer` (`patch_inventory_phase6.sql:36`) بلا أي تحقق دور/صلاحية داخل الجسم (سطر 38-75)، ولا `revoke`/`grant execute` مخصّص بأي ملف SQL — تتجاوز RLS بالكامل ويستدعيها أي مستخدم مسجّل دخول بصلاحية Supabase الافتراضية. **نفس الخطورة الحرجة الموثَّقة بتقرير المبيعات.**

## 3. 🔴 "إجمالي مبلغ"/"إجمالي كمية" يجمع المرتجعات وبضاعة أول المدة بلا عكس إشارة — يشوّه صافي المشتريات أكثر من تقرير المبيعات (3 أنواع مختلطة لا 2)

`purchase-lines-report-api.ts` — `summarize()` يجمع `line_amount`/`quantity_base` مباشرة بلا شرط `commercial_kind`، تماماً كتقرير المبيعات. لكن هنا المشكلة **أوسع**: `COMMERCIAL_KIND_LABELS` يشمل ثلاثة أنواع (`purchase`, `return_purchase`, `opening_stock` — `purchase-lines-report-api.ts:47-51`)، وكلها تُجمع بنفس الإشارة الموجبة. مثال: مشتريات 100 + مرتجع مشتريات 30 + بضاعة أول مدة 50 (لو كانت ضمن الفلترة الزمنية) → "إجمالي مبلغ" = 180، وليس "صافي مشتريات الفترة" (=70 إن استُثنيت بضاعة أول المدة، أو رقم مختلف تماماً حسب التعريف المطلوب) بأي تفسير محاسبي واحد متّسق. لا فلتر بالشاشة لاستبعاد `opening_stock` من المجموع تحديداً (فقط خيار "تضمين مرتجع المشتريات" بشيك بوكس واحد، `page.tsx:263-270`) — بضاعة أول المدة مُضمَّنة دائماً بالمجموع دون خيار استبعاد.

## 4. 🟠 استبعاد `invoice_account_lines` — لا يطابق إجمالي فاتورة الشراء عند وجود بنود إضافية (نقل، جمارك، إلخ)

مطابق تماماً لتقرير المبيعات (البند 3 هناك): `get_purchase_lines_report()` (`patch_inventory_phase6.sql:54-59`) يبدأ من `invoice_material_lines` فقط، يستبعد `invoice_account_lines` بالكامل. فواتير الشراء غالباً ما تحمل بنود إضافية شائعة (رسوم شحن/جمارك) عبر `invoice_account_lines` — هذي لن تظهر بالتقرير ولن تُحتسب بمجموعه، فلا يطابق التكلفة الإجمالية الفعلية للفاتورة.

## 5. 🟠 لا حد أقصى (Limit) ولا فترة افتراضية — نفس فجوة الأداء

`get_purchase_lines_report()` بلا `limit`، و`page.tsx` يبدأ بـ`fromDate`/`toDate` فارغين — أول تحميل يجلب كل سطر شراء/مرتجع/بضاعة أول مدة مُرحَّل تاريخياً بلا حد.

## 6. 🟡 أزرار التصدير/الطباعة لا تتبع `.btn`/`.btn-outline` + قوائم كود فقط بلا اسم

نفس ملاحظات تقرير المبيعات بالضبط (البندان 5-6 هناك) — `ExportCsvButton`/`PrintReportButton` (`purchase-lines/page.tsx:151-166`) بتنسيق يدوي، وقوائم المورد/المادة/المستودع/الفرع (`page.tsx:194-253`) تعرض الكود أو `vendor.name_ar` فقط (قائمة المورد فعلاً تعرض `vendor.name_ar` بشكل صحيح — سطر 204 — على عكس تقرير المبيعات؛ لكن المادة/المستودع/الفرع لا تزال كوداً فقط، سطر 217-221، 232-236، 247-251).

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **إضافة فحص صلاحية فعلي** (واجهة + دالة RPC) — مطابق للتوصية بتقرير المبيعات.
2. **إصلاح `summarize()` ليفصل/يعكس إشارة `return_purchase` و`opening_stock`** عن `purchase` الفعلية — أو على الأقل توضيح بالواجهة أن "إجمالي مبلغ" مجموع خام غير صافٍ، وإضافة خيار استبعاد `opening_stock` من المجموع مثل خيار المرتجع الموجود فعلاً.

### 🟠 عالٍ

3. **توثيق استبعاد `invoice_account_lines`** أو دمجها إن كان الهدف مطابقة تكلفة الفاتورة الكاملة.
4. **إضافة حد أقصى (Limit/Pagination) وفترة افتراضية**.

### 🟡 متوسط

5. **توحيد أزرار التصدير/الطباعة مع `.btn`/`.btn-outline`**، وعرض "كود — اسم" لقوائم المادة/المستودع/الفرع.

## ملحق — ملفات مرجعية رئيسية

- `web/src/app/reports/purchase-lines/page.tsx` — الشاشة كاملة، المرشِّحات (175-271)، الملخص (273-283)، الجدول (299-363).
- `web/src/modules/reports/services/purchase-lines-report-api.ts` — `listRows()` (69-89)، `summarize()` (94-108).
- `database/patch_inventory_phase6.sql` — `get_purchase_lines_report()` الوحيدة (9-80)، `security definer` بلا صلاحية (36-38).
- `database/patch_invoice_pricing_cost.sql` — فرع `'purchase'` بـ`post_invoice()` الفعّال (816-910)، الإصلاح المؤكَّد بسطر الخصم المشروط (878-888)، `calc_inbound_inventory_amount()` (41-63).
- `database/build_setup_all.ps1` — ترتيب `patch_post_invoice.sql`(15) ← `patch_invoice_line_adjustments.sql`(38) ← `patch_invoice_pricing_cost.sql`(44، الفعّال).
- `AUDIT_INVOICES_JOURNAL.md` — البند 1، أُضيف له سطر حالة معالجة يوثّق هذا التأكيد.
