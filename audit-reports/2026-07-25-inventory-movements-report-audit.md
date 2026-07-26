# تدقيق دقيق — تقرير حركات المخزون (Inventory Movements)

منهجية: قراءة الكود الفعلي (SQL + TypeScript) مباشرة، واعتماد `database/setup_all.sql` كمرجع «الحقيقة المُصرَّفة» — النسخة الفعّالة من أي دالة هي آخر `create or replace` بترتيب تطبيق الـpatches الحقيقي (`database/build_setup_all.ps1`)، وليست أول نتيجة بحث نصي. تتبّعت `get_inventory_movements_summary`، قيد `movement_kind` النهائي على الجدول، و`MOVEMENT_KIND_LABELS`/`COMMERCIAL_KIND_LABELS` بالواجهة.

النطاق: `web/src/app/reports/inventory-movements/page.tsx` (الصفحة المخصصة الوحيدة لهذا المسار) و`database/setup_all.sql:8373-8425` (`get_inventory_movements_summary`، من `patch_inventory_phase5.sql`).

---

## 1. الصفحة ليست «دفتر حركة» — هي ملخص مُجمَّع فقط، بلا أي سطر حركة فردي وبلا أي drill-down 🔴

هذا هو الفرق الجوهري الذي يجب توضيحه أولاً: يوجد بالتطبيق **مساران منفصلان تماماً** لعرض حركات المخزون:

1. **`web/src/app/reports/inventory-movements/page.tsx`** (مسار هذا التدقيق) — يستدعي حصرياً `inventoryReportApi.listMovementSummary()` ← `get_inventory_movements_summary` (`inventory-movements/page.tsx:60-67`). هذه الدالة **مُجمَّعة** (`group by movement_kind, source_type, commercial_kind`، `setup_all.sql:8419`) — تُرجع صفاً واحداً لكل تركيبة (نوع حركة × نوع مصدر × نوع تجاري)، وليس صفاً لكل حركة فعلية. لا `movement_id`، لا `material_id`، لا `warehouse_id` بالنتيجة أصلاً (تحقق من `returns table` بـ`setup_all.sql:8380-8388`: `movement_kind, source_type, commercial_kind, movement_count, quantity_in_base, quantity_out_base, total_value` فقط).
2. **تبويب «دفتر حركة» داخل صفحة تقرير رصيد المخزون** (`web/src/app/reports/inventory-balance/page.tsx`، `viewMode="ledger"`) — هذا هو المسار الذي يعرض فعلاً سطراً لكل حركة فردية (`get_inventory_movement_ledger`) **مع** روابط drill-down فعلية لمستند المصدر (`inventory-balance/page.tsx:738-756`: رابط لـ`/journals/{id}` عند `source_type === 'stock_adjustment'`، ورابط لـ`/invoices/{id}` عند `source_type === 'invoice'`).

**الأثر:** صفحة «تقرير حركات المخزون» المخصصة — وهي الاسم الذي يتوقعه أي محاسب لمشاهدة سجل الحركات — **لا تعرض ولا حركة واحدة فعلية، ولا تحتوي أي رابط drill-down إطلاقاً**. لا يمكن من هذه الصفحة معرفة "أي فاتورة/تسوية أنتجت هذه الحركة" — فقط عدّاد إجمالي لكل تركيبة (نوع حركة، نوع مصدر). محاسب يريد تتبّع حركة معينة يجب أن يعرف مسبقاً أن عليه الذهاب لتبويب مختلف داخل تقرير آخر (رصيد المخزون ← دفتر حركة) — تسمية الصفحة والمسار (`/reports/inventory-movements`) لا توحي بهذا التقسيم إطلاقاً، ولا يوجد أي رابط/تنويه من صفحة الملخص لصفحة الدفتر التفصيلي.

## 2. تسميات `movement_kind`/`commercial_kind` ناقصة — 4 من 12 نوع حركة، ونوعان تجاريان كاملان بلا ترجمة عربية 🟠

القيد الفعلي النهائي على `inventory_movements.movement_kind` (آخر `alter table ... add constraint`، `setup_all.sql:18149-18156`، من `patch_composite_disassembly.sql`) يسمح بـ**12 قيمة**:

```sql
check (movement_kind in (
  'sale', 'purchase', 'transfer_out', 'transfer_in',
  'return_sale', 'return_purchase', 'opening_stock', 'adjustment',
  'manufacture_consume', 'manufacture_produce',
  'disassemble_consume', 'disassemble_produce'
));
```

لكن `MOVEMENT_KIND_LABELS` (`web/src/modules/reports/services/inventory-report-api.ts:72-81`) يحتوي **8 مفاتيح فقط** — يفتقد تماماً:
- `manufacture_consume` (استهلاك تصنيع — يُدرج فعلياً بـ`patch_invoice_manufacturing.sql:385` عبر نمط فاتورة حقيقي `commercial_kind='manufacturing'`)
- `manufacture_produce` (إنتاج تصنيع — `patch_invoice_manufacturing.sql:462`)
- `disassemble_consume` (استهلاك تفكيك — `patch_composite_disassembly.sql:859`)
- `disassemble_produce` (إنتاج تفكيك — `patch_composite_disassembly.sql:968`)

هذه ليست حالات نظرية: أنماط فواتير فعلية بأسماء عربية («تصنيع»، «تفكيك») تُنشئ هذه الحركات فعلياً (`patch_invoice_manufacturing.sql:485-503`, `patch_composite_disassembly.sql:989-1007`). أي منشأة تستخدم ميزتي التصنيع (BOM) أو التفكيك ستجد أسطراً بالتقرير تعرض النص الإنجليزي الخام حرفياً بدل ترجمة عربية، بسبب مسار fallback بالواجهة:

```ts
// inventory-movements/page.tsx:271, و inventory-balance/page.tsx:721 (دفتر حركة)، و analysis
{MOVEMENT_KIND_LABELS[row.movement_kind] ?? row.movement_kind}
```

نفس الفجوة على مستوى `COMMERCIAL_KIND_LABELS` (`inventory-report-api.ts:163-173`، 9 مفاتيح) — يفتقد `manufacturing` و`disassembly`، وهما `commercial_kind` فعليان لأنماط الفواتير المذكورة (`patch_invoice_manufacturing.sql:497-503`, `patch_composite_disassembly.sql:1001-1007`)، ويظهران بعمود «نوع الفاتورة/المصدر» بهذه الصفحة تحديداً (`inventory-movements/page.tsx:267-269`).

**النتيجة العملية على هذه الصفحة تحديداً:** أي منشأة تستخدم التصنيع/التفكيك سترى صفوفاً بعمودي «نوع الفاتورة/المصدر» و«نوع الحركة» تعرض `manufacturing`/`disassembly`/`manufacture_consume`/... بالإنجليزية الخام، في تطبيق عربي بالكامل.

## 3. بطاقة «إجمالي قيمة» تجمع قيماً غير متجانسة محاسبياً بلا معنى واضح 🟡

`totals` بالواجهة (`inventory-movements/page.tsx:87-104`) تجمع `row.total_value` عبر **كل** الصفوف بلا تمييز نوع الحركة:

```ts
total_value: acc.total_value + row.total_value,
```

لكن `total_value` لكل صف = `sum(total_cost)` **لنفس نوع الحركة فقط** (مجمّعة بـ`group by movement_kind, ...`) — أي أن صف «مبيعات» يمثّل تكلفة البضاعة المباعة (تدفق خارج)، وصف «مشتريات» يمثّل قيمة الوارد (تدفق داخل)، وصف «مناقلة — إخراج»/«إدخال» قيمة منقولة، إلخ. جمعها كلها برقم واحد («إجمالي قيمة» ببطاقة الملخص العلوية) **لا يمثّل أي مقدار محاسبي ذي معنى** — هو ببساطة مجموع قيم داخلة وخارجة ومحايدة معاً. لا يوجد تنويه بالواجهة يوضح أن هذا الرقم إجمالي خام غير مصنَّف حسب الاتجاه.

## 4. صلاحيات RPC — لا فحص صلاحية ولا تقييد فرع داخل الدالة 🟠

`get_inventory_movements_summary` (`setup_all.sql:8373-8392`): `language sql stable security definer` بلا أي `has_permission()`/`is_admin()` داخلها، و`p_branch_id` فلتر اختياري فقط. لا يوجد `grant execute on function public.get_inventory_movements_summary` صريح بأي مكان — الاعتماد الوحيد على `revoke execute on all functions in schema public from anon` (`setup_all.sql:13803`)، الذي يمنع `anon` فقط. أي مستخدم مسجّل دخول (`authenticated`) يستطيع استدعاء هذا الـRPC مباشرة ويرى ملخص حركات كل الفروع دون فحص صلاحيته الفعلية بجدول الصلاحيات — نفس نمط `using(true)` الموثّق بمعظم وحدات النظام هذه الجلسة، ممتداً هنا عبر SECURITY DEFINER يتجاوز RLS الجدول الأساسي أصلاً (فحتى إصلاح RLS مستقبلاً على `inventory_movements` لن يحمي هذه الدالة، لأنها تعمل بصلاحيات مالكها).

## 5. لا ترقيم صفحات — لكن الأثر محدود لأن النتيجة مُجمَّعة أصلاً 🟡

`get_inventory_movements_summary` بلا `LIMIT`، لكن بما أن النتيجة مُجمَّعة بمفاتيح محدودة العدد (أنواع حركة × أنواع مصدر × أنماط)، عدد الصفوف المُعادة صغير عملياً (عشرات كحد أقصى) — الأداء هنا أقل حرجاً من تقرير رصيد المخزون، لكن **حساب** المجاميع نفسه يبقى مسحاً شبه كامل لجدول `inventory_movements` عند كل تغيير فلتر (لا فهرس مستقل على `movement_date`/`movement_kind` — الفهارس الوحيدة: `(material_id, warehouse_id, movement_date)` و`(source_type, source_id)`، `setup_all.sql:4293-4296`)؛ فلترة بفترة تاريخية فقط (بدون مادة/مستودع) تبقى Sequential Scan.

## 6. خطأ نصي «per» بالإنجليزية 🟡

`web/src/app/reports/inventory-movements/page.tsx:126`:
```tsx
مجمّع per نوع حركة ونوع فاتورة (مبيعات، مشتريات، مناقلة، تسوية…).
```
نفس النمط المُصلَح سابقاً بتقرير حدود المخزون (`audit-reports/2026-07-25-warehouse-limits-audit.md` §1). الأصح: «مجمّع **حسب** نوع حركة ونوع فاتورة».

## 7. رسالة خطأ RPC المفقودة صحيحة 🟢

`inventoryReportApi.listMovementSummary` (`inventory-report-api.ts:335-339`): «شغّل `patch_inventory_phase5.sql`» — صحيحة فعلاً؛ `get_inventory_movements_summary` مُعرَّفة حصراً هناك (`setup_all.sql:8373`، ضمن قسم `BEGIN patch_inventory_phase5.sql` الذي يبدأ سطر 8197) ولا تُعاد تعريفها لاحقاً. لا إجراء مطلوب.

## 8. `ReportsNav` مكوّن ميت مُستدعى بلا أثر (مشترك مع باقي التقارير) 🔵

`web/src/modules/reports/components/reports-nav.tsx` بالكامل:
```tsx
export function ReportsNav(_props: { active?: string }) {
  return null;
}
```
مُستدعى بهذه الصفحة (`inventory-movements/page.tsx:152`: `<ReportsNav active="inventory-movements" />`) بلا أي أثر بصري — تعليق الكود يذكر أن التبويبات أصبحت قوائم منسدلة بالشريط العلوي، لكن الاستدعاء الميت تُرك بمكانه. ليس خطأً وظيفياً، لكنه كود ميت مكرَّر بكل صفحات `reports/*` (مُلاحَظ بنفس الشكل بتقريري رصيد المخزون وCOGS).

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **أضف مساراً لعرض سطر حركة فردي مع drill-down لمستند المصدر ضمن هذه الصفحة نفسها** (§1) — إما بدمج/رابط مباشر لتبويب «دفتر حركة» الموجود فعلاً داخل `reports/inventory-balance` (أسرع حل: زر/رابط واضح من هذه الصفحة)، أو بإضافة RPC مستوى-سطر مخصص لهذا المسار. الوضع الحالي (ملخص فقط، صفر drill-down) لا يلبي الحد الأدنى المتوقع من صفحة بعنوان «حركات المخزون».

### 🟠 عالٍ

2. **أكمل `MOVEMENT_KIND_LABELS`/`COMMERCIAL_KIND_LABELS`** (§2) بالقيم الأربعة الناقصة (`manufacture_consume`, `manufacture_produce`, `disassemble_consume`, `disassemble_produce`) ومفتاحي `manufacturing`/`disassembly` — أي منشأة تستخدم التصنيع/التفكيك تصطدم بهذا فوراً.
3. **أضف فحص صلاحية/فرع داخل `get_inventory_movements_summary`** (§4) — نفس التوصية المطبَّقة على باقي تقارير المخزون بهذه الجلسة.

### 🟡 متوسط

4. **افصل بطاقة «إجمالي قيمة» حسب الاتجاه (وارد/صادر)** بدل رقم مجمّع غير متجانس (§3)، أو احذفها إن لم تُصلَح.
5. **صحّح «per» بالإنجليزية** (§6).
6. أضف فهرساً مستقلاً على `movement_date` إن كثُر الاستخدام بفترات تاريخية بلا فلتر مادة/مستودع (§5).

### 🔵 تحسين

7. احذف استدعاء `ReportsNav` الميت من هذه الصفحة (وباقي صفحات `reports/*`) أو أعد تفعيله (§8).

## ملحق

- `web/src/app/reports/inventory-movements/page.tsx`
- `web/src/modules/reports/services/inventory-report-api.ts` — `MOVEMENT_KIND_LABELS`, `COMMERCIAL_KIND_LABELS`, `listMovementSummary`.
- `database/setup_all.sql:8373-8425` — `get_inventory_movements_summary` (من `patch_inventory_phase5.sql`).
- `database/setup_all.sql:18149-18156` — القيد النهائي على `movement_kind` (12 قيمة، من `patch_composite_disassembly.sql`).
- `database/patch_invoice_manufacturing.sql:385,462,485-503` — حركات/نمط التصنيع.
- `database/patch_composite_disassembly.sql:859,968,989-1007` — حركات/نمط التفكيك.
- `web/src/app/reports/inventory-balance/page.tsx:694-763` — تبويب «دفتر حركة» الفعلي مع drill-down (للمقارنة، غير معدَّل).
- `audit-reports/2026-07-25-warehouse-limits-audit.md` §1 — سابقة إصلاح خطأ «per».
