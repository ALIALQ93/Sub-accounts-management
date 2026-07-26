# تدقيق دقيق — تقرير المبيعات التفصيلي (Sales Lines)

> **حالة المعالجة (2026-07-26):** #2 إشارة المرتجعات في `summarize()` ✓؛ #1 صلاحية الواجهة ✓ (`ReportsAccessGate` / `reports.view`). فحص صلاحية داخل RPC لا يزال مفتوحاً.

منهجية: قراءة الكود الفعلي لشاشة `web/src/app/reports/sales-lines/page.tsx` وطبقة الخدمة `web/src/modules/reports/services/sales-lines-report-api.ts`، وتتبّع دالة `get_sales_lines_report()` عبر `database/build_setup_all.ps1` إلى تعريفها الفعلي بـ`database/patch_inventory_phase7.sql` — دالة **مُعرَّفة مرة واحدة فقط** بكامل قاعدة الكود (لا تعارض "آخر create-or-replace يفوز" هنا). كما تتبّعت المحفزات التي تُنتج `line_amount`/`discount_amount`/`quantity_base` المصدر (`invoice_material_lines_apply_quantities`, `patch_invoice_line_adjustments.sql:41-94`) لتقييم "هل الأرقام تطابق الفاتورة فعلاً"، وقارنت أسلوب الأزرار والتنبيهات بالنظام التصميمي المشترك (`web/src/app/globals.css`, `.btn`/`.btn-outline`، `var(--danger)`).

---

## 1. 🔴 لا فحص صلاحية إطلاقاً — لا بالواجهة ولا بقاعدة البيانات، رغم وجود صلاحية `reports.view` مُعرَّفة أصلاً

`web/src/app/reports/sales-lines/page.tsx` (كامل الملف) **لا يستدعي `hasPermission`/`PermissionGate`/`useAuth` إطلاقاً**. صفحة المحور `web/src/app/reports/page.tsx` أيضاً تعرض بطاقة "تقرير المبيعات التفصيلي" بلا أي شرط صلاحية — بحثت بكامل `web/src/app/reports/` عن `hasPermission` فلم أجد أي استخدام في أي صفحة تقرير. صلاحية `reports.view` مُعرَّفة فعلياً بالكتالوج (`web/src/modules/settings/permissions/permission-catalog.ts:53`) لكن **غير مستخدمة بأي مكان بالواجهة إطلاقاً** — صلاحية "ميتة" بلا أي أثر.

على مستوى القاعدة: `get_sales_lines_report()` مُعرَّفة `security definer` (`patch_inventory_phase7.sql:36`) — أي أنها **تتجاوز RLS بالكامل بغض النظر عن سياسات `invoices`/`invoice_material_lines`** — وجسمها لا يحتوي أي تحقق دور/صلاحية (`patch_inventory_phase7.sql:38-76`). لا يوجد أي `revoke`/`grant execute` مخصّص لهذي الدالة بأي ملف SQL (بحثت بكامل `database/*.sql`) — يعني الصلاحية الفعلية تعتمد على منح Supabase الافتراضي لـ`authenticated` على كل دالة جديدة بـschema `public`. **النتيجة: أي مستخدم مسجّل دخول، بغض النظر عن أي صلاحية مُخصَّصة له فعلياً بشاشة إدارة الصلاحيات، يقدر يستدعي هذا الـRPC ويرى كامل بيانات المبيعات التفصيلية لكل الفروع والعملاء.**

## 2. 🔴 مجموع "إجمالي مبلغ"/"إجمالي كمية" بالملخص يجمع المرتجعات بلا عكس إشارة — رقم مضلِّل وليس صافي المبيعات

`sales-lines-report-api.ts` — `summarize()`:
```ts
summarize(rows: SalesLineReportRow[]) {
  return rows.reduce(
    (acc, row) => ({
      line_count: acc.line_count + 1,
      quantity_base: acc.quantity_base + row.quantity_base,
      line_amount: acc.line_amount + row.line_amount,
      discount_amount: acc.discount_amount + row.discount_amount,
    }),
    { line_count: 0, quantity_base: 0, line_amount: 0, discount_amount: 0 },
  );
}
```
`row.line_amount`/`row.quantity_base` **دائماً موجبة** لكل من `sale` و`return_sale` على حد سواء — المحفز المصدر (`invoice_material_lines_apply_quantities`, `patch_invoice_line_adjustments.sql:78-82`) يرفض صراحة أي `line_amount` سالب (`raise exception 'Line net amount cannot be negative...'`). بما أن `summarize()` يجمع القيمتين **بنفس الإشارة**، تفعيل خيار "تضمين مرتجع المبيعات" (المفعّل افتراضياً، `includeReturns = true` بـ`page.tsx:39`) **يزيد** بطاقة "إجمالي مبلغ" و"إجمالي كمية" بدل أن يخصم المرتجع منها. مثال: بيع بـ100 ثم مرتجع كامل بـ100 على نفس المادة → الشاشة تعرض "إجمالي مبلغ: 200" بدل الصافي الصحيح (صفر). هذا يخالف مباشرة سؤال "هل يطابق إجمالي الفاتورة؟" المطلوب التحقق منه — **الرقم المعروض ليس صافي مبيعات بأي تفسير محاسبي، بل مجموع نشاط خام**. يتناقض هذا أيضاً مع اتفاقية باقي التطبيق: دفتر حركة المخزون (`inventory_movements.quantity_base_delta`) يسجّل الإشارة (+/-) فعلياً حسب نوع الحركة (بيع = سالب، مرتجع بيع = موجب أو العكس حسب الاتجاه) بما يسمح بصافي حقيقي — بينما هذا التقرير تحديداً لا يعكس أي إشارة عند الجمع.

## 3. 🟠 التقرير يقتصر على `invoice_material_lines` فقط — يستبعد `invoice_account_lines` فلن يطابق إجمالي الفاتورة الفعلي عند وجود بنود إضافية

الاستعلام (`patch_inventory_phase7.sql:54-59`) يبدأ من `invoices i inner join invoice_material_lines iml` فقط، ولا يمس جدول `invoice_account_lines` إطلاقاً (الجدول موجود ومُستخدَم فعلياً بترحيل القيود، انظر `patch_invoice_pricing_cost.sql:609-676` — "حساب إضافي" منفصل عن أسطر المواد). أي فاتورة مبيعات فيها بند إضافي على مستوى الفاتورة (رسوم شحن، خدمة، إلخ عبر `invoice_account_lines`) — سطرها لن يظهر إطلاقاً بهذا التقرير، ومجموع "إجمالي مبلغ" لكل فواتيرها لن يطابق إجمالي الفاتورة الفعلي المُرحَّل بالقيد. هذا سلوك متوقَّع من اسم "تقرير أسطر المواد" لكنه غير موثَّق بأي مكان بالشاشة — لا تنويه "لا يشمل البنود الإضافية غير المادية".

## 4. 🟠 لا حد أقصى (Limit) ولا فترة افتراضية — أول تحميل للشاشة يجلب كل سطر مبيعات مُرحَّل منذ بداية النشاط

`get_sales_lines_report()` (`patch_inventory_phase7.sql:39-75`) بلا `limit` إطلاقاً. `page.tsx` يبدأ بـ`fromDate`/`toDate` فارغين (سطر 33-34) فيُترجمان لـ`undefined` فتتجاهلهما شرطي `p_from_date is null`/`p_to_date is null` بالدالة — **أول فتح للشاشة يجلب تاريخياً كل سطر بيع/مرتجع مُرحَّل بلا أي حد**، ثم فلترة نصية إضافية على المتصفح (`page.tsx:103-113`). مع تراكم سنوات من الفواتير، هذا خطر أداء متنامٍ حقيقي — نفس النمط الموثَّق بتقرير "الحركات المفتوحة" (`2026-07-25-open-movements-audit.md`, البند 4).

## 5. 🟡 أزرار التصدير/الطباعة لا تستخدم فئات النظام التصميمي المشتركة `.btn`/`.btn-outline`

`ExportCsvButton` (`web/src/components/export-csv-button.tsx:20-26`) و`PrintReportButton` (`web/src/components/print-report-button.tsx:27-36`) يستخدمان تنسيقاً يدوياً بـTailwind خام (`rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50`) بدل فئات `.btn`/`.btn-outline` المُعرَّفة فعلياً بـ`web/src/app/globals.css:123-173` والمُستخدَمة بمعظم أزرار التطبيق الأخرى (مثال: `web/src/app/reports/page.tsx:196-207` يستخدم `btn btn-sm btn-primary`/`btn btn-outline` لأزرار "فتح"). هذا الفرق يجعل زري التصدير والطباعة يبدوان بصرياً مختلفين قليلاً (زوايا/حشوة/ألوان hover) عن بقية أزرار نفس الشاشة — لأن كلا المكوّنين مُستخدَمان مباشرة بـ`sales-lines/page.tsx:151-171` بجانب زر "فتح" العادي بصفحة المحور. الفجوة مشتركة على مستوى المكوّن (تؤثر أيضاً على تقرير المشتريات الذي يستخدم نفس المكوّنين).

## 6. 🟡 قوائم المرشِّحات (مادة/مستودع/فرع) تعرض الكود فقط بلا الاسم العربي — صعوبة اختيار عملية

`page.tsx:220-225` (قائمة المادة): `{material.material_code}` فقط — لا `material.name_ar`. نفس الشيء لقائمتي المستودع (`236-240`) والفرع (`251-255`): كود فقط. لمحاسب يتذكر اسم المادة/المستودع بالعربي أكثر من كودها الرقمي/الحرفي، هذا يصعّب الاختيار الصحيح من قائمة طويلة دون معرفة الكود مسبقاً — يفضَّل عرض "الكود — الاسم" مثل بقية شاشات الإدخال بالتطبيق.

## 7. 🔵 لا تحقق من وحدة القياس المعروضة — عمود "كمية" يُفترض ضمنياً أنه بوحدة الأساس

عمود الجدول (`page.tsx:314` و`350-352`) يعرض `row.quantity_base.toFixed(4)` تحت عنوان "كمية" بلا أي إشارة لوحدة القياس (لا رمز وحدة، ولا توضيح أنها "كمية بالوحدة الأساسية" وليست وحدة البيع الأصلية بالفاتورة). محاسب يقارن هذا الرقم بفاتورة ورقية بوحدة مختلفة (كرتون مثلاً) قد يظن وجود خطأ. تسمية العمود "كمية (أساس)" أو إضافة عمود لوحدة القياس الأصلية تحل اللبس.

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **إضافة فحص صلاحية فعلي** — إما `PermissionGate` بالواجهة (`reports.view` أو صلاحية أدق) وإما تحقق داخل `get_sales_lines_report()` نفسها (أو كليهما، والأفضل الاثنان معاً بما أن الواجهة وحدها غير كافية كما وثّقته تدقيقات POS/الفواتير سابقاً بنفس اليوم).
2. **إصلاح `summarize()` ليعكس إشارة `return_sale`** — إما بإرجاع `line_amount`/`quantity_base` بإشارة سالبة من الدالة نفسها لسطور المرتجع (وتعديل الجدول التفصيلي ليعرض القيمة المطلقة إن أُريد الحفاظ على عرض إيجابي بالجدول)، وإما بحساب `summarize()` بشرط `commercial_kind` صراحة. بدون هذا، بطاقة "إجمالي مبلغ" مضلِّلة لأي فترة فيها مرتجعات.

### 🟠 عالٍ

3. **توثيق/تنويه أن التقرير لا يشمل `invoice_account_lines`** بنص صريح بالشاشة، أو دمج بنود الفاتورة الإضافية كصف منفصل إن كان الهدف "مطابقة إجمالي الفاتورة" فعلاً.
4. **إضافة حد أقصى (Limit/Pagination) وفترة افتراضية** (مثلاً الشهر الحالي) بدل جلب كل السطور التاريخية عند أول فتح للشاشة.

### 🟡 متوسط

5. **توحيد أزرار `ExportCsvButton`/`PrintReportButton` مع فئات `.btn`/`.btn-outline`** المشتركة — إصلاح مرة واحدة بالمكوّنين يفيد كل التقارير التي تستخدمهما.
6. **عرض "الكود — الاسم العربي" بقوائم المادة/المستودع/الفرع** بدل الكود المجرَّد.

### 🔵 معماري

7. **توضيح تسمية عمود الكمية** ("كمية أساسية" + رمز الوحدة) لتفادي الالتباس مع وحدة الفاتورة الأصلية.

## ملحق — ملفات مرجعية رئيسية

- `web/src/app/reports/sales-lines/page.tsx` — الشاشة كاملة، المرشِّحات (179-275)، الملخص (277-287)، الجدول (303-367).
- `web/src/modules/reports/services/sales-lines-report-api.ts` — `listRows()` (69-90)، `summarize()` (95-109، بلا عكس إشارة).
- `database/patch_inventory_phase7.sql` — `get_sales_lines_report()` الوحيدة (9-80)، `security definer` بلا تحقق صلاحية (36-38).
- `database/patch_invoice_line_adjustments.sql` — `invoice_material_lines_apply_quantities()` (41-94)، رفض `line_amount` سالب (78-82).
- `database/patch_invoice_pricing_cost.sql` — `invoice_account_lines` كمصدر منفصل غير مشمول بالتقرير (609-676).
- `web/src/components/export-csv-button.tsx`, `web/src/components/print-report-button.tsx` — تنسيق يدوي بدل `.btn`.
- `web/src/modules/settings/permissions/permission-catalog.ts:53` — `reports.view` مُعرَّفة وغير مستخدَمة بالواجهة.
- `database/02_rls.sql:71-90` — سياسات `journal_entries`/`journal_entry_lines` بـ`using(true)` (سياق عام، `invoices`/`invoice_material_lines` غير ذات صلة مباشرة هنا لأن RPC تتجاوز RLS أصلاً عبر `security definer`).
