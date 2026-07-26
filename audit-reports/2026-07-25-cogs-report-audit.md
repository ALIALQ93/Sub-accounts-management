# تدقيق دقيق — تقرير كلفة البضاعة المباعة (COGS)

> **حالة المعالجة (2026-07-26):** #1 عمود الإيراد ✓ — `sales_amount` من `invoice_material_lines.line_amount`. #2 تكلفة مرتجع المبيعات ✓ — تريغر + **تصحيح بأثر رجعي** لكل حركات `return_sale` الموجودة (`patch_reports_audit_fix2.sql`).

منهجية: قراءة الكود الفعلي (SQL + TypeScript) مباشرة، واعتماد `database/setup_all.sql` كمرجع «الحقيقة المُصرَّفة» — لأن ترتيب تطبيق الـpatches الفعلي (`database/build_setup_all.ps1`) يعني أن **آخر `create or replace` يفوز**، وليس أول نتيجة بحث نصي. تتبّعت تحديداً تعريفات `get_cogs_report`، `post_invoice()`، `inventory_movements_apply_invoice_line_cost()`، `calc_inbound_inventory_amount`، `calc_outbound_unit_cost`/`calc_outbound_line_total_cost` عبر عدة إعادات تعريف للتأكد من النسخة الفعّالة فعلياً في قاعدة بيانات مُهيّأة بـ`setup_all.sql`.

النطاق: `web/src/app/reports/cogs/page.tsx`، `web/src/modules/reports/services/cogs-report-api.ts`، ودالة `get_cogs_report` (`database/setup_all.sql:8045-8194`، من `patch_inventory_phase4.sql`).

---

## 1. عمود «الإيراد» (`sales_amount`) ليس إيراداً فعلياً — هو نفس التكلفة معروضة تحت اسم آخر 🔴

`get_cogs_report` (`database/setup_all.sql:8140-8151`):

```sql
coalesce(sum(case when s.movement_kind = 'sale' then coalesce(s.total_cost, 0) else 0 end), 0)::numeric(18, 2) as sales_amount,
...
coalesce(sum(case when s.movement_kind = 'sale' then round((abs(s.quantity_base_delta) * coalesce(s.unit_cost, 0))::numeric, 2) else 0 end), 0)::numeric(18, 2) as cogs_amount,
```

كلا العمودين مبنيان من `inventory_movements.total_cost`/`unit_cost` لحركة `sale` — وهذان العمودان **دائماً تكلفة البضاعة المباعة، وليسا سعر البيع**. السبب: `post_invoice()` يُدرج الحركة بقيم مبدئية (`unit_cost = purchase_price`, `total_cost = line_amount`) لكن تريغر `BEFORE INSERT` — النسخة الفعّالة `inventory_movements_apply_invoice_line_cost()` (`database/setup_all.sql:12435-12544`) — **يستبدلها فوراً** بتكلفة الإخراج الفعلية لكل حركة `sale`:

```sql
-- database/setup_all.sql:12523-12540
if new.quantity_base_delta < 0
   and public.invoice_is_outbound_kind(v_kind) then
  v_unit_cost := public.calc_outbound_unit_cost(v_consumed_mode, v_settings, ...);
  new.unit_cost := v_unit_cost;
  new.total_cost := round((abs(new.quantity_base_delta) * v_unit_cost)::numeric, 2);
  return new;
end if;
```

بما أن `sales_amount` و`cogs_amount` كلاهما = `abs(quantity_base_delta) * unit_cost` من نفس الصف (أحدهما مقروء مباشرة من `total_cost` المخزَّن، والآخر مُعاد حسابه بنفس الصيغة من `unit_cost` المخزَّن) — **الرقمان متطابقان عملياً لكل حركة بيع** (فروق تقريب فقط، إن وُجدت). النتيجة: عمود «إيراد» المعروض بالواجهة (`web/src/app/reports/cogs/page.tsx:245` — `<SummaryCard label="مبيعات (إيراد)" value={totals.sales_amount.toFixed(2)} />`، وعنوان الجدول `إيراد` بالسطر 299) **يساوي تقريباً عمود COGS دائماً**، فيظهر «هامش ربح» شبه صفري دوماً بغض النظر عن سعر البيع الحقيقي.

الإيراد الفعلي (`line_amount` من `invoice_material_lines`، وهو ما يُقيَّد فعلياً بحساب المبيعات الدائن في `post_invoice()`) **غير مُستخدم إطلاقاً** بهذه الدالة — لا يوجد أي `join`/قراءة لسعر سطر الفاتورة، فقط لـ`invoices` (رقم/تاريخ) عبر `left join public.invoices i on im.source_type = 'invoice' and i.id = im.source_id` (`setup_all.sql:8093-8094`).

**الأثر:** أي محاسب يعتمد هذا التقرير لقراءة هامش الربح الإجمالي (مبيعات − تكلفة) سيحصل على رقم مضلِّل تماماً (هامش صفري وهمي)، رغم أن التسمية الصريحة بالواجهة «مبيعات (إيراد)» توحي بعكس ذلك تماماً.

## 2. تكلفة مرتجع المبيعات (`return_cogs_amount`) تُحسب بصيغة مختلفة تماماً عمّا يُرحَّل فعلياً للدفتر — الرقمان يفترقان بنيوياً 🔴

هذا هو الجواب المباشر على «هل يتطابق ما يعرضه التقرير مع ما رحّله `post_invoice()` فعلاً؟» — الجواب: **لا، لحركات `return_sale` تحديداً**، والفجوة معمارية وليست خطأ تقريب.

**ما يُرحَّل فعلياً بالقيد المحاسبي** (`post_invoice()`، حالة `'return_sale'`، النسخة الفعّالة `database/setup_all.sql:19681-19743`):

```sql
-- setup_all.sql:19706-19729
v_line_cost := public.calc_outbound_line_total_cost(
  v_pat.pricing_consumed_mode, v_inv_settings, v_row.purchase_price, v_row.unit_price,
  v_row.factor_to_base, v_row.quantity_base, v_row.material_id, v_row.warehouse_id, ...
);
perform public._invoice_add_journal_line(v_je_id, v_inventory, v_line_cost, 0, 'مخزون — مرتجع', ...);
perform public._invoice_add_journal_line(v_je_id, v_cost, 0, v_line_cost, 'تكلفة — مرتجع', ...);
```

القيد يعكس تكلفة البيع الأصلية باستخدام **نفس صيغة تكلفة الإخراج** (`calc_outbound_line_total_cost` ← `calc_outbound_unit_cost`، مبنية على إعداد `pricing_consumed_mode` — متوسط مرجّح/سعر سطر/قياسي حسب النمط) — وهذا منطقي محاسبياً: مرتجع المبيعات يجب أن يعكس **نفس التكلفة** التي احتُسبت وقت البيع الأصلي.

**لكن ما يُخزَّن فعلياً بصف `inventory_movements`** (الذي يقرأ منه `get_cogs_report.return_cogs_amount`) يُحسب بمسار مختلف تماماً. سطر الإدراج بـ`post_invoice()` (`setup_all.sql:19732-19742`) يمرّر قيماً مبدئية (`unit_cost = purchase_price`, `total_cost = line_amount`)، لكن التريغر `inventory_movements_apply_invoice_line_cost()` يصنّف `return_sale` ضمن **الحركات الإدخالية** (`invoice_is_inbound_kind`، `setup_all.sql:12190-12196`: `'purchase', 'opening_stock', 'return_sale', 'transfer_in'`) — فيُطبَّق فرع الإدخال بدل الإخراج:

```sql
-- setup_all.sql:12505-12520
if new.quantity_base_delta > 0 and public.invoice_is_inbound_kind(v_kind) then
  v_inbound_amount := public.calc_inbound_inventory_amount(
    v_cost_mode, v_affect, v_line_amount, v_line_gross, v_line_disc
  );
  new.total_cost := v_inbound_amount;
  ...
```

`calc_inbound_inventory_amount` (`setup_all.sql:12218-...`، مطابقة لـ`patch_invoice_pricing_cost.sql:41-63`) تحسب المبلغ من **سعر/مبلغ سطر فاتورة المرتجع نفسه** (`line_amount`/`line_gross`/`line_disc`) حسب إعداد مختلف تماماً (`pricing_cost_mode` — إعداد التسعير الإدخالي، المستخدم أصلاً للمشتريات وبضاعة أول المدة) — **وليس** بإعداد `pricing_consumed_mode` ولا صيغة `calc_outbound_unit_cost` التي استخدمها القيد المحاسبي قبل أسطر قليلة لنفس السطر.

**خلاصة الفجوة:** لسطر مرتجع مبيعات واحد، يُحسَب رقمان مستقلان من دالتين مختلفتين تماماً وإعدادين مختلفين (`pricing_consumed_mode` للقيد المحاسبي مقابل `pricing_cost_mode` لصف `inventory_movements`) — لا ضمان تطابقهما إطلاقاً إلا بالصدفة (مثلاً إن تساوى سعر سطر المرتجع مع متوسط التكلفة وقت البيع الأصلي، وهو أمر غير متوقع عملياً لأن سعر البيع يتضمّن هامش ربح). **`return_cogs_amount` بتقرير COGS لا يعكس التكلفة الحقيقية المُرحَّلة فعلياً بحساب «تكلفة — مرتجع» بدفتر الأستاذ.**

**تنبيه إضافي (خارج نطاق هذا التقرير لكن يفاقم الأثر):** بما أن `get_scoped_inventory_unit_cost` (المستخدمة لحساب المتوسط المرجّح لكل عمليات البيع اللاحقة) تجمع `quantity_base_delta * unit_cost` عبر **كل** حركات `inventory_movements` بما فيها `return_sale`، فإن هذا الـ`unit_cost` الخاطئ (المبني على سعر البيع لا التكلفة) يتسرّب فعلياً إلى حساب متوسط التكلفة لكل عمليات البيع التالية لأي مرتجع — وليس فقط لرقم هذا التقرير.

## 2.1 حركات `sale` العادية — لا فجوة مماثلة (تحقّق سلبي)

للتأكد أن الخلل مقصور على `return_sale`: حركات `sale` تُصنَّف ضمن `invoice_is_outbound_kind` (`setup_all.sql:12198-12203`)، وفرع الإخراج بالتريغر (`setup_all.sql:12523-12540`) يستخدم `calc_outbound_unit_cost(v_consumed_mode, ...)` حيث `v_consumed_mode ← ip.pricing_consumed_mode` — **نفس** الدالة ونفس الإعداد المستخدمين بالقيد المحاسبي (`setup_all.sql:19356` وما شابه، ومثيلها بحالة `'sale'`). فـ`cogs_amount` (من حركات `sale`) يطابق فعلياً ما رُحِّل بحساب «تكلفة مبيعات». المشكلة الحقيقية محصورة بـ§1 (تسمية `sales_amount`) و§2 (`return_cogs_amount`)، وليست بعمود `cogs_amount` نفسه للمبيعات العادية.

## 3. لا إشارة صريحة لـFIFO بالتقرير — لكن لا إفصاح عن طريقة التكلفة الفعلية المستخدمة أصلاً 🟡

بحث شامل في `web/src/app/reports/cogs/**` عن أي ذكر لـ"FIFO"/"fifo"/"متوسط" لم يُظهر أي نتيجة — **التقرير لا يدّعي صراحة استخدام FIFO في أي نص أو تلميح UI**، فلا توجد «فجوة ثقة» نصية مباشرة كما في إعدادات المخزون (تقرير المواد/المستودعات وثّقها سابقاً هناك).

لكن بالمقابل: **التقرير لا يُفصح إطلاقاً عن أي طريقة تكلفة استُخدمت لحساب `cogs_amount`** — لا عمود، لا تلميح، لا إشارة لإعداد `pricing_consumed_mode` الفعلي بالنمط المستخدم. بما أن هذا الإعداد يختلف بين أنماط الفواتير (`line_price` / `standard` / متوسط مرجّح افتراضياً)، وقد يكون خيار `fifo` بإعدادات الشركة (`company_inventory_settings.costing_method`) مفعّلاً وهو زخرفي بالكامل (موثّق بتدقيق المواد/المستودعات) — محاسب ينظر لهذا التقرير لا وسيلة أمامه لمعرفة أي صيغة أنتجت هذه الأرقام تحديداً.

## 4. صلاحيات RPC — لا فحص صلاحية ولا تقييد فرع داخل الدالة، ولا `GRANT` صريح 🟠

`get_cogs_report` (`setup_all.sql:8045-8073`): `language sql stable security definer set search_path = public` — **بلا أي استدعاء `has_permission()`/`is_admin()` داخلها**، و`p_branch_id` مجرد فلتر اختياري (`null` افتراضياً = كل الفروع). بحث شامل في `setup_all.sql` عن `grant execute on function public.get_cogs_report` لم يُظهر أي نتيجة — أي لا يوجد سحب/منح صلاحية صريح لهذه الدالة تحديداً. السطر الوحيد ذو الصلة هو الإصلاح الأمني العام:

```sql
-- setup_all.sql:13803
revoke execute on all functions in schema public from anon;
```

هذا يمنع `anon` فقط. بما أن PostgreSQL يمنح `EXECUTE` على الدوال الجديدة لـ`PUBLIC` افتراضياً (ويرثه دور `authenticated`) ولا يوجد `revoke`/`grant` مقيِّد لاحق لهذه الدالة تحديداً — **أي مستخدم مسجّل دخول (بصرف النظر عن صلاحياته الفعلية بجدول الصلاحيات) يستطيع استدعاء `get_cogs_report` مباشرة عبر RPC ويرى بيانات تكلفة/هامش لكل الفروع** إن ترك `p_branch_id` فارغاً — نفس نمط الثغرة (`using(true)` بلا فحص صلاحية) الموثّق بمعظم وحدات النظام الأخرى بهذه الجلسة، يمتد هنا لدالة تقرير مالي حسّاس (تكلفة/هامش) عبر SECURITY DEFINER تتجاوز RLS الجدول الأساسي أصلاً (فحتى لو أُضيفت لاحقاً سياسات RLS بالفرع لجدول `inventory_movements` كما أوصى تدقيق المواد/المستودعات، **هذه الدالة تبقى غير محمية لأنها SECURITY DEFINER** ولا تفحص الفرع/الصلاحية بنفسها).

## 5. لا ترقيم صفحات (Pagination) — مسح كامل للجدول عند كل تحميل 🟡

`get_cogs_report` بلا `LIMIT`/`OFFSET`، والواجهة (`cogs-report-api.ts:69-87`) تجلب كل الصفوف المطابقة دفعة واحدة بلا أي تقسيم. مع فلترة `movement_kind in ('sale', 'return_sale')` فقط (`setup_all.sql:8095`) الحجم أصغر من تقرير الرصيد الكامل، لكن بلا فهرس على `movement_kind` أو `movement_date` وحدهما (الفهارس الوحيدة على `inventory_movements` هي `(material_id, warehouse_id, movement_date)` و`(source_type, source_id)` — `setup_all.sql:4293-4296`)، فأي استعلام بفترة تاريخ فقط (بلا مادة/مستودع محدد) يبقى مسحاً شبه كامل للجدول.

## 6. حقول `warehouse_code`/`branch_code` تُحسب لكنها ميتة بالواجهة 🔵

عند `groupBy='material'`، تُحسب `warehouse_code`/`branch_code` بـ`max()` تعسفي (`setup_all.sql:8133-8139`) — قيمة غير موثوقة إن كانت المادة مباعة من أكثر من مستودع/فرع بلا فلتر. لكن فحص `CogsTable` (`web/src/app/reports/cogs/page.tsx:282-357`) وتصدير CSV (`csvRows`, أسطر 102-116) يؤكدان أن هذين الحقلين **لا يُعرضان في أي مكان بالواجهة** — بيانات محسوبة وغير مستخدمة، وإن استُخدمت مستقبلاً ستكون مضلِّلة بحالة التعدد. تنظيف بسيط أو توثيق أن الحقل تعسفي عند التعدد.

## 7. خطأ نصي «per» بالإنجليزية داخل جملة عربية 🟡

`web/src/app/reports/cogs/page.tsx:183-184`:
```tsx
<option value="material">per مادة</option>
<option value="invoice">per فاتورة</option>
```
نفس النمط المُصلَح سابقاً بتقرير حدود المخزون بالمستودع (`audit-reports/2026-07-25-warehouse-limits-audit.md` §1: «حدود المخزون **لكل** مستودع»). الأصح هنا: «تجميع حسب مادة» / «تجميع حسب فاتورة»، أو حتى الأبسط «مادة»/«فاتورة» فقط بما أن التسمية «التجميع» موجودة أصلاً بالتسمية (`<span>التجميع</span>`).

## 8. رسالة الخطأ عند غياب RPC صحيحة 🟢

`cogs-report-api.ts:80-84`: رسالة «شغّل `patch_inventory_phase4.sql`» صحيحة فعلاً — `get_cogs_report` معرَّفة حصراً هناك (`setup_all.sql` قسم `BEGIN patch_inventory_phase4.sql` يبدأ سطر 8035، والدالة سطر 8045) ولا تُعاد تعريفها لاحقاً بأي patch آخر. لا إجراء مطلوب — ذُكر للمقارنة مع §الرسائل المضلِّلة بتقريري رصيد/حركات المخزون.

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **أعد بناء `sales_amount`/«الإيراد» من مصدر إيراد حقيقي** (§1) — اجمع من `invoice_material_lines.line_amount` (أو من قيود دفتر الأستاذ لحساب المبيعات) لحركات `sale`، بدل قراءتها من `inventory_movements.total_cost` الذي هو تكلفة دوماً. بديل أسرع للتنفيذ: أعد تسمية العمود صراحة إلى ما يعكس حقيقته الحالية (مثلاً احذفه إن كان مكرراً لـ`cogs_amount`) لحين إصلاح مصدر البيانات — لا تترك تسمية «إيراد» تشير لبيانات تكلفة.

2. **وحِّد صيغة تكلفة `return_sale`** (§2) — إما: (أ) عدّل `inventory_movements_apply_invoice_line_cost()` بحيث يُعامل `return_sale` بصيغة إخراج عكسية (`calc_outbound_unit_cost` بنفس `pricing_consumed_mode`) بدل `calc_inbound_inventory_amount`، بما يطابق فعلياً ما يُرحَّل بالقيد المحاسبي، أو (ب) إن كان الفصل مقصوداً لسبب محاسبي معيّن، وثّقه صراحة وعدّل `get_cogs_report.return_cogs_amount` ليُحسب بنفس صيغة القيد الفعلي (`calc_outbound_line_total_cost`) بدل قراءة `unit_cost`/`total_cost` المخزَّن على الحركة. أولوية قصوى لأن هذا يلوّث أيضاً متوسط التكلفة المرجّح لكل عمليات البيع اللاحقة عبر `get_scoped_inventory_unit_cost`.

### 🟠 عالٍ

3. **أضف فحص صلاحية/فرع داخل `get_cogs_report`** (§4) — استدعِ `has_permission('reports.cogs.view')` أو ما يعادلها، وفكّر بفرض `p_branch_id` (أو تقييده تلقائياً بفرع المستخدم) بدل تركه اختيارياً بالكامل — بيانات هامش/تكلفة حسّاسة تُعرض حالياً لأي مستخدم مسجّل دخول عبر كل الفروع.

### 🟡 متوسط

4. **أفصح عن طريقة التكلفة الفعلية المستخدمة بالتقرير** (§3) — أضف تلميحاً/عموداً يعرض `pricing_consumed_mode` الفعلي للنمط، بدل ترك المستخدم بلا أي مؤشر لأي صيغة أنتجت الأرقام.
5. **أضف ترقيم صفحات أو حد أقصى + فهرس على `movement_date`** (§5) لتحسين الأداء مع نمو حجم البيانات.
6. **صحّح «per» بالإنجليزية** (§7) إلى نص عربي، بنفس أسلوب الإصلاح السابق بتقرير حدود المخزون.

### 🔵 تحسين

7. **احذف أو وثّق حقلي `warehouse_code`/`branch_code` غير المستخدمين** بواجهة `groupBy='material'` (§6).

## ملحق

- `web/src/app/reports/cogs/page.tsx`
- `web/src/modules/reports/services/cogs-report-api.ts`
- `database/setup_all.sql:8045-8194` — `get_cogs_report` (من `patch_inventory_phase4.sql`).
- `database/setup_all.sql:12435-12544` — `inventory_movements_apply_invoice_line_cost()` (النسخة الفعّالة، من `patch_invoice_pricing_cost.sql`).
- `database/setup_all.sql:12190-12203` — `invoice_is_inbound_kind`/`invoice_is_outbound_kind`.
- `database/setup_all.sql:12218-...` — `calc_inbound_inventory_amount`.
- `database/setup_all.sql:19681-19743` — حالة `'return_sale'` بـ`post_invoice()` (النسخة الفعّالة).
- `audit-reports/2026-07-22-materials-warehouses-audit.md` §2 — خلفية فجوة FIFO الزخرفية (لم تُعَد هنا).
- `audit-reports/2026-07-25-warehouse-limits-audit.md` §1 — سابقة إصلاح خطأ «per».
