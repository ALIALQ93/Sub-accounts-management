# تدقيق دقيق — قسم المواد والمستودعات وعلاقاتهما

> **حالة المعالجة (مستودع الكود، 2026-07-23):** #1–4 و#6–7 ✓ · #5 تنبيه مناقلات عالقة ✓ · #8 توثيق/مشاركة صيغة الوحدات ✓ · #9 رفض سطر فاتورة بلا وحدة أساس (#45) ✓ · #12 قائمة تحقق الحركات ✓ · #10 RLS بالفرع و#11 رصيد مُخزَّن معلّقان (معماريان).

منهجية: قراءة الكود الفعلي (SQL + TypeScript) وتتبّع ترتيب تطبيق الـpatches الحقيقي عبر `database/build_setup_all.ps1`، لأن دوال حرجة (`post_invoice`, `inventory_movements_enforce_stock`, منطق الوحدات) أُعيد تعريفها أكثر من مرة عبر عدة ملفات patch.

## 1. خريطة البنية الفعلية

جدول `01_schema.sql` **لا يحتوي أي جدول متعلق بالمواد/المستودعات/المخزون** — كل شيء أُضيف عبر سلسلة patches، أهمها بترتيب التطبيق:

`patch_branches.sql → patch_materials_minimal.sql → patch_company_inventory.sql → patch_invoices.sql → patch_invoice_reservation_discount.sql → patch_invoice_discount_rounding.sql → patch_inventory_reports.sql → patch_inventory_phase2..7 → patch_materials_item_card.sql → patch_materials_tracking.sql → patch_invoice_line_adjustments.sql → patch_outbound_stock_check.sql → patch_outbound_lot_stock.sql → patch_inventory_cost_dimensions.sql → patch_invoice_pricing_cost.sql → patch_create_material_with_base_unit.sql → patch_materials_card_v2.sql`

النسخة **الفعّالة** من كل دالة مشتركة هي آخر ملف يعيد تعريفها بـ`create or replace` — وليست أول نتيجة بحث نصي.

### الجداول الأساسية

| الجدول | أهم الأعمدة | الملف/السطر |
|---|---|---|
| `materials` | `material_code`, `name_ar`, `category_id`, `purchase_price`, `sale_price`, `inventory_account_id`, `material_kind` (`normal`/`composite`)، لاحقاً `min_stock`/`max_stock`، `has_expiry_date`/`has_serial_number` | `patch_materials_minimal.sql:68-88` + `patch_materials_item_card.sql:7-15` + `patch_materials_tracking.sql:7-15` + `patch_materials_card_v2.sql:172-183` |
| `material_units` | لكل مادة وحداتها الخاصة (لا جدول وحدات عام أصلاً)، `is_base_unit`, `factor_to_base numeric check(>0)`, فهرس جزئي يضمن وحدة أساس واحدة فقط لكل مادة | `patch_materials_minimal.sql:94-124` |
| `units` (كتالوج عام) | أُضيف لاحقاً ويناقض تعليق التصميم الأصلي "لا جدول وحدات مشترك" | `patch_materials_card_v2.sql:16-64` |
| `warehouses` | `warehouse_code`, `branch_id not null references branches` (كل مستودع ينتمي لفرع واحد فقط) | `patch_materials_minimal.sql:41-62` |
| `warehouse_material_limits` | حد أدنى مخزون لكل (مستودع، مادة) | `patch_inventory_phase5.sql:11-42` |
| `inventory_movements` | دفتر الحركة الوحيد: `quantity_delta/quantity_base_delta`, `unit_cost/total_cost`, `movement_kind` (sale/purchase/transfer_in/transfer_out/return_sale/return_purchase/opening_stock/adjustment), `source_type/source_id/source_line_id`, `journal_line_id` | `patch_invoices.sql:331-357` |
| `inventory_transfers` / `inventory_transfer_lines` | تحويل بين فرعين/مستودعين، `status` (draft→dispatched→in_transit→partially_received→received/cancelled) | `patch_invoices.sql:133-156, 309-326` |
| `inventory_reservations` | حجز على مستوى سطر الفاتورة، `status` (active/released/fulfilled) | `patch_invoice_discount_rounding.sql:79-104` |
| `company_inventory_settings` | صف وحيد (`id=1`)، `inventory_method` (periodic/perpetual)، `costing_method` (weighted_avg/fifo/standard/last_purchase)، `foundation_locked` | `patch_company_inventory.sql:12-38` + `patch_inventory_cost_dimensions.sql:8-16` |

**نقطة جوهرية:** لا يوجد أي عمود/جدول "رصيد مُخزَّن" في كامل النظام (تحقق بحث شامل عن `materialized|current_stock|current_balance|stock_balance` — لا نتائج). **كل رصيد وكل تكلفة يُحسبان لحظياً** بـ`SUM` على `inventory_movements` عند كل استعلام.

## 2. نموذج التكلفة — فجوة بين الإعداد المعروض والتنفيذ الفعلي

- `company_inventory_settings.costing_method` يعرض 4 خيارات بالواجهة: `weighted_avg`, `fifo`, `standard`, `last_purchase`.
- لكن الدالة الفعلية لحساب تكلفة الإخراج `calc_outbound_unit_cost` (`patch_invoice_pricing_cost.sql:130-185`) **لا تقرأ `costing_method` من إعدادات الشركة إطلاقاً** — بحث شامل يؤكد أن هذا العمود لا يُستخدم خارج جدول الإعدادات نفسه وقفل `foundation_locked`. القرار الفعلي يُتحكم به عبر `pricing_consumed_mode` على **نمط الفاتورة** (pattern)، وله فرعان حقيقيان فقط: `line_price` (سعر سطر الفاتورة نفسه) أو `standard` (`materials.purchase_price`)، وأي شيء آخر يذهب لـ`get_scoped_inventory_unit_cost` وهي **متوسط مرجّح دائماً**، بغض النظر عمّا اختاره المستخدم في `costing_method`.
- **لا يوجد أي تطبيق فعلي لـFIFO في كامل الكود.** خيار `fifo` بإعدادات الشركة زخرفي بالكامل — قابل للاختيار لكن بلا أي أثر.
- ما يُسمى "تتبّع الدفعات/lots" (`get_inventory_lot_balance`, `patch_outbound_lot_stock.sql`) هو فقط **بُعد إضافي للتصفية** (تاريخ صلاحية/رقم تسلسلي كمفتاح `GROUP BY` إضافي) للتحقق من كفاية الرصيد — **ليس** طابور استهلاك FIFO يختار دفعة محددة. تكلفة الإخراج تبقى متوسطاً مرجحاً (بمستوى المادة+المستودع، أو +الدفعة إن فُعِّل ذلك البُعد) وليست "استهلك الأقدم أولاً".

## 3. قيد التزامن (Race Condition) — لا يزال قائماً فعلياً

`inventory_movements_enforce_stock()` — النسخة الفعّالة الأخيرة في **`database/patch_outbound_lot_stock.sql:84-168`**:

- تريغر `BEFORE INSERT`، يعمل فقط عندما `quantity_base_delta < 0` وضمن أنواع `sale/transfer_out/return_purchase`.
- يحسب `v_balance := get_material_warehouse_qty_balance(...)` (مجرد `SUM`) ويرفض إن كانت `v_balance + new.quantity_base_delta < -0.000001`.
- **لا يوجد `SELECT ... FOR UPDATE`، ولا `pg_advisory_xact_lock`، ولا أي قفل صف على `materials`/`warehouses`، ولا قيد فريد يمنع تجاوز البيع.** `post_invoice()` يأخذ `FOR UPDATE` فقط على **صف الفاتورة نفسها** (`patch_invoice_pricing_cost.sql:425`) — هذا لا يُسلسل بين فاتورتين مختلفتين تلمسان نفس (المادة، المستودع).
- تحت `READ COMMITTED` (المستوى الافتراضي، ولا شيء بالكود يفرض مستوى أعلى عند الترحيل): فاتورتان متزامنتان تبيعان آخر وحدة من نفس المادة/المستودع قد تقرآن نفس الرصيد وتمرّان كلتاهما من الفحص. **هذه فجوة حقيقية ومؤكدة**، مطابقة تقريباً لما ورد بتدقيق سابق (`AUDIT_INVENTORY.md`)، مع تغيّر بسيط في رقم السطر لأن النسخة الفعّالة الآن هي نسخة "الدفعات" وليست نسخة المرحلة الأولى.

## 4. اكتشاف جديد: فحص الدفعة (lot) معطّل فعلياً لمسار الفواتير (كود ميت)

ترتيب تنفيذ عدة تريغرز `BEFORE INSERT` على نفس الجدول في Postgres **أبجدي حسب اسم التريغر**. التريغرز المسجّلة على `inventory_movements`:

1. `trg_inventory_movements_00_explode_composite`
2. `trg_inventory_movements_apply_invoice_line_cost`
3. `trg_inventory_movements_enforce_stock` ← يفحص رصيد الدفعة هنا
4. `trg_inventory_movements_fill_tracking` ← هنا يُنسخ `expiry_date`/`serial_number` من سطر الفاتورة

أبجدياً، `enforce_stock` ("e") يعمل **قبل** `fill_tracking` ("f"). وكل عمليات `INSERT INTO inventory_movements` داخل `post_invoice()` (تحققتُ من 7 مواضع إدراج: بيع، شراء، تحويل صادر/وارد، مرتجع بيع/شراء) **لا تُدرج** `expiry_date`/`serial_number` ضمن الأعمدة المذكورة صراحة — فتصل هذه القيم كـ`NULL` عند تنفيذ `enforce_stock`.

النتيجة: الشرط `if (v_has_expiry and new.expiry_date is not null) or (v_has_serial and v_serial is not null)` في `patch_outbound_lot_stock.sql:144-164` **يكون دائماً كاذباً لكل الحركات القادمة من الفواتير** — فحص عدم بيع أكثر من رصيد دفعة معينة (صلاحية/رقم تسلسلي) **لا يعمل إطلاقاً** بمسار الترحيل الأساسي، رغم أن فحص الرصيد الإجمالي (مادة+مستودع) يعمل بشكل صحيح. هذا خلل صامت — لا خطأ يظهر، فقط حماية غير فعّالة كان يُفترض أنها تعمل.

## 5. التحويل بين المستودعين — ليس عملية ذرية واحدة

- التحويل يُنفَّذ كـ**فاتورتين منفصلتين تماماً** (`transfer_out` و`transfer_in`)، كل منهما تُرحَّل عبر `post_invoice()` بشكل مستقل. الصادر يدين حساب "بضاعة بالطريق" ويُدائن مخزون المصدر؛ الوارد يدين مخزون الوجهة ويُدائن "بضاعة بالطريق" (`patch_invoice_pricing_cost.sql:799-946`).
- **لا معاملة واحدة تضمن اتساق الطرفين** — الحالة (`draft/dispatched/in_transit/partially_received/received/cancelled`) لا تفرض أن الطرف الوارد سيُرحَّل يوماً ما؛ تحويل يمكن أن يبقى `dispatched` إلى الأبد وبضاعة "بالطريق" دفترياً بلا نهاية.
- الاستلام الجزئي مدعوم (تناسب التكلفة حسب `qty_received/quantity_base`)، لكنه يعزز نفس الاعتماد على "شخص سيكمل الطرف الثاني يدوياً" بلا ضمان آلي أو تنبيه/جدولة.

## 6. آلية الحجز (`inventory_reservations`) — واجهة بلا أثر فعلي

- الأعمدة `reservation_enabled`, `reserve_on_save`, `release_on_cancel`, `reservation_days` موجودة على `invoice_patterns` (`patch_invoice_reservation_discount.sql:12-34`) وقابلة للتعديل من نموذج النمط بالواجهة.
- `sync_invoice_reservations()` تُنشئ/تحدّث حجوزات فقط أثناء `status='draft'` وعندما يكون النمط مفعّلاً لذلك بالكامل.
- `release_invoice_reservations(p_status='fulfilled')` تُستدعى فقط من `postInvoice()` بالواجهة عند الترحيل.
- **`release_on_cancel` مُعرَّف ومحفوظ لكن لا تقرأه أي دالة SQL إطلاقاً** (بحث شامل يؤكد ذلك). والأهم: **لا يوجد أي مسار إلغاء فاتورة (`cancel`) في كامل النظام** — رغم أن `invoices.status` يقبل القيمة `'cancelled'` بقيد التحقق، لا شيء بالواجهة أو بقاعدة البيانات يُحوّل فاتورة إلى هذه الحالة. الإعداد بلا أي مسار تنفيذ يستهلكه.
- **جدول `inventory_reservations` نفسه "اكتب فقط"**: لا يوجد أي استخدام له بالواجهة (بحث شامل في `web/src` صفر نتائج) — لا عرض "كمية محجوزة" في أي شاشة، ولا فحص أي دالة رصيد له. عملياً: الحجز **لا يمنع** فاتورة مسودة ثانية متزامنة من "حجز" نفس الكمية أو حتى بيعها فعلياً — الحماية الوحيدة الحقيقية من البيع الزائد تبقى فحص §3 وقت الترحيل (وهو نفسه غير محمي من السباق).

## 7. RLS — سياسات مفتوحة بالكامل تقريباً

كل الجداول المذكورة أعلاه تستخدم `for select/insert/update to authenticated using (true)` بلا أي تمييز حسب الفرع أو الصلاحية، باستثناءات ضيقة:
- `company_inventory_settings` (تعديل) يتطلب `is_admin() or has_permission('settings.company.edit')`.
- `patch_revoke_anon_table_access.sql` أزال دور `anon` من كل السياسات (إصلاح أمني سابق) لكن **لم يضف أي تمييز على مستوى الفرع** لدور `authenticated`.
- **لا سياسة DELETE إطلاقاً** لـ`materials`, `warehouses`, `material_units`, `material_categories`, `invoices`, `inventory_movements` — عملياً الحذف ممكن فقط عبر دالة `security definer` أو مفتاح الخدمة، وليس عبر أي استدعاء عادي من الواجهة.
- **عدم اتساق دفتري صامت محتمل**: `invoices_before_update_guard` و`invoice_lines_prevent_change_when_posted` يسمحان للمدير (`is_admin()`) بتعديل سطر فاتورة **مُرحّلة** — لكن لا شيء يُحدّث تعويضياً `inventory_movements` أو القيد المحاسبي المُنشأ مسبقاً عند هذا التعديل. تعديل مدير على فاتورة مرحّلة يُباعد بصمت بين سطر الفاتورة والدفتر الفعلي.

## 8. تعدد طبقات تحويل الوحدات

تحويل الكمية↔الوحدة الأساس يحدث في **ثلاث طبقات مستقلة**:
1. قاعدة البيانات: `material_quantity_to_base()` + تريغر `invoice_material_lines_apply_quantities` (المرجعية الفعلية، تُعيد الحساب دائماً عند كل إدراج/تعديل).
2. `factor_to_base` نفسه أصبح **مُشتقاً** عبر تريغر `material_units_sync_conversion` (`patch_materials_card_v2.sql:110-149`) من حقلين مُدخلين (`conversion_op`/`conversion_factor`) بدل إدخاله مباشرة — طبقة حسابية إضافية فوق العمود الأصلي.
3. الواجهة: `mapMaterialUnit()` بـ`material-api.ts:73-94` تُعيد بناء `conversion_op`/`conversion_factor` بشكل مستقل للعرض، بمنطق احتياطي منفصل تماماً عن SQL.

التريغر بقاعدة البيانات هو المرجع النهائي فعلياً (يُعاد حسابه دائماً قبل الحفظ)، لكن أي معاينة/إجمالي يُحسب بالواجهة قبل الحفظ (JS) يعتمد على منطق مكتوب يدوياً بشكل منفصل تماماً عن SQL — بلا أي كود أو مصدر مشترك بين الطرفين، فاحتمال انحراف بصري (المعاينة تختلف عن القيمة الفعلية بعد الحفظ) قائم بنيوياً كلما عُدِّلت إحدى الصيغتين دون الأخرى.

## 9. مشاكل موثّقة سابقاً — حالتها الآن

- **مادة بلا وحدة أساس**: كانت المشكلة الأخطر بالتدقيق السابق. الآن **مُعالجة إلى حد كبير**: `patch_create_material_with_base_unit.sql:8-126` يوفّر RPC ذرّية `create_material_with_base_unit()` تُنشئ المادة ووحدة الأساس معاً بدالة PL/pgSQL واحدة (معاملة واحدة ضمنياً). الواجهة (`material-api.ts:555-608`) تستدعيها أولاً، وتتراجع للطريقة القديمة (إدراج المادة ثم الوحدة) فقط عند قاعدة بيانات قديمة لا تحتوي هذه الدالة — وفي هذا المسار الاحتياطي فقط، تحذف المادة تعويضياً إن فشل إدراج الوحدة (وليس معاملة DB حقيقية، لكنها معالجة أفضل من الفراغ السابق). **يبقى ثغرة نظرية**: التريغر `materials_require_base_unit()` موجود لكن **متعمَّد عدم ربطه بأي تريغر فعلي** (تعليق صريح بالكود: "لا نمنع إنشاء مادة قبل إضافة وحداتها") — أي إدراج مباشر لصف `materials` (SQL مباشر أو مفتاح خدمة) يتجاوز الـRPC يبقى ممكناً بلا وحدة.
- **فحص الرصيد بلا قفل تزامن**: لا يزال قائماً تماماً كما وُثّق سابقاً (انظر §3).

## 10. اكتشاف إضافي: تغيير فرع المستودع محمي بالتطبيق فقط

`updateWarehouse()` بـ`web/src/modules/materials/services/warehouse-api.ts:74-126` يمنع تغيير `branch_id` لمستودع له حركات مخزون مسبقة — لكن الفحص عبارة عن `SELECT count(...)` بالواجهة **قبل** الـ`UPDATE`، وليس قيد/تريغر بقاعدة البيانات. قابل للتجاوز عبر SQL مباشر/مفتاح خدمة، أو نظرياً عبر سباق بين الفحص والتحديث.

## 11. الخلاصة المعمارية

النموذج الحسابي (متوسط مرجّح لحظي فوق دفتر حركة واحد، بلا رصيد مُخزَّن) بسيط وسليم من حيث الصحة المحاسبية للحالة أحادية المستخدم، لكنه:
- **غير محمي من التزامن** عند البيع المتزامن (§3، الخلل الأخطر تشغيلياً).
- يعرض **ميزات غير مُنفَّذة فعلياً** بالإعدادات (FIFO، الحجز الفعلي لمنع البيع الزائد، `release_on_cancel`) — فجوة ثقة بين ما يراه المستخدم بالإعدادات وما يحدث فعلياً.
- يحتوي **كوداً ميتاً صامتاً** (فحص الدفعة بـ§4) بسبب ترتيب تريغرز غير مقصود، وهو أخطر أنواع الأخطاء لأنه لا يُنتج أي رسالة أو فشل ظاهر.
- التحويل بين المستودعين تصميم "فاتورتان منفصلتان" عملي ومرن (يدعم استلام جزئي) لكنه يفتقر ضمانة اكتمال الطرف الثاني.

---

## توصيات التطوير (مرتّبة حسب الأولوية)

### 🔴 حرج

1. **قفل تزامن حقيقي عند فحص/خصم الرصيد** — طبّق نفس النمط المستخدم فعلاً لسقف تخصيص السندات (قفل صف أو `pg_advisory_xact_lock` على مفتاح `(material_id, warehouse_id)`) داخل `inventory_movements_enforce_stock`، أو الأبسط: أضف `SELECT ... FOR UPDATE` على صف رصيد وسيط، أو حوّل الفحص لقيد `CHECK` عبر عمود رصيد مُدار بتريغر متزامن (انظر التوصية #2 التي تحل هذا بنيوياً). بدون هذا، أي بيئة بها أكثر من مستخدم/جلسة متزامنة معرّضة فعلياً للبيع الزائد.

2. **إصلاح ترتيب تريغرز `inventory_movements`** — أعد تسمية `trg_inventory_movements_fill_tracking` بحيث يسبق `trg_inventory_movements_enforce_stock` أبجدياً (مثلاً `trg_inventory_movements_10_fill_tracking` و`trg_inventory_movements_20_enforce_stock`)، أو ادمج النسخ من `invoice_material_lines` مباشرة داخل استعلامات `INSERT` بـ`post_invoice()` بدل الاعتماد على تريغر لاحق. هذا خلل صامت يُبطل فحص حماية الدفعات (صلاحية/تسلسلي) بالكامل لمسار الفواتير — يستحق أولوية قصوى رغم عدم ظهوره كخطأ صريح.

### 🟠 عالٍ

3. **إما تنفيذ FIFO فعلياً أو حذفه من الخيارات** — بما أن `costing_method='fifo'`/`last_purchase` زخرفيان بالكامل، اتبع نفس الحل المُطبَّق سابقاً على خيار FIFO بإعدادات المواد (تعطيل من واجهة الاختيار + رسالة تحذير) حتى يُنفَّذ فعلياً، بدل ترك المستخدم يظن أن النظام يحسب FIFO بينما هو متوسط مرجّح دائماً.

4. **جعل الحجز فعلياً مؤثراً على الرصيد المتاح، أو إزالته من الواجهة** — إما: (أ) اجعل دوال حساب الرصيد المتاح (`get_material_warehouse_qty_balance`, `get_inventory_balance`, وعرض الرصيد بنموذج الفاتورة) تطرح الحجوزات `active` من نفس (مادة، مستودع)، أو (ب) إن كان تعقيد ذلك غير مبرر حالياً، أخفِ خيارات الحجز من إعدادات النمط وأضف تنويهاً أنها غير فعّالة بعد — نفس أسلوب المشروع المُثبت مع FIFO. أضِف أيضاً مسار فعلي لإلغاء الفاتورة (`cancel_invoice`) يستهلك `release_on_cancel` فعلياً، أو احذف الإعداد إن لم يكن الإلغاء ضمن النطاق الحالي.

5. **ضمان اكتمال التحويل بين المستودعين** — أضف تقريراً/تنبيهاً لعرض التحويلات العالقة بحالة `dispatched`/`in_transit` لفترة تتجاوز حداً معيناً (مشابه لـ`inventory-shortage-alert.tsx` الموجود فعلاً لتنبيهات نقص المخزون)، وفكّر بقيد زمني أو صلاحية إجبارية لإكمال الطرف الثاني.

6. **تحويل فحص تغيير فرع المستودع إلى قيد/تريغر بقاعدة البيانات** بدل فحص تطبيقي فقط بـ`warehouse-api.ts:74-126` — يمنع التجاوز عبر SQL مباشر أو سباق بين الفحص والتحديث.

7. **معالجة تعديل فاتورة مُرحّلة من قبل المدير** — إما امنع تعديل سطور المواد لفاتورة مُرحّلة حتى للمدير (اجعله يتطلب مرتجع/تصحيح رسمي بدل تعديل مباشر)، أو أضف منطقاً تعويضياً يُنشئ حركة مخزون/قيد تصحيحي تلقائياً عند أي تعديل كهذا، بدل ترك الدفتر ينحرف بصمت عن سطر الفاتورة.

### 🟡 متوسط

8. **توحيد منطق تحويل الوحدات** بين SQL والواجهة — إما استخرج صيغة التحويل لدالة واحدة تُستدعى من الواجهة عبر RPC خفيف لكل معاينة حية (تكلفة شبكة إضافية لكنها مصدر حقيقة واحد)، أو وثّق بوضوح shape الصيغتين جنباً إلى جنب في كود الطرفين مع تعليق يشير للآخر، لتقليل خطر انحراف صامت بين "معاينة الفاتورة" والقيمة الفعلية بعد الحفظ.

9. **ربط `materials_require_base_unit()` فعلياً أو حذفه** — الدالة موجودة وغير مستخدمة عمداً؛ إما فعّلها كقيد تحقق دوري (فحص دفعي يرفض حفظ فاتورة لمادة بلا وحدات بدل الاعتماد فقط على مسار الإنشاء)، أو استخدم `list_material_ids_missing_base_unit()` الموجودة فعلاً كتقرير صيانة دوري بشاشة إدارية.

10. **إضافة سياسات RLS مبنية على الفرع** لجداول المخزون الحساسة (`inventory_movements`, `warehouses`, `materials`) بدل `using(true)` المطلق، خصوصاً إن كان الهدف مستقبلاً دعم شركات متعددة الفروع بصلاحيات مستخدمين محصورة بفرع معيّن — حالياً أي مستخدم مسجّل دخول يرى/يُدخل بيانات كل الفروع.

### 🔵 توصية معمارية (تحسين، ليست خطأ)

11. **النظر بجدية في عمود/جدول رصيد مُخزَّن (materialized balance) لكل (مادة، مستودع)** يُحدَّث بتريغر عند كل حركة، بدل `SUM` لحظي على كامل `inventory_movements` في كل استعلام. هذا يحل مشكلتين معاً: (أ) الأداء مع نمو حجم البيانات (`get_inventory_balance` بلا فلاتر يجمع كامل الجدول حالياً)، و(ب) يوفّر نقطة طبيعية لقفل الصف (`SELECT ... FOR UPDATE` على صف الرصيد) يحل مشكلة التزامن في §3 بأناقة بدل قفل استشاري منفصل.

12. **توثيق صريح لدلالة كل `movement_kind`** وتعدد استخدام `inventory_movements` كدفتر تدقيق + مصدر حساب رصيد + مصدر تقارير تكلفة في آن واحد — أي تغيير مستقبلي على شكل الصف (كإضافة `expiry_date`/`serial_number` كما حدث) يستوجب مراجعة كل نقاط الإدراج السبع بـ`post_invoice()` يدوياً؛ قائمة تحقق (checklist) موثّقة تقلل خطر تكرار خلل مشابه لـ§4.

## ملحق — ملفات مرجعية رئيسية

- `database/patch_materials_minimal.sql` — المواد، الوحدات، المستودعات (الأساس).
- `database/patch_invoices.sql` — `inventory_movements`, `inventory_transfers`, `invoice_material_lines`.
- `database/patch_invoice_pricing_cost.sql` — `post_invoice()` كاملة (النسخة الفعّالة)، `calc_outbound_unit_cost`, `get_scoped_inventory_unit_cost`.
- `database/patch_outbound_lot_stock.sql` — النسخة الفعّالة من `inventory_movements_enforce_stock` (فحص الرصيد + الدفعة).
- `database/patch_invoice_reservation_discount.sql` + `database/patch_invoice_discount_rounding.sql` — آلية الحجز `inventory_reservations`.
- `database/patch_materials_card_v2.sql` — كتالوج الوحدات العام، `material_kind` (composite/BOM)، تريغر تفجير المكوّنات.
- `database/patch_create_material_with_base_unit.sql` — RPC إنشاء المادة الذرّي.
- `database/patch_company_inventory.sql` + `database/patch_inventory_cost_dimensions.sql` — إعدادات التكلفة على مستوى الشركة.
- `web/src/modules/materials/services/{material-api,warehouse-api,unit-api,stock-adjustment-api,inventory-settings-api}.ts`
- `web/src/modules/invoices/components/invoice-form.tsx` — اختيار المستودع لكل سطر، عرض الرصيد الحي، خرائط الدفعات.
- `web/src/app/materials/{warehouses,warehouse-limits,settings,stock-adjustment}/` + `web/src/app/reports/{inventory-balance,inventory-movements,cogs}/`
