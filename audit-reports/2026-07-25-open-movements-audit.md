# تدقيق دقيق — الحركات المفتوحة (Open Movements)

منهجية: قراءة الكود الفعلي لشاشة `web/src/app/open-movements/page.tsx` وطبقة الخدمة `web/src/modules/vouchers/services/open-movements-api.ts`، وتتبّع التعريف الفعلي لـ`open_items_view`/`get_open_items()` عبر `database/build_setup_all.ps1`. **`open_items_view` مُعرَّف مرتين**: أولاً في `patch_journal_dimensions.sql` (الترتيب #4 بقائمة الـpatches)، ثم يُعاد بناؤه بالكامل (`create or replace view`) في `patch_settlement_foundation.sql` (الترتيب #9) — **النسخة الفعّالة اليوم هي الثانية** (`patch_settlement_foundation.sql:104-172`)، وهي التي تدقيقها هنا، وليست النسخة الأقدم بـ`patch_journal_dimensions.sql`. دالة `get_open_items()` مُعرَّفة مرة واحدة فقط (`patch_journal_dimensions.sql:169-196`) وتستدعي `public.open_items_view` بالاسم — فتُحلّ تلقائياً إلى النسخة الأخيرة من العرض عند التنفيذ (لا حاجة لإعادة تعريفها). ركّزتُ حصراً على شاشة "الحركات المفتوحة" المستقلة (`open-movements/page.tsx` + `openMovementsApi`) — وليس على لوحة الفواتير `invoice-open-movements-panel.tsx` أو منطق مقاصة سند التصفية، كما حدّد نطاق التدقيق.

## 1. العرض الحيّ يقارن مبالغ خام (`debit`/`credit`) لا `_base`، وبلا أي تحقق من تطابق العملة — خطر خلط عملات مؤكَّد على مستوى الشاشة

`database/patch_settlement_foundation.sql:104-172` (النسخة الفعّالة):
```sql
with line_allocations as (
  select va.target_journal_line_id,
         coalesce(sum(va.applied_amount), 0)::numeric(18,2) as allocated_amount
  from public.voucher_allocations va
  inner join public.vouchers v on v.id = va.voucher_id
  where v.status = 'posted'
  group by va.target_journal_line_id
)
select ...
  jel.debit, jel.credit,
  abs(jel.debit - jel.credit) as original_amount,
  coalesce(la.allocated_amount, 0) as allocated_amount,
  greatest(abs(jel.debit - jel.credit) - coalesce(la.allocated_amount, 0), 0) as open_amount,
  ...
```
`va.applied_amount` هو مبلغ التخصيص **بعملة السند المُخصِّص**، بينما `jel.debit`/`jel.credit` بعملة **سطر القيد المستهدف الأصلية** — العرض يطرح أحدهما من الآخر **مباشرة وبلا أي تحويل أو تحقق `currency_id`**. لا `where jel.currency_id = <عملة السند>` ولا استخدام لـ`debit_base`/`credit_base` (وهما عمودان موجودان فعلياً على `journal_entry_lines`، `01_schema.sql:104-105`، لكن العرض لا يستخدمهما إطلاقاً — سطر 137-138 يختار `jel.debit, jel.credit` الخام فقط). هذا يطابق ويؤكد مباشرة على مستوى شاشة الحركات المفتوحة تحديداً الفجوة التي وثّقها تدقيق السندات السابق (`2026-07-22-accounts-vouchers-audit.md`, البند 8) بخصوص التخصيص عموماً — **فاتورة بعملة أجنبية تُقاص جزئياً بسند بعملة مختلفة أو بسعر صرف مختلف سيُنتج `open_amount` رقمياً خاطئاً بصمت، بلا أي رسالة خطأ.**

## 2. لا عرض لعملة السطر إطلاقاً على الشاشة — المستخدم لا يمكنه حتى اكتشاف الخلط أعلاه

العرض `open_items_view` يُخرج فعلياً عمود `jel.currency_id` (`patch_settlement_foundation.sql:130`)، لكن:
- `ViewRow` بـ`open-movements-api.ts:20-45` **لا يتضمن `currency_id` أو `currency_code` إطلاقاً** ضمن حقول `select` المطلوبة من `open_items_view` (سطر 104-130) ولا ضمن معاملات RPC.
- نوع `OpenMovement` بـ`web/src/modules/vouchers/types.ts:155-180` **لا يحتوي أي حقل عملة**.
- جدول الشاشة (`open-movements/page.tsx:92-133`) **لا يعرض عمود عملة إطلاقاً** — عمود "المفتوح" (`item.open_amount.toFixed(2)`) رقم مجرّد بلا رمز أو كود عملة.

النتيجة: حتى لو أُصلحت مقارنة العملات بالبند 1، **الشاشة نفسها اليوم لا تسمح لمحاسب بمعرفة عملة أي سطر مفتوح**. في نشاط متعدد العملات، لا يمكن التمييز بين سطر مفتوح بـ100 دولار وآخر بـ100 دينار — كلاهما يظهران "100.00" بلا سياق. هذه فجوة "معالجة العملة" مباشرة وحرجة لهذه الشاشة تحديداً.

## 3. حركات مفتوحة "عالقة" فعلياً وبتصميم متعمَّد — تسوية بنمط `settlement_mode='account'` لا تُغلق أي سطر

`database/patch_reverse_invoice_settlement.sql:133-144` (فرع الترحيل `vouchers_before_update_handle_posting`):
```sql
if new.settlement_mode = 'invoice' then
  select count(*) into v_allocation_count
  from public.voucher_allocations va where va.voucher_id = new.id;
  if v_allocation_count = 0 then
    raise exception 'Invoice settlement voucher requires allocation rows.';
  end if;
  perform public.validate_voucher_allocations_capacity(new.id, true);
end if;
```
الإلزام بوجود `voucher_allocations` (وبالتالي الخصم من `open_items_view`) **مشروط فقط بـ`settlement_mode = 'invoice'`**. سند قبض/دفع بنمط `settlement_mode = 'account'` (تسوية عامة على حساب العميل/المورد بلا استهداف سطر قيد محدد) **يُرحَّل بنجاح تام دون إنشاء أي `voucher_allocations`**، وبالتالي **لا يخصم شيئاً من أي سطر بـ`open_items_view`**. عملياً: عميل تُسدَّد ذمته عبر سند قبض عادي (نمط `account`) بدل تخصيص السند صراحة لفاتورة محددة — رصيد حسابه الإجمالي ينخفض بشكل صحيح بالتقارير المالية، **لكن سطر الفاتورة الأصلي يبقى "مفتوحاً" في هذه الشاشة إلى الأبد**، ما يجعل مجموع "الحركات المفتوحة" المعروض هنا **غير متطابق مع الرصيد الفعلي المستحق على الحساب** كلما استُخدم نمط `account` بدل `invoice` للتحصيل ضد فاتورة بعينها. هذا هو "الحركة المفتوحة الخاطئة/العالقة" التي طلب التدقيق تحديداً التحقق منها — وهي ليست خللاً برمجياً بل نتيجة مباشرة لتصميم النموذجين معاً بلا أي تحذير للمستخدم متى يجب استخدام أيهما.

## 4. المسار الأساسي (RPC) بلا أي حد أقصى لعدد السطور — بعكس المسار الاحتياطي

`open-movements-api.ts:158-196` — `openMovementsApi.list()`:
- يستدعي أولاً `supabase.rpc("get_open_items", ...)`. دالة `get_open_items()` (`patch_journal_dimensions.sql:169-196`) **بلا أي `limit`** — تُعيد كل الصفوف المطابقة للفلاتر، مهما كان عددها، مرتّبة فقط.
- المسار الاحتياطي `listFromView()` (يُستخدم فقط إن كانت الدالة غير موجودة) يضع `.limit(500)` صراحة (`open-movements-api.ts:135`) **مع تعليق داخل الكود نفسه يحذّر من أن هذا المسار "يعرض مبالغاً خاطئة" ولا يُعتمد إن كان فارغاً** (سطر 189-195).
- بما أن `patch_journal_dimensions.sql` **مُدرَج فعلياً** بقائمة `build_setup_all.ps1`، فإن `get_open_items()` موجودة في أي بيئة مبنية من `setup_all.sql` — أي أن **المسار المُستخدَم عملياً هو غير المحدود (RPC)**. مع نمو عدد الفواتير/السندات المفتوحة عبر سنوات نشاط حقيقي، هذا يعني جلب **كل** السطور المفتوحة إلى المتصفح في كل تحميل للشاشة (بلا ترقيم صفحات ولا حد أعلى)، ثم فلترة نصية إضافية على العميل (`page.tsx:39-50`) — مخاطرة أداء حقيقية تكبر مع الزمن دون أي مؤشر تحذير أو حد أقصى ظاهر للمستخدم.

## 5. لا فهرس مخصّص يدعم `open_items_view` مباشرة، والاعتماد الكامل على فهارس `journal_entry_lines`/`voucher_allocations` القائمة

العرض (`patch_settlement_foundation.sql:104-172`) يصفّي على `je.status = 'posted'` (لا فهرس على `journal_entries.status`، تحقّقتُ — انظر تقرير القيود اليومية المرافق) وعلى تعبير محسوب `greatest(abs(jel.debit - jel.credit) - ..., 0) > 0` (تعبير غير قابل للفهرسة مباشرة دون فهرس دالّي مخصّص). الفهارس القائمة على `journal_entry_lines` (`account_id`, `journal_entry_id`, `cost_center_id`, `branch_id`, `due_date`, `currency_id`) و`voucher_allocations` (`idx_voucher_allocations_target_line_id`, `01_schema.sql:327`) تخدم أجزاء من الاستعلام لكن **لا شيء يخدم فلترة `status='posted'` على `journal_entries` تحديداً** — يتطابق مع فجوة الفهرسة الموثّقة بتقرير القيود اليومية، وينعكس هنا مباشرة على أداء هذه الشاشة تحديداً لأنها تستخدم `open_items_view` في كل تحميل.

## 6. الفلاتر المتاحة فعلياً بالـAPI أوسع بكثير مما تعرضه الشاشة

`OpenMovementFilters` (`web/src/modules/vouchers/types.ts:145-153`) يدعم: `branchId`, `costCenterId`, `partyType`, `partyId`, `openSide`, `eligibleOnly`, `overdueOnly` — وكلها مُطبَّقة فعلياً في `openMovementsApi.list()` (كل من مسار الـRPC عبر `rpcParams` ومسار العرض المباشر عبر `.eq(...)` المتسلسلة، `open-movements-api.ts:137-149`). **الشاشة الفعلية (`open-movements/page.tsx:60-83`) تعرض فقط**: مربع بحث نصي حر + قائمة منسدلة "جانب" (مدين/دائن/الكل). **لا قوائم منسدلة لفرع، مركز كلفة، أو طرف (عميل/مورد)، ولا مفتاح "متأخر فقط" أو "مستحق للدفع فقط"** رغم أن العمودين `is_overdue`/`is_eligible_for_payment` يُعرضان فعلياً بالجدول (سطر 125-130) كمعلومة سلبية فقط بلا قدرة فلترة عليها. هذا يحدّ عملياً من فائدة الشاشة لمحاسب يريد مثلاً "كل الحركات المفتوحة المتأخرة لفرع معيّن" — عليه فرزها يدوياً بالعين بدل الفلترة.

## 7. البحث النصي الحر لا يغطي وصف السطر أو الطرف

`page.tsx:39-50` — `filteredItems` يفلتر فقط على `entry_no`, `account_code`, `account_name`, `cost_center_code`, `branch_code`. **لا يشمل `line_description` (موجود فعلياً بالنوع `OpenMovement.line_description`) ولا أي معرّف للعميل/المورد (`party_id`/`party_type` موجودان بالبيانات لكن غير مستخدَمين حتى بالبحث النصي)** — إن كان اسم الحساب لا يحمل اسم العميل صراحة (يعتمد على تسمية دليل الحسابات الفعلي)، لا توجد طريقة للبحث عن حركات عميل بعينه بالاسم مباشرة على هذه الشاشة.

## 8. تصفية `open_amount > 0` مكرَّرة ثلاث مرات دون ضرر لكنها تكشف تسرّب منطق

القيمة `open_amount > 0` تُطبَّق: (أ) داخل تعريف `open_items_view` نفسه (`WHERE ... > 0`, `patch_settlement_foundation.sql:169-172`)، (ب) مجدداً في `listFromView()` عبر `.gt("open_amount", 0)` وفي `applyClientFilters()` (`open-movements-api.ts:96, 132`)، (ج) مجدداً في الشاشة نفسها (`page.tsx:24`: `data.filter((item) => item.open_amount > 0)`). لا خطأ وظيفي، لكنه يدل على غياب نقطة مسؤولية واحدة واضحة لهذا الفلتر — أي تعديل مستقبلي لعتبة "مفتوح" (مثلاً هامش تقريب صغير) يتطلب تعديل ثلاثة أماكن منفصلة بدل واحد.

## 9. لا صف إجمالي (Total) بأسفل الجدول

الجدول (`page.tsx:92-146`) يعرض السطور فرادى فقط بلا أي صف إجمالي لعمود "المفتوح" (لا إجمالي مدين، لا إجمالي دائن، لا صافي). لمحاسب يراجع عشرات السطور، غياب مجموع سريع يجبره على الجمع يدوياً أو تصدير البيانات خارجياً (لا يوجد تصدير أصلاً بالشاشة).

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **إصلاح مقارنة العملات في `open_items_view`** — استخدم `debit_base`/`credit_base` بدل `debit`/`credit` الخام لحساب `original_amount`/`open_amount`، أو أضف تحققاً صريحاً (`where jel.currency_id = v.currency_id` أو ما يعادله عبر تحويل صريح) يمنع طرح مبالغ بعملتين مختلفتين مباشرة. هذا يمسّ دقة الأرقام المعروضة لكل حركة مفتوحة بعملة أجنبية.
2. **إظهار عمود العملة (كود/رمز) لكل سطر بالشاشة** — أضف `currency_id`/`currency_code` إلى `ViewRow` (`open-movements-api.ts:20-45`)، نوع `OpenMovement` (`types.ts:155-180`)، وعمود جدول جديد بـ`page.tsx`. بدون هذا، إصلاح البند 1 وحده لن يكون كافياً لأن المستخدم لن يعرف أصلاً بأي عملة يُعرض كل رقم.

### 🟠 عالٍ

3. **توضيح/توثيق الفارق بين `settlement_mode='account'` و`'invoice'` بالواجهة**، أو إضافة تحذير عند استخدام نمط `account` لسند يستهدف عميلاً/مورداً له حركات مفتوحة موجودة فعلاً — لمنع تراكم حركات "عالقة" بصمت بهذه الشاشة رغم تحصيلها فعلياً على مستوى الحساب.
4. **إضافة حد أقصى صريح (Limit) مع ترقيم صفحات لمسار `get_open_items` RPC**، مطابقاً على الأقل لحد `500` المستخدَم بالمسار الاحتياطي — المسار الحالي بلا أي حد يجلب كل السطور المفتوحة في كل تحميل شاشة.
5. **إضافة فهرس على `journal_entries(status)`** (مشترك مع توصية تقرير القيود اليومية) — يخدم فلترة `open_items_view` مباشرة.

### 🟡 متوسط

6. **إضافة قوائم منسدلة لفرع/مركز كلفة/طرف ومفاتيح "متأخر فقط"/"مستحق فقط" بالشاشة نفسها** — الفلاتر مُطبَّقة فعلياً بطبقة الـAPI ولا تحتاج تغييراً بقاعدة البيانات، فقط عناصر واجهة إضافية.
7. **توسيع البحث النصي الحر ليشمل `line_description`** على الأقل، بما أنه متاح فعلياً بالبيانات.
8. **إضافة صف إجمالي (مدين/دائن/صافي) بأسفل جدول الحركات المفتوحة**.

### 🔵 معماري

9. **توحيد منطق `open_amount > 0`** في نقطة واحدة (الاعتماد فقط على تعريف العرض نفسه، وحذف الفلترة المكرّرة بالـAPI والشاشة) لتقليل نقاط الصيانة عند أي تعديل مستقبلي على تعريف "مفتوح".

## ملحق — ملفات مرجعية رئيسية

- `web/src/app/open-movements/page.tsx` — الشاشة المستقلة، الفلاتر (52-83)، الجدول (92-146).
- `web/src/modules/vouchers/services/open-movements-api.ts` — `ViewRow` (20-45)، `listFromView` بحد 500 (100-156)، `list()` عبر RPC بلا حد (158-197).
- `web/src/modules/vouchers/utils/open-movement-utils.ts` — تنسيق ملخّص العرض فقط، لا منطق حساب.
- `web/src/modules/vouchers/types.ts` — `OpenMovementFilters` (145-153)، `OpenMovement` (155-180، لا حقل عملة).
- `database/patch_journal_dimensions.sql` — التعريف الأول لـ`open_items_view` (92-160، غير فعّال حالياً) و`get_open_items()` الوحيدة (169-196، بلا حد أقصى).
- `database/patch_settlement_foundation.sql` — **إعادة البناء الفعّالة النهائية** لـ`open_items_view` (104-172).
- `database/patch_reverse_invoice_settlement.sql` — شرط إلزام `voucher_allocations` بنمط `invoice` فقط (133-144).
- `database/01_schema.sql` — فهارس `voucher_allocations` (326-327)، `journal_entry_lines` (114-119).
