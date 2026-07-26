# تدقيق دقيق — سند التسوية (Settlement Voucher)

> **تحديث جزئي (2026-07-25):** التوصية #7 (نص «per» بواجهة إغلاق الحركات) ✓ مُغلقة. بقية البنود الحرجة/العالية **ما زالت مفتوحة**.

منهجية: قراءة الكود الفعلي (SQL + TypeScript) لكل ملفات الواجهة والمنطق الخاصة بسند التسوية ومنظومة إغلاق الحركات/المقاصة المرتبطة به، وتتبّع ترتيب تطبيق الـpatches الحقيقي عبر `database/build_setup_all.ps1` — لأن `database/setup_all.sql` هو المصدر المُجمَّع الفعلي (الحقيقة الأرضية)، وداخله كل دالة يعاد تعريفها بـ`create or replace` أكثر من مرة تُفعَّل بآخر ملف يُعيد تعريفها حسب ترتيب مصفوفة `$patchFiles`، وليس بأول نتيجة بحث نصي. هذا التقرير يُكمّل تقرير `2026-07-22-accounts-vouchers-audit.md` (الذي غطّى منطق الترحيل/التخصيص/RLS العام) بالتركيز حصراً على شاشات سند التصفية (`settlement_mode='account'`) ومكوّنات إغلاق الحركات المشتركة معه (`settlement_mode='invoice'` من نماذج القبض/الدفع) بما أنها تُشكّل معاً أعقد نوع سند في التطبيق.

**نطاق الملفات المفحوصة**: `web/src/app/vouchers/settlement/new/page.tsx`, `web/src/modules/vouchers/components/{settlement-voucher-form,settlement-voucher-lines-table,voucher-netting-panel,voucher-allocations,open-dimension-summaries,close-movement-sections,close-movement-filters-bar,close-movement-journal-preview}.tsx`, `web/src/modules/vouchers/utils/{build-close-movement-journal-preview,sync-close-movement-lines,validate-voucher-allocations,validate-voucher-netting,open-movement-utils,voucher-cost-center-utils}.ts`, و`database/{patch_settlement_foundation,patch_journal_dimensions,patch_voucher_allocation_cap,patch_period_enforcement,patch_reverse_invoice_settlement}.sql`.

ملاحظة نطاق مهمة: `voucher-netting-panel.tsx`, `voucher-allocations.tsx`, `open-dimension-summaries.tsx`, `close-movement-sections.tsx` **ليست مستوردة فعلياً من `settlement-voucher-form.tsx`** — سند التصفية (`/vouchers/settlement`، `settlement_mode='account'`) نموذج مستقل بحساب وسيط تلقائي فقط. هذه المكوّنات الأربعة تُستخدم حصراً من `payment-voucher-form.tsx`/`receipt-voucher-form.tsx` (سندات قبض/دفع بوضع `settlement_mode='invoice'`، عبر `close-movement-sections.tsx`) وتشترك فعلياً في نفس منظومة "إغلاق الحركات والمقاصة" (`open_items_view`, `voucher_allocations`, `voucher_netting_lines`) التي هي جوهر تعقيد سند التسوية بمعناه الواسع. الفحص أدناه يغطي الاثنين معاً كما حدّد نطاق المهمة.

## 1. سند التصفية (`settlement_mode='account'`) — `settlement-voucher-form.tsx` / `settlement-voucher-lines-table.tsx`

- آلية بسيطة وسليمة: المستخدم يُدخل سطراً بمدين أو دائن (وليس الاثنين معاً — يُمنع صراحة بـ`hasDualSideRows`، `settlementLineHasBothSides`)، ويُنشئ `buildSettlementVoucherLinesForSave` سطر مقابل تلقائي على "الحساب الوسيط" بالجهة المعاكسة (`settlement-voucher-lines-table.tsx:508-556`)، بعلم `cc_optional: true` (`pushClearingDbLine`, سطر 487-506) يُعفيه من إلزام مركز الكلفة.
- **توازن مركز الكلفة يُفرض مرتين متطابقتين**: مرة بالواجهة (`validateCostCenterBalance` بـ`requireCostCenter: true, excludeNullCostCenter: true`، `settlement-voucher-form.tsx:147-156, 262-271`) ومرة بالخادم داخل `vouchers_before_update_handle_posting()` النسخة الفعّالة (`patch_reverse_invoice_settlement.sql:146-174`) — منطق متطابق تماماً (لكل مركز كلفة على حدة، وليس فقط توازن السند ككل). **جيد**: لا يوجد مسار خلفي يتجاوز هذا الفحص عند الترحيل الفعلي عبر الواجهة، لأن RLS المفتوحة (`using(true)`) تعني تقنياً إمكانية إدراج سطر `posted` مباشرة متجاوزاً كل هذا — لكن هذا امتداد لفجوة RLS العامة الموثّقة مسبقاً في التقرير الأساسي (#7)، وليس خللاً خاصاً بسند التصفية.
- **عرض الإجماليات في `settlement-voucher-form.tsx:594-606` صحيح لكنه مُربِك بصرياً**: يعرض "مدين الوسيط" = `totalUserCredit` و"دائن الوسيط" = `totalUserDebit` (منطقي لأن سطر الوسيط بالجهة المعاكسة لسطر المستخدم) — لكن لا تعليق أو توضيح يشرح لماذا التسميتان معكوستا القيمة ظاهرياً؛ محاسب يقرأ الشاشة سريعاً دون فهم آلية التوليد التلقائي قد يظنّه خطأً. نفس التكرار يظهر مرة أخرى بصيغة مطابقة داخل `settlement-voucher-lines-table.tsx:334-348` (عرض مكرر لنفس الإجماليات بمكوّن منفصل، بلا فائدة إضافية).
- لا يوجد أي زر حذف أو عكس لسند التصفية داخل `settlement-voucher-form.tsx` نفسه — هذه العمليات تمر حصراً عبر `voucher-list-actions.tsx` المشترك بين كل أنواع السندات (مغطّى بالتقرير الأساسي، `window.confirm` بدل مكوّن `Modal` المشترك — نفس النمط العام في كل التطبيق وليس خاصاً بالتصفية).

## 2. عطل كامل غير موثّق سابقاً: مقاصة CC/الفرع (`voucher_netting_lines`) لا يمكن ترحيلها إطلاقاً

هذا أخطر اكتشاف بهذا التقرير. تتبّعت السلسلة الكاملة من الواجهة حتى الترحيل الفعلي:

- **لا يوجد أي حقل إدخال لـ`inter_account_id`** (الحساب الوسيط لقيد المقاصة) في `voucher-netting-panel.tsx` — الجدول (`NettingTable`, سطر 226-307) يعرض فقط: من CC/فرع، إلى CC/فرع، المبلغ، خانة "يشمل نقداً"، ملاحظة، حذف. لا `<select>` ولا أي عنصر آخر لاختيار حساب.
- `buildEmptyNettingLine()` (`validate-voucher-netting.ts:61-78`) يُنشئ كل سطر مقاصة جديد بـ`inter_account_id: null` **دون أي قيمة افتراضية من الإعدادات** (خلافاً للحساب الوسيط بسند التصفية نفسه، الذي له افتراضي من `voucher_type_defaults` عبر `typeDefaults.default_account_id`).
- بحثت في كامل `payment-voucher-form.tsx` و`receipt-voucher-form.tsx` (اللذين يستضيفان `VoucherNettingPanel` عبر `CloseMovementSections`) — **لا وجود لأي تعيين لـ`inter_account_id` في أي منهما**، ولا في `voucher-api.ts` (`replaceVoucherNettingLines`, سطر 1431-1468) الذي يمرّر `inter_account_id: line.inter_account_id ?? null` كما هو حرفياً للقاعدة.
- التحقق الأمامي قبل الحفظ (`validateVoucherNettingLines`, `validate-voucher-netting.ts:10-58`) يفحص فقط: وجود من/إلى مختلفين، والمبلغ لا يتجاوز الصافي المتاح — **لا يفحص وجود `inter_account_id` إطلاقاً**. السطر يُحفظ بنجاح كمسودة/معتمد بلا أي تحذير.
- عمود القاعدة نفسه `inter_account_id uuid null` (**قابل للـNULL**، `patch_settlement_foundation.sql:78`) — لا قيد `not null` ولا `check` يمنع NULL عند الإدخال.
- لكن عند الترحيل الفعلي، النسخة الفعّالة من `vouchers_before_update_handle_posting()` (`patch_reverse_invoice_settlement.sql:246-254`، آخر من يعيد تعريف الدالة حسب ترتيب البناء) تحتوي:
  ```sql
  for v_netting in select * from public.voucher_netting_lines vnl
    where vnl.voucher_id = new.id and vnl.amount > 0
  loop
    if v_netting.inter_account_id is null then
      raise exception 'Netting line requires inter_account_id.';
    end if;
    ...
  ```
  أي أن **أي سند فيه سطر مقاصة CC أو فرع بمبلغ > 0 سيفشل ترحيله دائماً** برسالة `raise exception` صريحة — بلا استثناء، لأنه لا يوجد أي مسار في الواجهة الحالية يمكنه إنتاج `inter_account_id` غير NULL.
- **الرسالة نفسها لا تُترجَم**: فحصت قائمة `ERROR_TRANSLATIONS` كاملة في `voucher-feedback-utils.ts:10-42` — لا يوجد أي نمط (`RegExp`) يطابق `"Netting line requires inter_account_id"`. المستخدم (محاسب لا يقرأ الإنجليزية بالضرورة) سيرى رسالة الخطأ الخام بالإنجليزية حرفياً عبر `formatVoucherError`، مع عدم وجود أي حقل بالواجهة يمكنه تعديله لحلّ المشكلة أصلاً.
- تأكّد الخلل مرتين: نفس منطق الرفض (`raise exception 'Netting line requires inter_account_id.'`) موجود أيضاً بنسخة سابقة من نفس الدالة في `patch_period_enforcement.sql:225-233` (يُستبدَل لاحقاً بنسخة `patch_reverse_invoice_settlement.sql` الأحدث في ترتيب البناء لكن بنفس السلوك بالضبط) — الخلل ثابت عبر كل تاريخ تطوّر الدالة، وليس زلّة عابرة بنسخة واحدة.

**الأثر المحاسبي**: ميزة مقاصة مراكز الكلفة/الفروع — التي تصف نفسها في الواجهة بأنها "تسوية بين مراكز كلف أو فروع" وتُعرض بصريّاً بالكامل (جدول، معاينة قيد بـ`CloseMovementJournalPreview`) — **معطّلة بالكامل من طرف إلى طرف**. أي محاسب يستخدمها سيصل حتماً لخطأ عند الترحيل، بعد إدخال بيانات (من/إلى/مبلغ/ملاحظة) ظنّاً منه أنها ستُرحَّل بنجاح. هذا أخطر من مجرد UI-only mismatch؛ إنه ميزة كاملة غير قابلة للاستخدام إطلاقاً منذ إضافتها.

## 3. خانة "يشمل نقداً" (`includes_cash`) — عنصر واجهة بلا أي أثر محاسبي

- `voucher-netting-panel.tsx:271-280` يعرض `checkbox` لكل سطر مقاصة، بقيمة افتراضية ذكية تُقرأ من إعدادات مركز الكلفة (`resolveIncludesCashDefault`, سطر 16-23 يقرأ `cost_centers.netting_includes_cash_default` — عمود مُضاف خصيصاً بـ`patch_branches.sql:67-72` لهذا الغرض بالتحديد).
- القيمة تُحفظ فعلياً بالعمود `voucher_netting_lines.includes_cash` وتُنسخ حتى عند عكس السند (`reverse_posted_voucher()`, `patch_reverse_invoice_settlement.sql:487,500`).
- لكن **لا يوجد أي استهلاك فعلي للقيمة** في أي من: حلقة إدراج قيود المقاصة بالترحيل (`patch_reverse_invoice_settlement.sql:246-365` — لا إشارة لـ`v_netting.includes_cash` إطلاقاً)، `buildCloseMovementJournalPreview` (`build-close-movement-journal-preview.ts:92-150` — لا قراءة للحقل بمعاينة القيد أيضاً)، ولا `open_items_view`/`get_open_items`. الحقل يُعرَض، يُدخَل، له افتراضي محسوب من الإعدادات، يُحفَظ، يُنسَخ عند العكس — لكنه **لا يغيّر أي سلوك محاسبي أو أي قيد فعلي على الإطلاق**. عنصر واجهة "زينة" بالكامل حالياً (أو ميزة نصف منفَّذة تُوحي بوظيفة غير موجودة).

## 4. أعمدة ميتة على `voucher_allocations` من تصميم سابق مهجور

`patch_settlement_foundation.sql:12-30` يضيف لـ`voucher_allocations`: `allocation_type` (افتراضي `'close'`، بقيم `close/netting_cc/netting_branch`)، `applied_amount_base`، `source_branch_id`، `target_branch_id`، `source_cost_center_id`، `target_cost_center_id` — مع فهرس مخصّص لـ`allocation_type`. بحث شامل عبر كامل الكود (SQL + TypeScript) لا يُظهر **أي كتابة أو قراءة فعلية** لهذه الأعمدة الستة بعد إنشائها: لا `INSERT`/`UPDATE` يحدّد `allocation_type` غير الافتراضي، لا استعلام يستخدم `source_cost_center_id`/`target_branch_id`، ولا حتى تعريف `VoucherAllocation` بـ`web/src/modules/vouchers/types.ts:69-76` يذكرها. يبدو أن التصميم الأصلي كان استخدام `voucher_allocations` نفسها (بتمييز `allocation_type`) لتنفيذ مقاصة CC/الفرع، ثم تحوّل التنفيذ الفعلي لجدول منفصل (`voucher_netting_lines`، بنفس الملف، أسطر لاحقة) بلا حذف الأعمدة الأولى. فجوة تصميمية توثيقية بحتة (لا خطر بيانات)، لكنها مضلِّلة لأي مطوّر يقرأ المخطط لاحقاً.

## 5. علّة نص عربي/إنجليزي مختلط بالواجهة — ✓ مُغلق (الواجهة)

~~`close-movement-sections.tsx` كان يعرض «صافٍ per …».~~

**الإصلاح (2026-07-25):** «صافٍ لكل مركز كلفة» / «صافٍ لكل فرع». تعليقات SQL في `patch_journal_dimensions.sql` ما زالت تستخدم «per» (غير ظاهرة للمستخدم).

## 6. تناسق واجهة/تصميم

- الأزرار والألوان في كل مكوّنات سند التصفية وإغلاق الحركات تستخدم فعلياً الرموز المشتركة (`.btn`, `.btn-primary`, `.btn-outline`, `var(--danger)`) بشكل متّسق مع بقية التطبيق — لا انحراف عن `globals.css`.
- لا استخدام لمكوّن `Modal` المشترك (`web/src/components/modal.tsx`) في أي من مكوّنات هذا النطاق — لا حاجة له أصلاً هنا لأن الحوارات التأكيدية (حذف/عكس) تعيش بمكوّنات أخرى مغطّاة بالتقرير الأساسي.
- تنسيق الأرقام في `voucher-netting-panel.tsx` (`nettingTotal.toFixed(2)`) و`voucher-allocations.tsx` (`.toFixed(2)` مباشرة) **لا يمرّ عبر `formatVoucherAmount`** المستخدَم في بقية الشاشة (والذي يحترم `decimal_places` الفعلي لعملة السند) — بعملات بمنازل عشرية مختلفة عن 2 (مثال: دينار كويتي 3 منازل) قد تُعرض هذه الإجماليات مقرَّبة بشكل غير متّسق مع بقية الأرقام بنفس الشاشة. فجوة اتساق طفيفة وليست خطأ حسابياً (التقريب للعرض فقط).

## 7. ملاحظات مرتبطة بتقرير سابق (لا إعادة اشتقاق، إشارة فقط)

- استخدام `jel.debit`/`jel.credit` الخام بدل `debit_base`/`credit_base` في `open_items_view` (`patch_journal_dimensions.sql:104-160`, يُعاد تعريفه حرفياً بلا تغيير وظيفي في `patch_settlement_foundation.sql:104-172`) هو نفس الخلل الموثّق بالتقرير الأساسي (#8) — يؤثر مباشرة على شاشات إغلاق الحركات لأنها المستهلك الرئيسي لهذا العرض، فقيمة "المفتوح" المعروضة بـ`voucher-allocations.tsx` قد تكون بعملة سطر القيد الأصلي دون أي تطابق مضمون مع عملة السند المُخصِّص.
- RLS المفتوحة بالكامل (`using(true)`) على `voucher_netting_lines` (`patch_settlement_foundation.sql:96-98`) و`voucher_allocations`/`vouchers` (مغطّاة بالتقرير الأساسي #7) تعني عملياً أن أي مستخدم `authenticated` — حتى بلا أي صلاحية `vouchers.*` — يستطيع قراءة/كتابة أسطر مقاصة أو تخصيصات مباشرة عبر استدعاء Supabase مباشر، متجاوزاً واجهة إغلاق الحركات بالكامل.

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **إصلاح ميزة مقاصة CC/الفرع المعطّلة بالكامل** — إمّا: (أ) إضافة حقل اختيار `inter_account_id` فعلي في `voucher-netting-panel.tsx` (مع افتراضي من إعدادات مشابه لحساب التصفية الوسيط)، أو (ب) إن كان القصد استخدام حساب وسيط ثابت واحد على مستوى النظام، تمريره تلقائياً من `voucher_type_defaults` عند إنشاء `buildEmptyNettingLine`. مع إضافة تحقق أمامي صريح (`validateVoucherNettingLines`) يرفض الحفظ/الاعتماد إن كان `inter_account_id` فارغاً، بدل تركه يصل لخطأ ترحيل غير مفهوم. هذه الميزة غير قابلة للاستخدام حالياً بأي شكل.
2. **ترجمة رسالة `"Netting line requires inter_account_id."` بقائمة `ERROR_TRANSLATIONS`** كإجراء مؤقت سريع حتى إصلاح الجذر أعلاه — حداً أدنى لتجنّب تعطّل غير مفهوم لمستخدم لا يقرأ الإنجليزية.

### 🟠 عالٍ

3. **حسم مصير خانة "يشمل نقداً" (`includes_cash`)** — إمّا ربطها فعلياً بمنطق الترحيل/التقارير (مثلاً: التأثير على حساب "النقدية" ضمن قيد المقاصة أو تصنيف التقرير التدفقي)، أو إزالتها من الواجهة إن لم تعد هناك حاجة تصميمية لها — حالياً تُوهم المستخدم بوظيفة غير موجودة رغم أنها مرتبطة بافتراضي مضبوط لكل مركز كلفة.
4. **حذف الأعمدة الستة الميتة على `voucher_allocations`** (`allocation_type`, `applied_amount_base`, `source_branch_id`, `target_branch_id`, `source_cost_center_id`, `target_cost_center_id`) أو توثيق صريح داخل `patch_settlement_foundation.sql` بأنها من تصميم مهجور استُبدل بـ`voucher_netting_lines`، لتفادي التباس مطوّرين لاحقين.

### 🟡 متوسط

5. **تمرير إجماليات المقاصة/التخصيصات عبر `formatVoucherAmount`** بدل `.toFixed(2)` المباشر في `voucher-netting-panel.tsx` و`voucher-allocations.tsx`، لاتساق عدد المنازل العشرية مع عملة السند الفعلية.
6. **تبسيط عرض إجماليات الحساب الوسيط المكرّر** بين `settlement-voucher-form.tsx:594-606` و`settlement-voucher-lines-table.tsx:334-348` — إبقاء نسخة واحدة، أو إضافة تلميح (tooltip/نص) يوضّح لماذا القيم معكوسة التسمية.

### 🔵 لغوي/تحسين

7. ~~**تصحيح "صافٍ per مركز كلف" و"صافٍ per فرع"**~~ — ✓ مُغلق 2026-07-25: أصبح «صافٍ لكل مركز كلفة» / «صافٍ لكل فرع» في `close-movement-sections.tsx`. (تعليقات SQL في `patch_journal_dimensions.sql` ما زالت تستخدم «per» — غير ظاهرة للمستخدم.)

## ملحق — ملفات مرجعية رئيسية

- `web/src/modules/vouchers/components/settlement-voucher-form.tsx` — نموذج سند التصفية الكامل (720 سطراً)، منطق الحفظ/الاعتماد/الترحيل.
- `web/src/modules/vouchers/components/settlement-voucher-lines-table.tsx` — توليد أسطر المقابل التلقائي على الحساب الوسيط (`buildSettlementVoucherLinesForSave`, 508-556).
- `web/src/modules/vouchers/components/voucher-netting-panel.tsx` — لا حقل `inter_account_id` (كامل الملف، 307 سطراً).
- `web/src/modules/vouchers/components/close-movement-sections.tsx` — يجمع `VoucherAllocations` + `VoucherNettingPanel` + `OpenDimensionSummaries` + معاينة القيد لسندات القبض/الدفع بوضع `settlement_mode='invoice'`.
- `web/src/modules/vouchers/utils/validate-voucher-netting.ts` — `buildEmptyNettingLine()` بلا `inter_account_id` افتراضي (61-78).
- `web/src/modules/vouchers/utils/voucher-feedback-utils.ts` — قائمة `ERROR_TRANSLATIONS` بلا مدخل لخطأ المقاصة (10-42).
- `database/patch_settlement_foundation.sql` — جدول `voucher_netting_lines` (67-98)، الأعمدة الميتة على `voucher_allocations` (12-30)، `open_items_view` (104-172).
- `database/patch_reverse_invoice_settlement.sql` — النسخة الفعّالة النهائية من `vouchers_before_update_handle_posting()` بما فيها رفض المقاصة بلا `inter_account_id` (246-365)، و`reverse_posted_voucher()` (374-532).
- `database/patch_journal_dimensions.sql` — `open_items_view`/`get_open_items()` الأصليان (92-225).
- `database/patch_voucher_allocation_cap.sql` — `validate_allocation_row_capacity`/`validate_voucher_allocations_capacity` الفعّالتان (7-141).
