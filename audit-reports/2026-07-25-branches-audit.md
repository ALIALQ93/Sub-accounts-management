# تدقيق دقيق — الفروع (Branches)

منهجية: `database/setup_all.sql` كمرجع نهائي مُجمَّع (آخر `create or replace`/سياسة تفوز حسب ترتيب `database/build_setup_all.ps1`)، مقروءاً مقابل `web/src/app/settings/branches/page.tsx`، `web/src/modules/branches/services/branch-api.ts`، `web/src/modules/branches/components/branch-form-modal.tsx`، وكل نقاط استهلاك `branch_id`/`BranchOption` بالمخازن والفواتير ونقاط البيع (`warehouse-api.ts`, `warehouse-form-modal.tsx`, `pos-point-form.tsx`, `invoice-form.tsx`). قارنت سلوك التعطيل بالنمط المرجعي الفعلي الموجود فعلاً بالمشروع لتصنيف مشابه: `database/patch_material_category_cascade_deactivate.sql` (تعطيل صنف أب يُسقِط تلقائياً الأصناف الفرعية والمواد).

---

## 1) 🔴 تعطيل فرع لا يُسقط أي شيء تابع له — وتعطيل آخر فرع نشط (أو الفرع الرئيسي) بلا أي تحذير يوقف إنشاء عمليات جديدة بصمت

**المكان:** `web/src/app/settings/branches/page.tsx:89-100` (`toggleActive` — استدعاء مباشر لـ`branchApi.updateBranch(branch.id, { is_active: !branch.is_active })` بلا أي `confirm`)، ولا يوجد أي Trigger على `public.branches` غير `trg_branches_updated_at` (`database/patch_branches.sql:92-95` — بحثت عن أي محفز آخر على الجدول ولا وجود لأي منطق cascade).

**المقارنة المرجعية المباشرة:** المشروع نفسه يطبّق النمط الصحيح لحالة مشابهة تماماً بملف حديث آخر: `patch_material_category_cascade_deactivate.sql` — تعطيل صنف مواد أب يُسقط تلقائياً (بمحفز `after update of is_active`) كل الأصناف الفرعية والمواد التابعة. **لا يوجد محفز مكافئ على `branches`.**

**الأثر بجزأين:**
- **(أ) المستودعات ونقاط البيع المرتبطة بفرع مُعطَّل تبقى نشطة وتعمل بشكل طبيعي بالكامل** — `warehouseApi.listWarehouses()` (`web/src/modules/materials/services/warehouse-api.ts:22-56`) يُرجع كل المستودعات بلا أي فلترة على حالة الفرع الأب، وحقل `is_active` بجدول `warehouses` مستقل تماماً عن `branches.is_active`. أي مستودع أو نقطة بيع (POS point) تابعة لفرع "مُغلَق" منطقياً تستمر بالعمل (بيع، تسوية مخزون، فواتير) وكأن شيئاً لم يتغيّر.
- **(ب) لا حماية من تعطيل آخر فرع نشط بالنظام أو الفرع الرئيسي نفسه.** بما أن كل الفروع المتاحة للفواتير الجديدة (`invoice-form.tsx:1407-1408`)، المستودعات الجديدة (`warehouse-form-modal.tsx:112-113`)، ونقاط البيع الجديدة (`pos-point-form.tsx:260-261`) تُفلتَر بـ`.filter(b => b.is_active)`، فإن تعطيل الفرع الوحيد المتبقي (وهو سيناريو مرجَّح جداً بمشروع تجربة أولى ببذرة فرع واحد فقط `MAIN`، `patch_branches.sql:84-86`) يجعل **كل قوائم اختيار الفرع بكل شاشات الإنشاء فارغة تماماً** بلا أي رسالة تفسّر السبب لحظة الضغط على زر "تعطيل" — المستخدم يكتشف العطل لاحقاً بشاشة مختلفة كلياً.

**السلوك المطلوب:**
1. تحذير/تأكيد صريح عند تعطيل فرع له مستودعات أو نقاط بيع نشطة تابعة له (على الأقل عرض العدد، وإتاحة خيار تعطيلها معه — مثل نمط الأصناف).
2. منع تعطيل آخر فرع نشط بالنظام (أو الفرع الرئيسي تحديداً) صراحة، أو تحذير قوي جداً قبل الإتمام.

---

## 2) 🟠 حقول الفرع "الحسّاسة" فعلياً (الحسابات الافتراضية والمستودع الافتراضي) غير معروضة إطلاقاً بنموذج الفرع

**المكان:** `web/src/modules/branches/services/branch-api.ts:41-49` (`BranchFormValues`) و`web/src/modules/branches/components/branch-form-modal.tsx:70-136` (كل حقول النموذج).

**المشكلة:** جدول `branches` يحتوي `default_warehouse_id`, `default_cost_center_id`, `inventory_account_id`, `inter_branch_account_id` (`database/patch_branches.sql:15-22`) — وهذه بالذات ما وصفها تقرير الأمان السابق بأنها "أكثر حساسية من `company_settlement_accounts` المجاورة" (`AUDIT_PERIODS_AND_SECURITY.md §3-ب`). **لا واحد منها معروض بنموذج إنشاء/تعديل الفرع.** النموذج يعرض فقط: الرمز، الاسمين، العنوان، الهاتف، نشط، فرع رئيسي. أي فرع جديد يُنشأ بهذه الحقول فارغة (`null`) بلا أي طريقة لتعبئتها من الواجهة على الإطلاق.

**السلوك المطلوب:** إضافة حقول اختيار (منسدلة) لهذه الأربعة بنموذج الفرع، حتى لو بقسم "متقدّم" قابل للطي — الوضع الحالي يجعلها بيانات ميتة فعلياً رغم استخدامها المفترض بمنطق مقاصة الفرع/CC عند الترحيل.

---

## 3) 🟠 تعديل أي سجل مرتبط بفرع أصبح غير نشط يُسقط اختيار الفرع بصمت (نمط متكرر بـ3 نماذج مختلفة)

**المكان (3 مواقع بنفس العلة بالضبط):**
- `web/src/modules/materials/components/warehouse-form-modal.tsx:112-118` — `defaultValue={defaults.branch_id}` غير مضبوط (uncontrolled) بينما القائمة `branches.filter(b => b.is_active)` لا تحتوي الفرع الأصلي إن أصبح معطَّلاً.
- `web/src/modules/pos/components/pos-point-form.tsx:242-267` — نفس العلة لكن بنموذج مضبوط (`value={values.branch_id}`), نفس فلترة `is_active` بسطر 261.
- `web/src/modules/accounting-periods/components/accounting-period-form-modal.tsx:62-64,164-180` — نفس الفلترة (`branches.filter(branch => branch.is_active)`) لقائمة اختيار فرع الفترة المحاسبية.

**المشكلة:** بما إن تعطيل الفرع (البند 1) لا يمنع ولا يحذّر، فأي مستخدم يفتح لاحقاً نموذج تعديل مستودع/نقطة بيع/فترة محاسبية كانت مرتبطة بفرع "أصبح معطَّلاً بعد إنشائها" سيجد قائمة الفرع **لا تعرض الفرع الحالي إطلاقاً** ضمن الخيارات (لأنه مُفلتَر). بالحالة غير المضبوطة (`warehouse-form-modal`) هذا يعني القيمة المعروضة فعلياً بالمتصفح تصبح أول عنصر بالقائمة (الخيار الفارغ) رغم إن `defaults.branch_id` ما زال يحمل قيمة الفرع القديم داخلياً — وعند submit عبر `FormData`، القيمة الفعلية المُرسَلة هي ما يظهر بالـ`<select>` نفسه (الخيار الفارغ)، فيفشل التحقق `required` ويجبر المستخدم على اختيار فرع آخر نشط لمجرد حفظ تعديل بسيط لا علاقة له بالفرع أصلاً.

**حالة أخطر مرتبطة — أنماط الفواتير:** `web/src/modules/invoices/components/invoice-form.tsx:668-671` يضبط فرع الفاتورة الجديدة بلا شرط من `patternData.default_branch_id` (حتى لو كان هذا الفرع معطَّلاً الآن)، بينما قائمة اختيار الفرع بنفس النموذج (`invoice-form.tsx:1403-1414`) مضبوطة (`value={branchId}`) ومفلترة بـ`is_active` فقط (سطر 1408). أي نمط فاتورة مُعرَّف مسبقاً بفرع افتراضي أصبح معطَّلاً لاحقاً سيستمر بتمرير `branchId` الحالة الداخلية = معرّف الفرع المعطَّل لكل فاتورة جديدة تُنشأ منه، بينما الـ`<select>` المرئي يظهر فارغاً — إن لم ينتبه المستخدم ويختار فرعاً يدوياً، فمن المحتمل تُرسَل الفاتورة فعلياً بـ`branch_id` لفرع معطَّل دون أن يظهر ذلك بوضوح بالواجهة.

**السلوك المطلوب:** بكل نقاط الاستهلاك الثلاث + نمط الفواتير: تضمين الفرع الحالي بالقائمة دائماً (حتى لو معطَّلاً) مع تمييزه بصرياً ("معطَّل")، بدل حذفه بالكامل من الخيارات.

---

## 4) 🟡 لا حماية/توضيح عند تعيين "فرع رئيسي" ثانٍ — خطأ Postgres خام بدل رسالة عربية

**المكان:** `database/patch_branches.sql:34-36` (فهرس فريد جزئي `idx_branches_single_head_office` على `is_head_office = true`)، مقابل `web/src/modules/branches/components/branch-form-modal.tsx:127-135` (checkbox "فرع رئيسي (المقر)" بلا أي تحذير أو تبديل تلقائي).

**المشكلة:** لا يوجد أي منطق بالواجهة يمنع أو يوضّح أن فرعاً واحداً فقط يمكن أن يكون "رئيسياً". محاولة تفعيل هذا الخيار على فرع ثانٍ بينما فرع آخر رئيسي بالفعل تصطدم مباشرة بالفهرس الفريد بقاعدة البيانات، ويظهر خطأ Postgres خام غير مترجم (`branchApi.updateBranch`/`createBranch`، `branch-api.ts:88-133`، لا معالجة خاصة لهذا الكود — فقط `throwIfSupabaseError` عام) بدل رسالة عربية مفهومة، بعكس النمط المتّبع بموديولات أخرى (`web/src/modules/vouchers/utils/voucher-feedback-utils.ts:10-42` يترجم رسائل مشابهة، `web/src/modules/accounts/utils/create-account-with-code.ts:5-14` يتحقق صراحة من كود التكرار `23505`).

**السلوك المطلوب:** إما تعطيل/تحذير بالواجهة عند محاولة تعيين فرع رئيسي ثانٍ (مع خيار "نقل الصفة تلقائياً" كتجربة أفضل)، أو على الأقل ترجمة رسالة الخطأ لعربية مفهومة.

---

## 5) 🟡 كود الفرع المكرر (`branch_code`) يظهر كخطأ قاعدة بيانات خام أيضاً

**المكان:** نفس `branch-api.ts:88-133` — القيد الفريد `branch_code varchar(30) not null unique` (`patch_branches.sql:17`) موجود وسليم (حماية فعلية من التكرار على مستوى القاعدة)، لكن لا ترجمة لرسالة "duplicate key value violates unique constraint" لصيغة عربية، بعكس النمط الموجود فعلياً بموديولات أخرى بنفس المشروع (راجع البند 4). ملاحظة إيجابية: التطبيع لحروف كبيرة (`.trim().toUpperCase()`) متسق بين الإنشاء والتعديل — لا ثغرة تكرار بحالة أحرف مختلفة.

---

## 6) 🔵 عدم اتساق واجهة — نموذج الفرع لا يستخدم مكوّن `Modal` المشترك ولا أزرار `.btn`

**المكان:** `web/src/modules/branches/components/branch-form-modal.tsx:48-49` (`<div className="fixed inset-0 z-50 ...">` يدوي بدل `import { Modal } from "@/components/modal"`)، وأزرار الحفظ/الإلغاء بسطر 141-156 تستخدم Tailwind خام (`bg-blue-900`, `border-slate-300`) بدل `.btn`/`.btn-primary`/`.btn-outline` (`web/src/app/globals.css:123-168`).

**المقارنة:** نموذج شقيق بنفس منطقة الميزات (المستودعات) يستخدم المكوّن المشترك بشكل صحيح: `web/src/modules/materials/components/warehouse-form-modal.tsx:3` (`import { Modal } from "@/components/modal"`). نتيجة الفارق: نموذج الفرع لا يغلق بـEscape، ولا يقفل تمرير الخلفية (`document.body.style.overflow`)، ولا يملك زر إغلاق (X) — كلها موجودة تلقائياً بالمكوّن المشترك (`web/src/components/modal.tsx:30-44,73-82`). نفس الملاحظة تنطبق حرفياً على `web/src/modules/accounting-periods/components/accounting-period-form-modal.tsx:70-71` (راجع تقرير الفترات المحاسبية).

**السلوك المطلوب:** استبدال الـ`<div>` اليدوي بمكوّن `Modal` المشترك، واستبدال أزرار Tailwind الخام بـ`.btn`/`.btn-primary`/`.btn-outline`.

---

## 7) 🔵 لا رسالة توضيحية لمستخدم العرض فقط (بعكس شاشة إعدادات الشركة)

**المكان:** `web/src/app/settings/branches/page.tsx` — لا وجود لأي شرط `!canEdit` يعرض رسالة (قارن مع `web/src/app/settings/company/page.tsx:131-135`). المستخدم غير المخوَّل يرى فقط جدولاً بلا عمود "إجراء" وبلا زر "فرع جديد"، بلا أي تفسير لماذا.

---

## توصيات مرتّبة حسب الأولوية

### 🔴 عاجل
1. حماية/تحذير عند تعطيل فرع له مستودعات أو نقاط بيع نشطة، ومنع تعطيل آخر فرع نشط بالنظام أو الفرع الرئيسي بلا تأكيد صريح (§1).

### 🟠 عالٍ
2. إضافة حقول الحسابات الافتراضية والمستودع الافتراضي لنموذج الفرع (§2).
3. إصلاح تسريب اختيار الفرع الصامت عند تعديل سجلات مرتبطة بفرع معطَّل (مستودعات، نقاط بيع، فترات محاسبية، أنماط فواتير) — تضمين الفرع الحالي بالقائمة دائماً مع تمييزه (§3).

### 🟡 متوسط
4. تحذير أو ترجمة رسالة عند تعارض "فرع رئيسي" مكرر (§4).
5. ترجمة رسالة تكرار `branch_code` لعربية مفهومة (§5).

### 🔵 منخفض / تحسين اتساق
6. استخدام مكوّن `Modal` المشترك وأزرار `.btn` بنموذج الفرع بدل الحل اليدوي (§6).
7. إضافة رسالة "عرض فقط" لمستخدم بلا صلاحية تعديل، بنفس نمط شاشة إعدادات الشركة (§7).

## ملحق
- `web/src/app/settings/branches/page.tsx`
- `web/src/modules/branches/services/branch-api.ts`, `web/src/modules/branches/components/branch-form-modal.tsx`
- `web/src/modules/materials/services/warehouse-api.ts`, `web/src/modules/materials/components/warehouse-form-modal.tsx`
- `web/src/modules/pos/components/pos-point-form.tsx`
- `web/src/modules/invoices/components/invoice-form.tsx`
- `web/src/modules/accounting-periods/components/accounting-period-form-modal.tsx`
- `database/patch_branches.sql`
- النمط المرجعي للمقارنة: `database/patch_material_category_cascade_deactivate.sql`
- `web/src/components/modal.tsx`, `web/src/app/globals.css`
