# تدقيق دقيق — مراكز الكلفة (Cost Centers)

منهجية: قراءة الكود الفعلي (SQL + TypeScript) لكل ملفات `web/src/app/cost-centers/**` و`web/src/modules/cost-centers/**`، وتتبّع بنية جدول `cost_centers` وسياساته عبر `database/setup_all.sql` (الناتج المُجمَّع فعلياً حسب `database/build_setup_all.ps1`، لا أي ملف patch منفرد). هذا القسم من النظام **لم يُغطَّ إطلاقاً** بأي تقرير تدقيق سابق (`AUDIT_FINDINGS.md`, `AUDIT_FINDINGS_PENDING.md`, `2026-07-22-accounts-vouchers-audit.md` تناولت استخدام `cost_center_id` داخل السندات فقط، وليس شاشة إدارة مراكز الكلفة نفسها). المقارنة المرجعية طوال هذا التقرير هي مع وحدة **دليل الحسابات** لأن الوحدتين متشابهتان بنيوياً (كود مولَّد تلقائياً + كود فرعي مرجعي + تفعيل/تعطيل) لكن التطبيق تباعد بينهما في نقاط محددة.

## 1. RLS مفتوحة بالكامل على `cost_centers` — بلا أي `has_permission()`

`database/setup_all.sql:2741-2750`:

```sql
create policy "cost_centers_insert_all" on public.cost_centers
  for insert to authenticated with check (true);
create policy "cost_centers_update_all" on public.cost_centers
  for update to authenticated using (true) with check (true);
```

نفس نمط `accounts`/`vouchers` الموثّق سابقاً بتقرير الحسابات والسندات: مفاتيح الصلاحيات `cost_centers.create`/`cost_centers.edit` (معرَّفة بـ`permission-catalog.ts:68-69`) تُستخدم حصراً لإخفاء/تعطيل الأزرار (`PermissionGate` بـ`web/src/app/cost-centers/page.tsx:138`، وشرط `canEdit` بالسطر 197). أي مستخدم `authenticated` — بصرف النظر عن دوره الفعلي — يستطيع إدراج/تعديل مراكز كلفة مباشرة عبر Supabase client بلا أي مانع من القاعدة. هذه أول مرة تُوثَّق فيها هذه الفجوة تحديداً لجدول `cost_centers` (كانت موثّقة سابقاً للحسابات والسندات فقط).

## 2. لا إعادة محاولة عند تصادم الكود — خلافاً لدليل الحسابات الذي عالَج نفس المشكلة

`costCenterApi.createCostCenter()` و`createCostCentersBulk()` (`web/src/modules/cost-centers/services/cost-center-api.ts:48-106`) يحسبان الكود (`CC-XXX`) بقراءة `listCostCenters()` كلقطة لحظية ثم توليد الرقم التالي محلياً (`generate-cost-center-code.ts:11-28`)، **بلا أي إعادة محاولة عند فشل الإدراج بسبب تصادم `unique`** على `cost_centers.code` (`code varchar(30) not null unique` — `setup_all.sql:331`).

هذا يتناقض تماماً مع وحدة الحسابات المكافئة: `createAccountWithGeneratedCode()` (`web/src/modules/accounts/utils/create-account-with-code.ts`) حلّت هذه المشكلة صراحة بإعادة محاولة تلقائية حتى 8 مرات عند اكتشاف خطأ تصادم الكود. مراكز الكلفة لم تحصل على نفس الإصلاح رغم أنها معرَّضة لنفس السيناريو حرفياً (تبويبان مفتوحان، أو إضافة فردية متزامنة مع استيراد جماعي): أول من يضغط "حفظ" ينجح، والثاني يتلقى خطأ Postgres الخام من `unique constraint` بلا أي تعافٍ تلقائي — والمستخدم مطالَب بإعادة المحاولة يدوياً دون أن يفهم غالباً سبب الفشل الحقيقي.

نفس الغياب موجود في `createCostCentersBulk()` (بلا حتى معالجة استثناء لكل صف) — إدراج متعدد الصفوف (`insert(inserts)`) بجملة SQL واحدة، فأي تصادم كود واحد وسط الدفعة يُسقط الدفعة بالكامل.

## 3. نموذج الإضافة الفردية لا يفحص تكرار الاسم العربي، خلافاً للاستيراد الجماعي ولوحدة الحسابات

`onSubmit()` في `web/src/app/cost-centers/page.tsx:80-108` يتحقق فقط من أن `name_ar` غير فارغ (`values.name_ar.trim()`, السطر 81) — **لا فحص تكرار إطلاقاً**. بالمقابل:

- الاستيراد الجماعي لنفس الوحدة (`validateBulkCostCenterRows()` بـ`web/src/modules/cost-centers/utils/bulk-import-cost-centers.ts:112-168`) **يفحص فعلياً** تكرار `name_ar` ضمن الدفعة ومقابل الموجود (السطور 130-140).
- وحدة الحسابات المكافئة (`web/src/app/accounts/page.tsx:178-186`) تفحص تكرار الاسم عند **الإضافة الفردية** أيضاً عبر `normalizeArabicForComparison`.
- لا قيد `unique` على `cost_centers.name_ar` بقاعدة البيانات (`name_ar varchar(200) not null` بلا `unique`، `setup_all.sql:333`) — فلا شبكة أمان خلفية أصلاً.

النتيجة العملية: يمكن اليوم إنشاء مركزَي كلفة بنفس الاسم العربي حرفياً عبر زر «إضافة مركز كلفة» العادي، بينما نفس المحاولة عبر «إضافة دفعة» تُرفض بوضوح. تناقض داخل نفس الوحدة، وينحرف عن السلوك المعتمد في دليل الحسابات.

## 4. لا تأكيد قبل تعطيل/تفعيل مركز كلفة، خلافاً لدليل الحسابات

`toggleActive()` بـ`web/src/app/cost-centers/page.tsx:110-125` يستدعي `costCenterApi.updateCostCenter()` مباشرة بلا أي `window.confirm(...)`. المكافئ بوحدة الحسابات (`toggleActive` بـ`web/src/app/accounts/page.tsx:265-289`) يعرض نافذة تأكيد توضّح الأثر قبل التنفيذ. الفارق منخفض الخطورة (العملية قابلة للتراجع بضغطة أخرى) لكنه اختلاف تجربة مستخدم غير مبرَّر بين شاشتين متطابقتين وظيفياً.

## 5. أزرار نافذتَي مركز الكلفة تخرج عن نظام التصميم المشترك، رغم أن صفحة القائمة ملتزمة به

على النقيض من نوافذ الحسابات (راجع `audit-reports/2026-07-25-accounts-audit.md` §5)، صفحة `cost-centers/page.tsx` نفسها **ملتزمة تماماً** بنظام التصميم (`.btn`, `.btn-primary`, `.btn-outline`, `.btn-sm`, `.data-table`, `.badge` — الأسطر 140-217). لكن النافذتين المنبثقتين تُعيدان اختراع الأزرار يدوياً:

- `web/src/modules/cost-centers/components/cost-center-form-modal.tsx:156-170` — `rounded-md bg-blue-900...` و`rounded-md border border-slate-300...` بدل `btn-primary`/`btn-outline`.
- `web/src/modules/cost-centers/components/cost-center-bulk-import-modal.tsx:214-246, 330-355` — كل أزرار الشريط والتذييل بنفس النمط اليدوي.

هذا يعني أن الالتزام بالنظام الموحّد **متقطّع داخل نفس الوحدة**: القائمة الرئيسية صحيحة، النوافذ المنبثقة لا.

## ملخّص الفجوات

| # | الملاحظة | الموقع | الخطورة |
|---|---|---|---|
| 1 | RLS مفتوحة بالكامل على `cost_centers` بلا `has_permission()` — أول توثيق لهذا الجدول تحديداً | `setup_all.sql:2741-2750` | 🔴 حرج |
| 2 | لا إعادة محاولة عند تصادم كود مركز الكلفة (فردي أو جماعي) — خلافاً لدليل الحسابات | `cost-center-api.ts:48-106` | 🟠 عالٍ |
| 3 | النموذج الفردي لا يفحص تكرار `name_ar` بينما الاستيراد الجماعي يفحصه | `cost-centers/page.tsx:80-108` مقابل `bulk-import-cost-centers.ts:112-168` | 🟠 عالٍ |
| 4 | لا تأكيد قبل تعطيل/تفعيل مركز كلفة | `cost-centers/page.tsx:110-125` | 🟡 متوسط |
| 5 | نافذتا الإضافة/التعديل والاستيراد الجماعي تُعيدان اختراع الأزرار بدل `.btn` رغم التزام صفحة القائمة | `cost-center-form-modal.tsx:156-170`, `cost-center-bulk-import-modal.tsx` | 🟡 متوسط |

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **أضف فحص `has_permission('cost_centers.create'/'cost_centers.edit')` داخل سياسات RLS لـ`cost_centers`** (أو، كحدّ أدنى، ضِف دالة `SECURITY DEFINER` وسيطة للكتابة تفرض الصلاحية داخلياً بدل الاعتماد كلياً على واجهة تُخفي الأزرار فقط) — يتماشى مع نفس التوصية الصادرة سابقاً لجداول الحسابات/السندات.

### 🟠 عالٍ

2. **طبّق نفس منطق إعادة المحاولة الموجود في `createAccountWithGeneratedCode()` على `costCenterApi.createCostCenter()`/`createCostCentersBulk()`** — التقط خطأ تصادم `unique` على `code` وأعد توليد الكود ومحاولة الإدراج، بدل ترك خطأ Postgres الخام يصل للمستخدم.
3. **أضف نفس فحص تكرار `name_ar` (بعد توحيد النص العربي) إلى نموذج الإضافة الفردية** في `cost-centers/page.tsx onSubmit`، بنفس أسلوب `normalizeArabicForComparison` المستخدم بدليل الحسابات — لتوحيد السلوك بين مسار الإضافة الفردية والجماعية داخل نفس الوحدة.

### 🟡 متوسط

4. **أضف `window.confirm(...)` قبل تعطيل/تفعيل مركز كلفة** في `cost-centers/page.tsx toggleActive`، بنفس نمط الحسابات، لتوحيد تجربة المستخدم بين الشاشتين.
5. **استبدل الأزرار اليدوية في `cost-center-form-modal.tsx`/`cost-center-bulk-import-modal.tsx` بكلاسات `.btn .btn-primary`/`.btn .btn-outline`** لتطابق التزام صفحة القائمة نفسها بنظام التصميم.

## ملحق — ملفات مرجعية رئيسية

- `database/setup_all.sql` — جدول `cost_centers` (329-341)، RLS مراكز الكلفة (2741-2750).
- `web/src/app/cost-centers/page.tsx` — القائمة الرئيسية، فحص الإدخال الفردي (80-108)، التفعيل/التعطيل (110-125).
- `web/src/modules/cost-centers/services/cost-center-api.ts` — الإضافة الفردية والجماعية بلا إعادة محاولة (48-106).
- `web/src/modules/cost-centers/utils/generate-cost-center-code.ts` — توليد الكود التسلسلي `CC-XXX` من لقطة عميل.
- `web/src/modules/cost-centers/utils/bulk-import-cost-centers.ts` — تحقق الدفعة، بما فيه فحص تكرار الاسم الغائب عن النموذج الفردي (112-168).
- `web/src/modules/cost-centers/components/cost-center-form-modal.tsx` و`cost-center-bulk-import-modal.tsx` — أزرار غير موحَّدة مع نظام التصميم.
- `web/src/app/accounts/page.tsx` و`web/src/modules/accounts/utils/create-account-with-code.ts` — المرجع المقارَن به طوال هذا التقرير (المعالجة الأكثر نضجاً لنفس المشكلات).
