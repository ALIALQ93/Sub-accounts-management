# تدقيق دقيق — القيود اليومية (Journals)

منهجية: قراءة الكود الفعلي (SQL + TypeScript) لشاشتي `web/src/app/journals/page.tsx` و`web/src/app/journals/[id]/page.tsx` وطبقة الخدمة `web/src/modules/vouchers/services/voucher-api.ts`، مع تتبّع مصدر الحقيقة الفعلي بقاعدة البيانات عبر `database/build_setup_all.ps1` — لأن جداول `journal_entries`/`journal_entry_lines` وسياسات RLS وتريغراتها مُعرَّفة أصلاً في `01_schema.sql`/`02_rls.sql` ثم تُوسَّع لاحقاً بعدة ملفات patch (`patch_journal_dimensions.sql`, `patch_settlement_foundation.sql`, `patch_reverse_invoice_settlement.sql`)؛ عند وجود `create or replace` متكرر لنفس الكائن، الفعّال هو آخر ملف بترتيب البناء لا أول نتيجة بحث نصي. تحققتُ أيضاً ببحث شامل (`grep`) عبر كامل `web/src` عن كل استدعاء `.from("journal_entries")`/`.from("journal_entry_lines")` للتأكد فعلياً — لا افتراضاً — من عدم وجود أي مسار كتابة من الواجهة لهذين الجدولين.

## 1. لا واجهة لإنشاء قيد يدوي حر — تأكيد مباشر، محدَّث

بحثٌ شامل عن كل استدعاء `.from("journal_entries")` أو `.from("journal_entry_lines")` في `web/src` (11 موضعاً، موزّعة على `voucher-api.ts` وملف واحد في `invoices/services/invoice-settlement-api.ts`) يُظهر أن **كل واحد منها قراءة فقط** (`select`) — لا يوجد أي `insert`/`update`/`delete` من كود TypeScript على هذين الجدولين. القيود تُنشأ حصراً عبر دوال SQL بصلاحية `SECURITY DEFINER`: تريغر ترحيل السندات (`vouchers_before_update_handle_posting`) و`post_invoice()`. **النتيجة السابقة (لا واجهة لقيد يدوي حر) لا تزال صحيحة تماماً، وتحققتُ منها هنا بفحص شامل للكود الفعلي وليس استنتاجاً.**

## 2. الشاشتان قراءة فقط، وهذا سليم معمارياً، لكن بلا أي مؤشر لهذا في الواجهة نفسها

`journals/page.tsx` و`journals/[id]/page.tsx` لا تحتويان أي زر تعديل/حذف — متّسق مع كون القيود مُشتقة آلياً. لكن لا يوجد أي نص توضيحي في الواجهة يُخبر المحاسب أن هذه شاشة "عرض فقط" وأن أي تصحيح يجب أن يمر عبر السند/الفاتورة المصدر أو عبر سند عكسي — غياب هذا التوضيح قد يُربك مستخدماً يبحث عن زر تعديل غير موجود.

## 3. RLS على `journal_entries`/`journal_entry_lines` — تحققتُ مباشرة، لا تزال مفتوحة جزئياً

`database/02_rls.sql:71-91` (لا يوجد أي ملف patch يعيد تعريف هذه السياسات — تحققتُ بـ`grep` عبر كل `patch_*.sql` ولا نتيجة):
- `select`/`insert`/`update`: `to authenticated using (true) with check (true)` — **مفتوحة بالكامل، بلا أي `has_permission()`**.
- **لا توجد سياسة `delete`** على أي من الجدولين — بما أن RLS مفعّلة (`enable row level security`, سطر 13-14) وبلا سياسة حذف، فإن **الحذف المباشر عبر عميل Supabase مرفوض افتراضياً** (نقطة إيجابية لم تكن موثّقة صراحة سابقاً لهذين الجدولين تحديداً).
- **لا يوجد أي تريغر حماية على `journal_entries`/`journal_entry_lines` مماثل لِـ`vouchers_before_update_handle_posting`/`invoices_before_update_guard`** — تحققتُ بقائمة التريغرات الكاملة (`01_schema.sql:2258-2268`): `trg_journal_entries_updated_at` (يحدّث `updated_at` فقط)، `trg_journal_lines_validate_account` (يتحقق فقط أن الحساب قابل للترحيل ونشط)، `trg_journal_entry_validate_balance` (`journal_entry_validate_balance_before_post`, `01_schema.sql:999-1025`) يفحص التوازن **فقط عند الانتقال `old.status <> 'posted' and new.status = 'posted'`**.
- **الفجوة الحرجة الفعلية**: بما أن RLS تسمح بـ`update ... using(true)` على `journal_entry_lines`، وبما أنه **لا يوجد أي تريغر يمنع تعديل أسطر قيد مرحّل مسبقاً** (خلافاً للسندات والفواتير اللتين لهما حراسة صريحة `old.status='posted'`)، فإن أي مستخدم `authenticated` يستطيع تقنياً (عبر devtools/fetch مباشر لـSupabase، متجاوزاً الواجهة تماماً) **تعديل `debit`/`credit` على سطر قيد مرحّل بالفعل دون أي اعتراض من القاعدة** — تريغر التوازن لا يُعاد فحصه لأن `status` يبقى `'posted'` (الفحص مشروط بتغيّر الحالة فقط)، فيمكن جعل القيد غير متوازن فعلياً بعد الترحيل بلا أي تنبيه. هذه فجوة أعمق من التي وُثّقت للسندات/الحسابات، لأنه هنا **لا يوجد حتى تريغر `is_admin()` جزئي** يحدّ الضرر — الحماية الوحيدة هي غياب واجهة، لا حماية قاعدة بيانات.

## 4. الدرِل-داون معطوب فعلياً لكل قيد مصدره فاتورة

`journals/[id]/page.tsx:86-94`:
```
{details.header.source_type === "voucher" &&
  details.header.source_id && (
    <DocumentActionLinks href={`/vouchers/${details.header.source_id}`} ... />
  )}
```
الرابط الوحيد المُنشأ هو لـ`source_type === "voucher"`. لكن `post_invoice()` (`database/patch_post_invoice.sql:200-219`) يُنشئ قيوداً بـ`source_type = 'invoice'` صراحة (`v_entry_no := 'JE-' || v_inv.invoice_no`, `source_type: 'invoice'`, `source_id: p_invoice_id`) — وهذا مسار كتابة فعلي وليس نظرياً، فكل فاتورة مُرحَّلة تُنتج قيداً بمصدر `invoice`. **الصفحة لا تعرض أي رابط "فتح الفاتورة المصدر" لهذه الحالة رغم توفر `web/src/app/invoices/[id]` فعلياً كمسار موجود بالتطبيق.** بما أن الفواتير على الأرجح المصدر الأكبر حجماً لقيود اليومية في نشاط تجاري حقيقي، فهذه فجوة درِل-داون تمسّ غالبية القيود لا أقلّيتها.

## 5. `source_id` يُعرض كمعرّف UUID خام بلا أي دلالة للمحاسب

`journals/page.tsx:134-136` (القائمة) و`journals/[id]/page.tsx:79-81` (التفاصيل) يعرضان `entry.source_id`/`details.header.source_id` كنص UUID خام (`font-mono`) دون أي `join` لجلب رقم السند (`voucher_no`) أو رقم الفاتورة (`invoice_no`) المقروء. عمود "المصدر" بالجدول يظهر شيئاً مثل `f47ac10b-58cc-...` بدل `RV-1006` أو رقم الفاتورة — بلا فائدة عملية لمحاسب يحاول المطابقة بالعين.

## 6. لا مؤشر على الشاشة عندما يكون القيد قد "عُكس"

عند عكس سند مرحّل عبر `reverse_posted_voucher()` (`database/patch_reverse_invoice_settlement.sql:507-516`)، يُحدَّث `vouchers.status` إلى `'cancelled'` **فقط** — **قيد اليومية الأصلي (`journal_entries` المرتبط بذلك السند) لا يُلمس إطلاقاً ويبقى `status='posted'` إلى الأبد**، وهذا صحيح محاسبياً (لا يُعاد كتابة التاريخ؛ سند/قيد عكسي منفصل يُنشأ بدلاً من ذلك ويُصفّر الأثر). **لكن** شاشة القيود لا تعرض أي إشارة تربط قيداً أصلياً بقيده العكسي (`RV-<original>-<suffix>`) — لا حقل "معكوس بواسطة"، ولا تمييز بصري. محاسب يفتح قيداً `status: posted`, `source_type: voucher` دون أن يعرف أن السند المصدر خلفه أصبح `cancelled` ومُعوَّضاً بقيد آخر — يتطلب ذلك منه فتح السند المصدر يدوياً (وحتى ذلك الرابط موجود فقط لمصدر `voucher`، انظر البند 4).

## 7. القائمة: حد أقصى 200 سطر بلا ترقيم صفحات ولا مؤشر اقتطاع

`voucher-api.ts:864-885` — `listJournalEntries()`:
```
.order("entry_date", { ascending: false }).limit(200)
```
لا `count`، لا زر "تحميل المزيد"، لا أي تنبيه للمستخدم أن النتائج قد تكون مُقتطعة. لنشاط تجاري بعمر عدة سنوات، فلترة بفترة تاريخية واسعة (أو بلا فلترة إطلاقاً كما يحدث عند التحميل الأول) يمكن أن تُخفي بصمت قيوداً أقدم ضمن أحدث 200 فقط، دون أن يعرف المحاسب أن هناك المزيد.

## 8. لا فلترة سوى بالتاريخ — لا بحث برقم القيد، الحساب، الحالة، أو نوع المصدر

`journals/page.tsx:68-99` — الفلاتر المتاحة: `من تاريخ` / `إلى تاريخ` فقط. لا مربع بحث نصي (رقم قيد، وصف)، ولا فلتر بالحالة (`draft`/`posted`/`cancelled`)، ولا فلتر بنوع المصدر (سند/فاتورة). للمقارنة، شاشة "الحركات المفتوحة" (`open-movements/page.tsx`) توفر بحثاً نصياً حراً؛ غياب أي بحث مماثل هنا غير متّسق مع بقية التطبيق ويُصعّب إيجاد قيد محدد على مستخدم يعرف رقمه فقط.

## 9. لا فهرسة على `journal_entries.entry_date` ولا `journal_entries.status`

بحث شامل عن `create index ... journal_entries` عبر `01_schema.sql` وكل `patch_*.sql` يُظهر فهرسين فقط: `idx_journal_entries_branch_id` (`patch_journal_dimensions.sql:211`) و`idx_journal_entries_is_opening_entry` (`patch_opening_entry.sql:23`). **لا يوجد فهرس على `entry_date` رغم أن `listJournalEntries()` تُرتّب وتُصفّي عليه دائماً (`order + gte/lte`)، ولا على `status` رغم أن تريغر التوازن وعدة استعلامات (بما فيها `open_items_view`) تُصفّي عليه.** `journal_entry_lines` بالمقابل مفهرس جيداً (`account_id`, `journal_entry_id`, `currency_id`, `cost_center_id`, `branch_id`, `due_date`, `party_type/party_id`, `source_invoice_id`). فجوة فهرسة محددة على جدول الرأس فقط، ستظهر تدريجياً مع نمو عدد القيود.

## 10. تفاصيل القيد: لا عرض للعملة رغم دعم `journal_entry_lines` لها

`voucher-api.ts:897-904` (استعلام أسطر القيد بالتفاصيل) يجلب فقط `id, account_id, debit, credit, line_description, cost_center_id, accounts(...), cost_centers(...)` — **لا `currency_id`, لا `exchange_rate`, لا `debit_base`/`credit_base`** رغم أن هذه الأعمدة موجودة فعلياً على `journal_entry_lines` (`01_schema.sql:102-105`). التدقيق السابق (`2026-07-22-accounts-vouchers-audit.md`, البند 8 بجدول الفجوات) وثّق أنه **لا يوجد قيد `check` يمنع خلط عملات ضمن قيد واحد عبر إدراج مباشر** — إن حدث ذلك يوماً (عبر RLS المفتوحة)، شاشة تفاصيل القيد هنا ستجمع `debit`/`credit` الخام بعملات مختلفة كأنها رقم واحد (`totals.debit`/`totals.credit` بـ`journals/[id]/page.tsx:44-49`) وتعرض "الفرق: 0.00" مضلِّلاً دون أي تحذير عملة.

## 11. تناقض تصميم بسيط: لون الخطأ

`journals/page.tsx:106` يستخدم `text-[var(--danger)]` (متّسق مع رمز التصميم المشترك بـ`globals.css`)، بينما `journals/[id]/page.tsx:57` يستخدم `text-rose-700` (لون Tailwind خام مباشر بدل متغيّر التصميم). فرق بصري طفيف بين شاشتين من نفس الوحدة الوظيفية.

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **إضافة تريغر حماية صريح على `journal_entry_lines` (وربما `journal_entries`) يمنع أي `UPDATE` على أسطر قيد ينتمي لقيد `status='posted'`** إلا عبر أعلام جلسة داخلية مضبوطة فقط من دوال `SECURITY DEFINER` الموثوقة (بنفس نمط `is_force_voucher_delete`/`is_force_voucher_reverse`) — حالياً لا يوجد أي حاجز من هذا النوع على مستوى القاعدة لهذين الجدولين تحديداً، خلافاً للسندات والفواتير.
2. **تفعيل `has_permission()` داخل سياسات RLS لـ`journal_entries`/`journal_entry_lines`** (`insert`/`update` على الأقل) بدل `using(true)` العامة — حالياً أي مستخدم `authenticated` (حتى بلا أي صلاحية كتابة بالواجهة) يستطيع تعديل مباشر عبر استدعاء API خام.

### 🟠 عالٍ

3. **إصلاح الدرِل-داون لمصدر `invoice`** — أضف نفس منطق `DocumentActionLinks` الموجود لـ`source_type === "voucher"` (`journals/[id]/page.tsx:86-94`) لحالة `source_type === "invoice"` مع رابط لـ`/invoices/${source_id}` — هذه الفجوة تمسّ غالبية القيود عملياً.
4. **استبدال عرض `source_id` الخام (UUID) برقم مستند مقروء** (`voucher_no`/`invoice_no`) عبر `join` بسيط عند الجلب في `getJournalEntryById`/`listJournalEntries`.
5. **إضافة فهرس على `journal_entries(entry_date)` و`journal_entries(status)`** — يدعمان استعلام القائمة والفرز مباشرة، وتصفية `open_items_view`/تقارير الميزان.

### 🟡 متوسط

6. **إضافة مؤشر "معكوس/مُلغى المصدر" على شاشتي القائمة والتفاصيل** — إن كان `source_type='voucher'` وحالة السند المرتبط `cancelled`، أظهر تنبيهاً واضحاً بدل ترك القيد يبدو "posted" عادياً دون سياق.
7. **إضافة ترقيم صفحات أو مؤشر عدد إجمالي** لقائمة القيود بدل `limit(200)` صامت؛ وإضافة بحث نصي (رقم قيد/وصف) وفلتر حالة/نوع مصدر، تماشياً مع نمط البحث الموجود بشاشة الحركات المفتوحة.
8. **توسيع استعلام تفاصيل الأسطر ليشمل `currency_id`/`debit_base`/`credit_base`** وعرض رمز العملة بجانب كل مبلغ، تحسباً لأي قيد مستقبلي متعدد العملات.
9. **توحيد لون رسائل الخطأ** — استبدال `text-rose-700` بـ`text-[var(--danger)]` في `journals/[id]/page.tsx:57`.

### 🔵 معماري

10. **إضافة نص توضيحي على شاشتي القيود** يوضح أنها "عرض فقط" وأن أي تصحيح يمر عبر السند/الفاتورة المصدر أو سند عكسي — يمنع لبساً لدى مستخدم يبحث عن زر تعديل غير موجود أصلاً بالتصميم.

## ملحق — ملفات مرجعية رئيسية

- `web/src/app/journals/page.tsx` — قائمة القيود، فلترة التاريخ فقط.
- `web/src/app/journals/[id]/page.tsx` — تفاصيل القيد، الدرِل-داون (86-94)، لون الخطأ (57).
- `web/src/modules/vouchers/services/voucher-api.ts` — `listJournalEntries` (864-885)، `getJournalEntryById` (887-932)، استعلامات قراءة أخرى (140-171، 494-565، 1507-1512) — كلها قراءة فقط، تحقّق شامل.
- `web/src/modules/vouchers/types.ts` — `JournalEntryListItem` (219-227)، `JournalEntryDetails` (242-245).
- `database/01_schema.sql` — تعريف `journal_entries`/`journal_entry_lines` (83-119)، تريغر التوازن (999-1025)، قائمة التريغرات الكاملة (2258-2268).
- `database/02_rls.sql` — سياسات RLS (71-91).
- `database/patch_journal_dimensions.sql` — توسعة `journal_entry_lines` وفهرستها (1-54).
- `database/patch_post_invoice.sql` — إنشاء قيد بمصدر `'invoice'` (200-219).
- `database/patch_reverse_invoice_settlement.sql` — إلغاء السند الأصلي بلا لمس قيده (507-516).
