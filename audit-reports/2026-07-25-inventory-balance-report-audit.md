# تدقيق دقيق — تقرير رصيد المخزون (Inventory Balance)

> **حالة المعالجة (2026-07-26):** #1 رصيد دفتر الحركة مع فلتر تاريخ ✓ — `get_inventory_movement_ledger` يضيف رصيد ما قبل `p_from_date` عبر `patch_reports_audit_fix.sql`. صلاحية الواجهة ✓.

منهجية: قراءة الكود الفعلي (SQL + TypeScript) مباشرة، واعتماد `database/setup_all.sql` كمرجع «الحقيقة المُصرَّفة» — النسخة الفعّالة من أي دالة هي آخر `create or replace` بترتيب تطبيق الـpatches الحقيقي (`database/build_setup_all.ps1`)، وليست أول نتيجة بحث نصي. تتبّعت `get_inventory_balance`، `get_inventory_movement_ledger`، `get_inventory_analysis` (لها 3 إعادات تعريف — تحققت من أن النسخة الفعّالة هي الأخيرة بـ`patch_inventory_phase5.sql`)، والفهارس الفعلية على `inventory_movements`.

النطاق: `web/src/app/reports/inventory-balance/page.tsx` (3 أوضاع عرض: رصيد مجمّع / دفتر حركة / نواقص-راكد) و`web/src/modules/reports/services/inventory-report-api.ts`.

هذا التقرير يبني على — ولا يُعيد اشتقاق — خلاصة `audit-reports/2026-07-22-materials-warehouses-audit.md` §1/§11 حول غياب رصيد مُخزَّن (materialized balance) وأن كل رصيد يُحسب لحظياً بـ`SUM` على كامل `inventory_movements`. هذا التقرير يركّز على **زوايا جديدة** لم تُغطَّ هناك: صحة/أداء شاشات هذا التقرير تحديداً، ومنطق تحليل النواقص/الراكد.

---

## 1. عمود «رصيد» بتبويب «دفتر حركة» يعرض قيمة خاطئة عند تفعيل فلتر التاريخ — ليس رصيداً فعلياً بل مجموع تراكمي للحركات المفلترة فقط 🔴

`get_inventory_movement_ledger` (`database/setup_all.sql:7051-7134`، من `patch_inventory_reports.sql`) يحسب `running_balance_base` بدالة نافذة (`window function`) **بعد** تطبيق فلتر التاريخ ضمن نفس الـCTE:

```sql
-- setup_all.sql:7082-7108 (فلتر p_from_date/p_to_date داخل CTE "filtered")
with filtered as (
  select ... im.quantity_base_delta, ...
  from public.inventory_movements im
  ...
  where (p_from_date is null or im.movement_date >= p_from_date)
    and (p_to_date is null or im.movement_date <= p_to_date)
    ...
)
select
  ...
  sum(f.quantity_base_delta) over (
    partition by f.material_id, f.warehouse_id
    order by f.movement_date, f.created_at, f.movement_id
    rows between unbounded preceding and current row
  )::numeric(18, 6) as running_balance_base,
  ...
from filtered f
```

الـ`sum() over (...)` يتراكم **فقط على الصفوف الناجية من فلتر `p_from_date`/`p_to_date`** — لا يوجد أي إضافة لرصيد افتتاحي (الرصيد الفعلي حتى `p_from_date - 1`) قبل بدء التراكم. بمعنى: إن اختار المستخدم «من» بتاريخ لاحق لبداية عمر المادة، عمود «رصيد» (`LedgerTable`, `web/src/app/reports/inventory-balance/page.tsx:732-734`) يبدأ العدّ من صفر عند أول حركة **داخل الفترة المفلترة**، وليس من الرصيد الحقيقي وقتها.

**مثال ملموس:** مادة برصيد حقيقي 500 وحدة حتى 2026-06-30. مستخدم يفتح «دفتر حركة» بفلتر «من 2026-07-01». أول حركة بالفترة بيع 50 وحدة → عمود «رصيد» بهذا الصف سيعرض **-50** (لأن التراكم يبدأ من صفر) بدل **450** الصحيح. لا أي تنويه/تحذير بالواجهة يوضح أن العمود غير موثوق عند تفعيل فلتر التاريخ — يبدو كرقم رصيد رسمي عادي (`toFixed(4)`، خط `font-mono`، نفس شكل بقية الأعمدة الرقمية).

**الأثر:** هذا تحديداً هو الوضع الافتراضي المتوقّع للاستخدام — دفتر حركة بلا فلتر تاريخ غير عملي لمنشأة تراكمت لديها حركات كثيرة، فمن المرجّح جداً أن يستخدم المحاسب فلتر تاريخ دائماً، وهو بالضبط ما يُنتج القيمة الخاطئة.

## 2. تبويب «نواقص/راكد» يُجري 3 عمليات تجميع كاملة منفصلة على `inventory_movements` عند كل تحميل — أداء متضاعف بلا داعٍ 🟠

هذا اكتشاف جديد يُدقّق أداء **شاشة التحليل تحديداً** (وليس فقط `get_inventory_balance` عموماً كما وثّق التقرير الأشمل):

عند `viewMode === "analysis"` (`inventory-balance/page.tsx:119-136`، الوضع الافتراضي `preferMaterialMinStock = true`):

```ts
: Promise.all([
    inventoryReportApi.listAnalysisRows({...}),          // ← استدعاء RPC #1
    preferMaterialMinStock
      ? inventoryReportApi.listBalanceRows({..., hideZero: false})  // ← استدعاء RPC #2 (مكرر!)
      : Promise.resolve([]),
  ]);
```

لكن `listAnalysisRows` نفسها (`get_inventory_analysis`، النسخة الفعّالة `setup_all.sql:8248-8365`) تحتوي **داخلياً** استدعاءين منفصلين لتجميع كامل الجدول:

```sql
-- setup_all.sql:8275-8285 — تجميع #1 (عبر get_inventory_balance كاملة)
with balance as (
  select * from public.get_inventory_balance(p_as_of_date, null, p_warehouse_id, p_branch_id, null, false)
),
-- setup_all.sql:8286-8294 — تجميع #2 (max(movement_date) منفصل بالكامل)
last_move as (
  select im.material_id, im.warehouse_id, max(im.movement_date) as last_movement_date
  from public.inventory_movements im
  where (p_as_of_date is null or im.movement_date <= p_as_of_date)
  group by im.material_id, im.warehouse_id
)
```

فالنتيجة: **تحميل واحد** لتبويب «نواقص/راكد» (بالإعداد الافتراضي) = تجميع/مسح كامل لجدول `inventory_movements` **3 مرات متوازية** (تجميع الرصيد داخل `get_inventory_analysis`، تجميع آخر تاريخ حركة داخل نفس الدالة، ثم استدعاء `get_inventory_balance` مستقل بالكامل من الواجهة نفسها لنفس البيانات تقريباً). مع غياب رصيد مُخزَّن (موثّق بالتقرير الأشمل) وغياب فهرس على `movement_date` وحده (انظر §3)، هذا يضاعف تكلفة الأداء لأكثر الشاشات استخداماً يومياً (تنبيهات نقص/ركود) بلا أي فائدة إضافية واضحة — الاستدعاء المكرر من الواجهة (`listBalanceRows` بـ§2) يُستخدم فقط لحساب `listBelowMinStockRows` محلياً بـ JavaScript (منطق مكرر مستقل عن SQL — انظر §4).

## 3. لا ترقيم صفحات على أي من دوال هذا التقرير، وفهرسة جدول `inventory_movements` لا تخدم كل أنماط الفلترة 🟠

`get_inventory_balance` (`setup_all.sql:6964-7040`)، `get_inventory_movement_ledger` (`7051-7134`)، و`get_inventory_analysis` (`8248-8365`) — الثلاثة `language sql stable`، **بلا `LIMIT`/`OFFSET`** بالتعريف، والواجهة تجلب كل الصفوف المطابقة دفعة واحدة دائماً (`inventory-report-api.ts:196-273`، بلا أي معامل صفحة). هذا يؤكد ويُحدِّد كمياً ملاحظة التقرير الأشمل («`get_inventory_balance` بلا فلاتر يجمع كامل الجدول») تحديداً لهذه الشاشات الثلاث.

الفهارس الفعلية الوحيدة على `inventory_movements` (`setup_all.sql:4293-4296`):
```sql
create index idx_inventory_movements_material_wh on public.inventory_movements(material_id, warehouse_id, movement_date);
create index idx_inventory_movements_source on public.inventory_movements(source_type, source_id);
```
لا فهرس على `branch_id` وحده، ولا على `movement_date` وحده، ولا على `movement_kind`. أي استعلام يفلتر بفرع فقط (بلا مادة/مستودع) — حالة شائعة جداً لمنشأة متعددة الفروع تريد رصيد فرع معيّن — أو بفترة تاريخ فقط (تبويب دفتر حركة)، يبقى Sequential Scan كاملاً على الجدول.

## 4. منطق «نواقص حسب حد المادة/المستودع» مُعاد تنفيذه بالكامل بجافاسكريبت منفصلاً عن SQL — نفس نمط انحراف موثّق سابقاً لتحويل الوحدات 🟡

`listBelowMinStockRows` (`inventory-report-api.ts:276-321`) تُعيد تنفيذ **منطق أولوية الحد الأدنى** (حد المستودع يتفوّق على حد المادة) بجافاسكريبت مستقل تماماً عن نفس المنطق المطبَّق فعلياً بـSQL داخل `get_inventory_analysis`:

```sql
-- setup_all.sql:8298-8302 (SQL — المرجع الفعلي وقت الترحيل/الفحص)
coalesce(nullif(wml.min_stock, 0), nullif(m.min_stock, 0), 0) as min_stock,
```
```ts
// inventory-report-api.ts:295-299 (JS — نسخة موازية مستقلة)
const effectiveMin = (materialId, warehouseId) => {
  const whMin = minByWarehouse.get(`${materialId}:${warehouseId}`) ?? 0;
  if (whMin > 0) return whMin;
  return minByMaterial.get(materialId) ?? 0;
};
```
تحقّقتُ أن الصيغتين متكافئتان دلالياً حالياً (كلتاهما: حد مستودع > 0 يتفوّق، وإلا حد المادة، وإلا صفر). لكن هذا يكرّر بالضبط النمط الذي وثّقه تقرير المواد/المستودعات بند §8 (تحويل الوحدات) كخطر بنيوي: **أي تعديل مستقبلي على منطق الأولوية بـSQL لن ينعكس تلقائياً على النسخة الموازية بجافاسكريبت**، وعندها ستفترق نتائج تبويب «نواقص/راكد» (المدمجة بمنطق `preferMaterialMinStock`) عن نتائج استدعاء `get_inventory_analysis` مباشرة بلا سبب ظاهر.

## 5. تسميات `MOVEMENT_KIND_LABELS` ناقصة — تؤثر على تبويب «دفتر حركة» بهذا التقرير أيضاً 🟠

نفس الفجوة الموثّقة بتفصيل في `audit-reports/2026-07-25-inventory-movements-report-audit.md` §2 (القيد النهائي على `movement_kind` يسمح بـ12 قيمة، `MOVEMENT_KIND_LABELS` يغطي 8 فقط — ناقص `manufacture_consume`, `manufacture_produce`, `disassemble_consume`, `disassemble_produce`) تنطبق **حرفياً** هنا أيضاً، لأن تبويبي «دفتر حركة» (`LedgerTable`, `inventory-balance/page.tsx:720-722`) و«نواقص/راكد» يستوردان نفس `MOVEMENT_KIND_LABELS` من نفس الملف. أي منشأة تستخدم التصنيع/التفكيك سترى نصاً إنجليزياً خاماً بعمود «النوع» بتبويب دفتر الحركة هنا كذلك. لا تُعَد التفاصيل هنا لتفادي التكرار — انظر التقرير الآخر للاستشهادات الكاملة.

## 6. صلاحيات RPC — لا فحص صلاحية ولا تقييد فرع داخل أي من الدوال الثلاث 🟠

`get_inventory_balance`, `get_inventory_movement_ledger`, `get_inventory_analysis` — الثلاثة `security definer` بلا أي `has_permission()`/`is_admin()` داخلية، و`p_branch_id` فلتر اختياري بكل منها. لا يوجد `grant execute on function public.get_inventory_balance`/`get_inventory_movement_ledger`/`get_inventory_analysis` صريح بأي مكان بـ`setup_all.sql` — فقط `revoke execute on all functions in schema public from anon` العام (`setup_all.sql:13803`) الذي يمنع دور `anon` فقط. أي مستخدم `authenticated` (بصرف النظر عن صلاحياته الفعلية) يستطيع استدعاء أي من الدوال الثلاث مباشرة عبر RPC ويرى **قيمة المخزون الكاملة لكل الفروع** (بترك `p_branch_id` فارغاً) — نفس نمط `using(true)` الموثّق بمعظم وحدات النظام هذه الجلسة، هنا عبر SECURITY DEFINER يتجاوز RLS الجدول الأساسي أصلاً حتى لو أُصلح مستقبلاً (توصية §10 بالتقرير الأشمل تعالج RLS الجدول، لكن هذه الدوال تبقى غير محمية بمعزل عنها لأنها SECURITY DEFINER بلا فحص داخلي).

## 7. خطأ نصي «per» بالإنجليزية + مسافات مضاعفة 🟡

`web/src/app/reports/inventory-balance/page.tsx:312-313`:
```tsx
كميات وقيم تقديرية من <code>inventory_movements</code>{" "}
— per مادة ومستودع.         للتسوية الجردية استخدم{" "}
```
كلمة «per» الإنجليزية داخل جملة عربية (نفس نمط `audit-reports/2026-07-25-warehouse-limits-audit.md` §1)، مع مسافات فراغ مضاعفة واضحة بين «مستودع.» و«للتسوية». الأصح: «— لكل مادة ومستودع. للتسوية الجردية استخدم…».

## 8. رسالة خطأ RPC مضلِّلة لـ`get_inventory_analysis` — تشير لملف patch قديم لم يعد يحتوي النسخة الفعّالة 🔵

`inventoryReportApi.listAnalysisRows` (`inventory-report-api.ts:266-269`): عند غياب الدالة، الرسالة تقول «شغّل `patch_inventory_phase2.sql`». لكن `get_inventory_analysis` أُعيد تعريفها **3 مرات** (`setup_all.sql:7559`, `7694`, `8248`) — النسخة الفعّالة الحالية (الأخيرة، السطر 8248) تقع فعلياً ضمن قسم `patch_inventory_phase5.sql` (يبدأ `setup_all.sql:8197`)، وليس `phase2`. تشغيل `patch_inventory_phase2.sql` فقط كما توحي الرسالة سيُنشئ نسخة **أقدم وأنقص** من الدالة (بلا التحسينات اللاحقة بـphase3/phase5)، لا النسخة الفعّالة الموصوفة بهذا التقرير. رسالة توجيه ذاتي للمحاسب (عند ترقية DB جزئية) تقوده لملف خاطئ.

## 9. فلتر «الصنف» متاح فقط بوضع «رصيد مجمّع» — سلوك متعمَّد ومتّسق مع الفجوة الموثّقة سابقاً 🟢

`categoryId` يُمرَّر فقط بـ`listBalanceRows` (`inventory-balance/page.tsx:108`)، وحقل الاختيار نفسه مشروط بـ`viewMode === "balance"` (`inventory-balance/page.tsx:488-504`). هذا متّسق تماماً مع ما وثّقه `audit-reports/2026-07-25-material-categories-audit.md` §5 («تجميع التقارير حسب الصنف: جزئي — تقرير رصيد المخزون فقط»). لا فجوة جديدة هنا داخل هذه الشاشة نفسها — الفلتر يعمل بشكل صحيح أينما وُجد؛ الفجوة (غيابه من دفتر الحركة/التحليل) معمارية موثّقة مسبقاً، لا تُعاد هنا.

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **أصلح عمود «رصيد» بتبويب دفتر الحركة عند تفعيل فلتر التاريخ** (§1) — أضف رصيداً افتتاحياً محسوباً حتى `p_from_date - 1` (استعلام فرعي مجمّع لكل `material_id, warehouse_id` قبل بداية الفترة) يُضاف كنقطة بداية للـ`sum() over`، أو — إن كان تعقيد ذلك غير مبرر حالياً — عطِّل عمود «رصيد» أو أضف تحذيراً صريحاً بجانبه («رصيد تراكمي ضمن الفترة المفلترة فقط، وليس الرصيد الفعلي») كلما كان `fromDate` مضبوطاً، لتفادي قراءة محاسب لرقم رصيد خاطئ على أنه رسمي.

### 🟠 عالٍ

2. **أزل الاستدعاء المكرر لـ`listBalanceRows` بوضع التحليل** (§2) — إما مرّر بيانات الرصيد التي تحسبها `get_inventory_analysis` داخلياً كجزء من نتيجتها (توسيع `returns table`)، أو احسب منطق «نواقص حسب حد المادة» بالكامل داخل SQL بدل استدعاء RPC منفصل من الواجهة لنفس البيانات تقريباً — هذا يوفّر ثلث إلى نصف تكلفة تحميل الشاشة الأكثر استخداماً (تنبيهات يومية).
3. **أكمل `MOVEMENT_KIND_LABELS`** بالقيم الأربعة الناقصة (§5) — نفس التوصية بالتقرير المخصص لحركات المخزون؛ الإصلاح بملف واحد (`inventory-report-api.ts`) يحل المشكلة بكل الشاشات الثلاث دفعة واحدة.
4. **أضف فحص صلاحية/فرع داخل الدوال الثلاث** (§6).
5. **أضف فهرساً على `movement_date` وحده وعلى `branch_id`** (§3) لدعم الفلترة الشائعة بفرع فقط أو فترة فقط بلا مادة/مستودع.

### 🟡 متوسط

6. **وحِّد منطق أولوية الحد الأدنى (مستودع > مادة) بمصدر واحد** (§4) — إما اجعل الواجهة تعتمد حصراً على `min_stock` المُرجَع من `get_inventory_analysis` بدل حساب موازٍ بجافاسكريبت، أو استخرج الصيغة لدالة SQL واحدة (`get_effective_min_stock(material_id, warehouse_id)`) تُستدعى من الطرفين.
7. **صحّح «per» والمسافات المضاعفة** (§7).

### 🔵 تحسين

8. **صحّح رسالة خطأ `get_inventory_analysis` المفقودة** لتشير لـ`patch_inventory_phase5.sql` بدل `phase2` (§8).

## ملحق

- `web/src/app/reports/inventory-balance/page.tsx`
- `web/src/modules/reports/services/inventory-report-api.ts`
- `database/setup_all.sql:6964-7040` — `get_inventory_balance` (من `patch_inventory_reports.sql`).
- `database/setup_all.sql:7051-7134` — `get_inventory_movement_ledger` (من `patch_inventory_reports.sql`).
- `database/setup_all.sql:8248-8365` — `get_inventory_analysis` (النسخة الفعّالة، من `patch_inventory_phase5.sql`؛ إعادتا التعريف السابقتان بالسطرين 7559 و7694 غير فعّالتين).
- `database/setup_all.sql:4270-4296` — تعريف جدول `inventory_movements` وفهارسه الفعلية.
- `audit-reports/2026-07-22-materials-warehouses-audit.md` §1, §11 — خلفية غياب الرصيد المُخزَّن (لم تُعَد هنا).
- `audit-reports/2026-07-25-material-categories-audit.md` §5 — خلفية فجوة تجميع التقارير حسب الصنف (لم تُعَد هنا).
- `audit-reports/2026-07-25-inventory-movements-report-audit.md` §2 — التفصيل الكامل لفجوة تسميات `movement_kind` (مرجوع إليها هنا دون تكرار).
- `audit-reports/2026-07-25-warehouse-limits-audit.md` §1 — سابقة إصلاح خطأ «per».
