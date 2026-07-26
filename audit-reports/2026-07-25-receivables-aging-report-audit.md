# تدقيق دقيق — تقرير أعمار الذمم (Receivables/Payables Aging)

> **حالة المعالجة (2026-07-26):** #1 فشل embed عبر `party_id` ✓ — جلب أسماء الأطراف يدوياً بدون PostgREST embed؛ معالجة `PGRST200`. #2 خلط العملات ✓ — `open_items_view` يحسب بالعملة الأساسية (`debit_base` / `applied_amount_base`). فصل إجمالي عند «الكل» ✓ (مدينة/دائنة منفصلان).

منهجية: قراءة الكود الفعلي لشاشة `web/src/app/reports/receivables-aging/page.tsx` وطبقة الخدمة `web/src/modules/reports/services/open-items-report-api.ts`، وتتبّع `open_items_view` عبر `database/build_setup_all.ps1` إلى نسخته **الفعّالة اليوم** (`patch_settlement_foundation.sql:104-172`، مطابق لما وثّقه `2026-07-25-open-movements-audit.md`). النطاق هنا محصور بمسار هذا التقرير تحديداً (`openItemsReportApi.listAgingRows()` + `page.tsx`) — وليس شاشة الحركات المفتوحة المستقلة. تحقّقت بشكل ملموس (وليس نظرياً) من مخاوف خلط العملة وربط `party_id` المذكورة بتدقيقات اليوم الأخرى، عبر قراءة استعلام `.select()` الفعلي المُرسَل لـPostgREST وتتبّع تعريف عمود `party_id` من أصله.

---

## 1. 🔴 استعلام الشاشة يطلب تضمين (embed) `customers`/`vendors` عبر `party_id` — وهذا **غير قابل للحل بنيوياً**؛ الشاشة متوقّعة الفشل الكامل عند التشغيل الفعلي

`open-items-report-api.ts:104-118` — `listAgingRows()`:
```ts
let query = supabase
  .from("open_items_view")
  .select(`
    journal_line_id, entry_no, entry_date, party_type, party_id,
    account_code, account_name, cost_center_code, open_amount, due_date,
    source_invoice_id,
    customers ( name_ar ),
    vendors ( name_ar )
  `)
  .gt("open_amount", 0)
  .order("due_date", { ascending: true, nullsFirst: false });
```
صيغة `customers ( name_ar )`/`vendors ( name_ar )` هي "تضمين علاقة مُضمَّنة" بـPostgREST، وتتطلب **حتماً** قيد مفتاح أجنبي (FK) فعلياً بقاعدة البيانات يربط عمود بـ`open_items_view` (أو الجدول المصدر الذي يُشتق منه العمود عبر تتبّع PostgREST لأصل الأعمدة بالـviews) بـ`customers.id`/`vendors.id` — بدونه PostgREST لا يملك أي طريقة لتحديد شرط الـJOIN تلقائياً.

**تتبّع `party_id` إلى أصله:** العمود يُضاف بـ`database/patch_journal_dimensions.sql:26-27`:
```sql
alter table public.journal_entry_lines
  add column if not exists party_id uuid null;
```
**بلا أي `references`** — تحقّقت بحث شامل بكل `database/*.sql` عن أي `references public.customers`/`references public.vendors` مرتبط بـ`party_id` فلم أجد شيئاً إطلاقاً. `open_items_view` نفسها (`patch_settlement_foundation.sql:130`) تمرر `jel.party_id` كما هو بلا أي تحويل. وهذا منطقي بنيوياً: `party_id` عمود **متعدد الأشكال (polymorphic)** — يشير لعميل **أو** مورد حسب قيمة `party_type` المرافقة (`journal_entry_lines_party_type_check`, `patch_journal_dimensions.sql:23-24`) — وSQL القياسي لا يسمح بقيد FK شرطي واحد يشير لجدولين مختلفين حسب عمود آخر؛ التصميم نفسه يمنع وجود FK حقيقي هنا مهما حاولت.

**الأثر الفعلي المتوقَّع:** أي طلب PostgREST يحتوي تضمينَي `customers(...)`/`vendors(...)` بدون FK قابل للحل سيرفضه PostgREST بخطأ من فئة "Could not find a relationship between 'open_items_view' and 'customers' in the schema cache" (الكود المعياري `PGRST200`). دالة `isMissingView()` بنفس الملف (`open-items-report-api.ts:6-8`) تتحقق فقط من `42P01`/`PGRST205` (جدول/عرض غير موجود) — **لا تغطي `PGRST200` إطلاقاً**. النتيجة: الخطأ يمر بشرط `if (error) throw new Error(error.message)` (سطر 122) مباشرة، فيصل لـ`page.tsx:45-50` كرسالة خطأ خام (على الأرجح نص إنجليزي تقني من PostgREST) تُعرض للمحاسب بدل أي محتوى — **الشاشة بكاملها (كلا وضعي العرض: "مجمّع حسب الطرف" و"تفصيلي") لا تعمل إطلاقاً**، وليس فقط "اسم الطرف مفقود". هذا استنتاج مبني على تتبّع بنيوي مباشر لتعريف العمود وسلوك PostgREST الموثَّق (لا FK = لا تضمين ممكن بأي إصدار)، وليس افتراضاً نظرياً.

## 2. 🔴 حتى لو أُصلح البند 1 (مثلاً بإضافة أعمدة `customer_id`/`vendor_id` منفصلتين بدل `party_id` واحد)، الأرقام المعروضة تخلط عملات بلا أي فصل أو تحذير

`open_amount` المُستخدَم مباشرة بهذا التقرير (`open-items-report-api.ts:113` بالاستعلام، و`page.tsx:87، 148، 155، 206-207، 212، 266` بالعرض) هو نفسه عمود `open_items_view.open_amount` الموثَّق بتدقيق الحركات المفتوحة (`2026-07-25-open-movements-audit.md` البند 1) كونه يُحسب من `jel.debit`/`jel.credit` **الخام** (وليس `debit_base`/`credit_base`) مطروحاً منه `voucher_allocations.applied_amount` **بعملة السند المخصِّص لا بعملة السطر المستهدف**، بلا أي `where jel.currency_id = ...`. هذا التقرير يُفاقم المشكلة أكثر من شاشة الحركات المفتوحة لأنه **يجمع** `open_amount` عبر عشرات السطور لكل طرف ولكل فئة عمر (`summarizeByBucket()`, `summarizeByParty()`, `open-items-report-api.ts:158-197`) وصولاً لـ"الإجمالي" الكلي بأعلى الشاشة (`page.tsx:86-89`, `grandTotal`). لا `currency_id`/`currency_code` بنوع `AgingOpenItemRow` (`open-items-report-api.ts:17-31`) ولا بأي عمود بالجدول — **عميل له فاتورتان مفتوحتان بعملتين مختلفتين (دولار ودينار مثلاً) ستُجمعان رقمياً كأنهما نفس العملة** بعمود "الإجمالي" وبكل بطاقات الأعمار العلوية، بلا أي وسيلة للمستخدم لاكتشاف الخلط.

## 3. 🟠 لا فصل واضح بين "ذمم مدينة" و"ذمم دائنة" عند اختيار "الكل" — قد تُجمع في رقم واحد مضلِّل

`partyFilter` بقيمة `"all"` (`page.tsx:26, 40`) يُرسل `partyType: undefined` فيعرض **كل** الحركات المفتوحة (عملاء وموردين معاً) بنفس الجدول/الملخص. `grandTotal` (`page.tsx:86-89`) يجمع `open_amount` لكل الصفوف **بلا تمييز اتجاه** (مدين لعميل مقابل دائن لمورد) وبلا عكس إشارة أحدهما — يعني اختيار "الكل" ينتج "إجمالي" واحد يخلط ذمماً مدينة بذمم دائنة كأنهما نفس الطبيعة المحاسبية (على الأقل بمنطق الجمع البسيط؛ لا خطأ بالتصنيف نفسه لأن `party_type`/عمود "النوع" بجدول "مجمّع حسب الطرف" يُظهران التمييز الصحيح للقارئ اليقظ لكل صف على حدة — لكن **الرقم الإجمالي المجمَّع بالأعلى وبكل بطاقة عمر لا يفصل الاتجاهين**). لمحاسب يفتح الشاشة على وضع "الكل" (وهو خيار متاح افتراضياً بالقائمة)، هذا يُنتج انطباعاً برقم "صافي مركز" غير موجود فعلياً بهذا الشكل.

## 4. 🟠 لا فحص صلاحية على مستوى الصفحة — الاعتماد الكامل على RLS بـ`using(true)`

`page.tsx` (كامل الملف) لا يستدعي `hasPermission`/`PermissionGate`. الاستعلام هنا (خلافاً لتقريري المبيعات/المشتريات) **ليس** عبر RPC بـ`security definer` بل استعلام مباشر على `open_items_view` (`security_invoker = true`, `patch_settlement_foundation.sql:105`) — فتُطبَّق RLS الفعلية لجداول `journal_entry_lines`/`journal_entries` تحت المستخدم الحالي. لكن هذي السياسات نفسها `using (true)` بلا أي شرط دور/فرع (`database/02_rls.sql:71-90`) — أي أن أي مستخدم مسجّل دخول يرى كل الذمم لكل الفروع بلا استثناء، بنفس نمط الفجوة الموثَّق بمعظم تدقيقات اليوم الأخرى.

## 5. 🟡 لا حد أقصى (Limit) على الاستعلام — يجلب كل حركة مفتوحة بكل الفروع دفعة واحدة

`listAgingRows()` (`open-items-report-api.ts:104-119`) بلا `.limit()` إطلاقاً — نفس فجوة تقرير الحركات المفتوحة (المسار الاحتياطي هناك على الأقل يضع حد 500). مع نمو عدد الحركات المفتوحة تاريخياً، هذا يجلب كل شيء دفعة واحدة للمتصفح قبل حتى تجميعه محلياً بحسب الطرف/الفئة العمرية.

## 6. 🟡 لا تصدير CSV ولا طباعة — غياب واضح مقارنة بتقريري المبيعات/المشتريات الشقيقين

`sales-lines`/`purchase-lines` كلاهما يستخدمان `ExportCsvButton`/`PrintReportButton` (موجودان فعلياً كمكوّنين مشتركين جاهزين، `web/src/components/export-csv-button.tsx`, `print-report-button.tsx`). هذا التقرير **لا يستوردهما ولا يستخدمهما إطلاقاً** — لا زر تصدير ولا زر طباعة بكامل `receivables-aging/page.tsx`. لتقرير محاسبي بطبيعته (أعمار ذمم) يُفترض تصديره لمراجعة/متابعة تحصيل خارج الشاشة، هذا نقص وظيفي واضح وغير متّسق مع نمط التقارير المجاورة له مباشرة بنفس المجلد.

## 7. 🟡 لون "متأخر" بالجدول التفصيلي يستخدم لون Tailwind خام بدل متغيّر النظام التصميمي `var(--danger)`

`page.tsx:256-260`:
```tsx
{row.days_overdue != null && row.days_overdue > 0 && (
  <span className="block text-rose-700">+{row.days_overdue} يوم</span>
)}
```
يستخدم `text-rose-700` (لون Tailwind ثابت) بدل `var(--danger)` المُعرَّف بـ`web/src/app/globals.css` والمُستخدَم فعلياً بنفس الشاشة لرسالة الخطأ العامة (`page.tsx:163`: `text-[var(--danger)]`) وبتقريري المبيعات/المشتريات. عدم اتساق بصري صغير لكنه يعني أن أي تعديل مستقبلي لدرجة لون "الخطر" بالنظام التصميمي (متغيّر CSS مركزي) لن ينعكس هنا تلقائياً.

## 8. حساب فئات الأعمار (Buckets) — صحيح رياضياً، بلا أخطاء حدود ملحوظة

`classifyAgingBucket()` (`open-items-report-api.ts:56-70`): `days <= 0` → `current`، `days <= 30` → `days_1_30`، `days <= 60` → `days_31_60`، `days <= 90` → `days_61_90`، وإلا `days_90_plus`. هذي حدود قياسية صحيحة (1-30 / 31-60 / 61-90 / +90) بلا تراكب أو فجوة بين الفئات — **لا خلل هنا**. ملاحظة ثانوية بلا أثر عملي: تاريخ المرجع `referenceDate = new Date()` يعتمد على تاريخ **متصفح المستخدم المحلي**، بينما أعلام `is_overdue`/`is_eligible_for_payment` بنفس `open_items_view` (غير المُستخدَمة بهذا التقرير أصلاً) تُحسب من `current_date` **بالخادم** — لا تعارض فعلي هنا لأن هذا التقرير لا يستخدم أعلام الخادم إطلاقاً، لكنها نقطة تناسق يجدر ذكرها لو استُخدمت لاحقاً معاً.

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **إصلاح بنية `party_id`/الربط بالعميل والمورد جذرياً** — الحل الأنظف: إضافة عمودين منفصلين حقيقيين (`customer_id`, `vendor_id`) بـ`journal_entry_lines` مع FK فعلي لكل منهما (يُملأ أحدهما فقط حسب `party_type` عبر قيد `CHECK`)، وتحديث `open_items_view` لتصديرهما، ثم تعديل `.select()` هنا لتضمين `customers!customer_id(name_ar)`/`vendors!vendor_id(name_ar)`. بديل أسرع بلا تعديل بنية: استبدال التضمين المُضمَّن بجلب يدوي لأسماء الأطراف (استعلامين منفصلين `.in('id', partyIds)` على `customers`/`vendors` بعد جلب `open_items_view`، ودمجهما بـJS) — يتجنّب مشكلة PostgREST كلياً بلا تغيير مخطط قاعدة البيانات. **هذا يمنع الشاشة من العمل إطلاقاً بوضعها الحالي.**
2. **معالجة `PGRST200` صراحة بـ`isMissingView()`** (أو معادلها) لإظهار رسالة عربية واضحة ("تعذّر ربط الطرف — راجع تعريف `open_items_view`") بدل رسالة PostgREST الخام الحالية، كإجراء دفاعي إضافي حتى بعد إصلاح البند 1.
3. **إصلاح خلط العملات بـ`open_items_view`** (مشتركة مع توصية تدقيق الحركات المفتوحة #1) — استخدام `debit_base`/`credit_base` أو تحقق `currency_id` صريح، لأن هذا التقرير يُضاعف أثر الخلط عبر التجميع بالفئات والطرف والإجمالي الكلي.

### 🟠 عالٍ

4. **فصل إجمالي "الكل" إلى عمودين منفصلين** (إجمالي ذمم مدينة، إجمالي ذمم دائنة) بدل رقم واحد مجمَّع عند اختيار `partyFilter = "all"`.
5. **إضافة فحص صلاحية** بالواجهة على الأقل (`PermissionGate`)، بانتظار إصلاح شامل لسياسات RLS على مستوى الفرع/الدور.

### 🟡 متوسط

6. **إضافة حد أقصى (Limit/Pagination)** على `listAgingRows()`.
7. **إضافة `ExportCsvButton`/`PrintReportButton`** لمطابقة نمط التقارير الشقيقة.
8. **استبدال `text-rose-700` بـ`var(--danger)`** لسطر "الأيام المتأخرة" بالجدول التفصيلي.

## ملحق — ملفات مرجعية رئيسية

- `web/src/app/reports/receivables-aging/page.tsx` — الشاشة كاملة، المرشِّحات (105-138)، بطاقات الأعمار (140-158)، جدول "مجمّع حسب الطرف" (171-222)، جدول "تفصيلي" (223-285).
- `web/src/modules/reports/services/open-items-report-api.ts` — `listAgingRows()` مع التضمين المكسور (94-141)، `classifyAgingBucket()` (56-70)، `summarizeByBucket`/`summarizeByParty` (158-197)، `isMissingView()` بلا تغطية `PGRST200` (6-8).
- `database/patch_journal_dimensions.sql:22-27` — تعريف `party_type`/`party_id` بلا أي FK.
- `database/patch_settlement_foundation.sql:104-172` — `open_items_view` الفعّالة (خلط العملة سطر 137-138، `party_id` سطر 131).
- `database/02_rls.sql:71-90` — سياسات `journal_entries`/`journal_entry_lines` بـ`using(true)`.
- `web/src/app/globals.css` — `var(--danger)`، فئات `.btn`/`.btn-outline`.
- تقرير مرجعي مكمِّل: `audit-reports/2026-07-25-open-movements-audit.md` (نفس `open_items_view`، مسار شاشة مختلف).
