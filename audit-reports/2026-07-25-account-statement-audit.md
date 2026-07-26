# تدقيق دقيق — كشف الحساب (Account Statement)

> **حالة المعالجة (2026-07-26):** #1 `.limit(5000)` بلا ترتيب ✓ — ترتيب زمني قبل الحد + تنبيه `truncated` بالواجهة؛ روابط مصدر الفواتير ✓. فلترة الفرع وصلاحية الصفحة (عبر `ReportsAccessGate`) عولجت جزئياً؛ السعر الحي لعملة ثالثة لا يزال مفتوحاً.

منهجية: قراءة الكود الفعلي (TypeScript) — الشاشة `web/src/app/reports/account-statement/page.tsx`، مكوّن العرض `web/src/modules/accounts/components/account-statement-section.tsx`، طبقة الحساب `web/src/modules/reports/utils/account-statement-utils.ts`، والدالة الفعلية التي تجلب وتحسب البيانات: `voucherApi.listAccountStatement()` بـ`web/src/modules/vouchers/services/voucher-api.ts:397-784`. **لا توجد دالة SQL/RPC لكشف الحساب إطلاقاً** (تم التحقق بالبحث عن `account_statement`/`get_account_statement` بكامل `database/setup_all.sql` — لا نتيجة) — كل الجلب والحساب (رصيد افتتاحي، رصيد جارٍ، إجماليات) يتم على طبقة الواجهة مباشرة عبر استعلامات Supabase الخام على `journal_entry_lines`/`journal_entries`/`vouchers`. الاعتماد على `database/setup_all.sql` كناتج البناء الفعلي حسب `database/build_setup_all.ps1` بخصوص جداول/RLS/فهارس `journal_entries`/`journal_entry_lines` المُستهلَكة هنا. لا يُعاد اشتقاق مشكلة السعر الحيّ العامة الموثّقة بـ`audit-reports/2026-07-25-currencies-audit.md §4` (بطاقة الحساب، ميزان المراجعة) — لكن **يُثبَت هنا وجود نفس النمط بملف لم يُغطَّ هناك** (`account-statement-utils.ts`)، بصفته سؤالاً صريحاً بنطاق هذا التدقيق.

---

## 1) `.limit(5000)` صامت بلا ترتيب مسبق — بتر بيانات غير حتمي وأرقام إجمالي/رصيد جارٍ خاطئة بلا أي تحذير للمستخدم

**المكان:** استعلام الأسطر الرئيسي لكشف الحساب (`web/src/modules/vouchers/services/voucher-api.ts:558-565`):

```ts
let query = supabase
  .from("journal_entry_lines")
  .select(
    "id, account_id, debit, credit, debit_base, credit_base, currency_id, exchange_rate, line_description, cost_center_id, cost_centers(code, name_ar), journal_entries!inner(id, entry_no, entry_date, description, status, source_type, source_id)",
  )
  .in("account_id", scopedAccountIds)
  .eq("journal_entries.status", "posted")
  .limit(5000);
```

لا يوجد `.order(...)` قبل `.limit(5000)` — الترتيب الزمني (`rawLines.sort(...)`, السطر 604-614) يحدث **بعد** الجلب، على المجموعة المبتورة فعلاً. بما أن الاستعلام لا يحدد ترتيباً صريحاً لـPostgREST قبل التقطيع، فإن الـ5000 سطر المُعادة ليست بالضرورة الأقدم زمنياً ولا أي مجموعة حتمية أخرى — قد تُستبعد أسطر عشوائياً من أي نقطة بالفترة المطلوبة.

**الأثر:** لأي حساب/فترة تتجاوز 5000 حركة مرحّلة (متوقّع فعلياً لحسابات نشاط يومي مثل الصندوق أو المبيعات مع تراكم البيانات — النظام يسجّل قيداً لكل عملية بيع/سند)، تُصبح: (أ) قائمة الحركات المعروضة ناقصة بصمت، (ب) `total_debit`/`total_credit`/`closing_balance` بأسفل الجدول **خاطئة رياضياً** (مجموع 5000 سطر فقط لا كل حركات الفترة)، (ج) الرصيد الجاري (`running_balance`) لكل سطر لاحق للنقطة المبتورة خاطئ تراكمياً. لا رسالة تحذير، لا مؤشر "تم بتر النتائج"، لا أي دليل بالواجهة (`AccountStatementResult` بـ`accounts/types` لا يحمل أي حقل `truncated`/`hasMore`) — تم التحقق بالبحث الكامل بالملف عن أي منطق يقارن `data.length` بـ`5000` أو يحذّر المستخدم؛ لا يوجد. هذا يعني احتمال عرض رصيد ختامي خاطئ لحساب فعلي بثقة كاملة وكأنه صحيح.

**ملاحظة مقارنة:** استعلام الرصيد الافتتاحي (السطر 499-514، `entry_date < fromDate`) لا يحمل `.limit()` صريحاً على الإطلاق — قد يخضع بصمت لحد Supabase/PostgREST الافتراضي على مستوى المشروع (`db-max-rows`، شائع أن تكون قيمته الافتراضية 1000) دون أي طريقة للتحقق من كود المستودع وحده. **يحتاج تأكيد فعلي** (تشغيل استعلام مباشر بحساب يحمل أكثر من 1000 حركة تاريخية قبل تاريخ معيّن ومقارنة الرصيد الافتتاحي الناتج بالحساب اليدوي) — لكن إن صحّ، فالأثر أخطر من بند `.limit(5000)` أعلاه لأنه يصيب "الرصيد الافتتاحي" نفسه الذي تُبنى عليه كل الحركات اللاحقة.

---

## 2) عمود "المصدر" لا يربط إلا بالسندات — قيود الفواتير المرحّلة تظهر بلا أي رابط رغم توفّر كل البيانات اللازمة

**المكان:** خلية "المصدر" بجدول كشف الحساب (`web/src/modules/accounts/components/account-statement-section.tsx:378-397`):

```tsx
{line.source_type === "voucher" && line.source_id ? (
  <Link href={`/vouchers/${line.source_id}`}>...</Link>
) : (
  <span className="text-xs text-slate-500">—</span>
)}
```

**لماذا هذه فجوة حقيقية لا افتراض:** `journal_entries.source_type` يأخذ فعلياً القيمة `'invoice'` — تأكيد مباشر من `post_invoice()` (آخر نسخة نافذة، `setup_all.sql:19220-19234`):

```sql
insert into public.journal_entries (
  entry_no, entry_date, description, status, source_type, source_id, branch_id
) values (
  v_entry_no, v_inv.invoice_date, ..., 'posted', 'invoice', ...
```

وصفحة تفاصيل فاتورة موجودة وجاهزة فعلاً بالمسار `web/src/app/invoices/[id]/page.tsx`. بل إن `journal_entry_lines` نفسه يحمل عموداً أكثر تحديداً لهذا الغرض تحديداً: `source_invoice_id` (`setup_all.sql:3740-3741, 3753-3754`: *"FK إلى invoices"*) — **لكن الاستعلام بـ`voucher-api.ts:558-565` لا يجلب `source_invoice_id` من `journal_entry_lines` أصلاً**، ويعتمد فقط على `journal_entries.source_type`/`source_id` (مستوى القيد لا السطر) الذي يُعامَل بالواجهة فقط عند `'voucher'`.

**الأثر:** أي كشف حساب لحساب متأثر بفواتير مرحّلة (مبيعات، مشتريات، ذمم عملاء/موردين — من أكثر أنواع الحسابات استخداماً فعلياً) يُظهر عمود "المصدر" فارغاً (`—`) لكل تلك الحركات، رغم أن الرابط المباشر للفاتورة الأصلية متاح فنياً وجاهز، وهذا يخالف صراحة الحاجة الأساسية لكشف حساب: تتبّع كل حركة إلى مصدرها.

---

## 3) لا فلترة بالفرع (`branch_id`) — نفس الفجوة الموثّقة بتقرير ميزان المراجعة، لكن بمسار كود مختلف كلياً

**المكان:** لا فرصة إطلاقاً بأي من استعلامي `voucher-api.ts:listAccountStatement` (الرصيد الافتتاحي 499-514، الأسطر الرئيسية 558-576) لتصفية بـ`branch_id`، ولا فلتر فرع بواجهة `account-statement/page.tsx`. العمودان `journal_entries.branch_id`/`journal_entry_lines.branch_id` موجودان ومُفهرَسان ومُوثَّقان بالتعليق أنهما "للتقارير" (`setup_all.sql:3912-3923`؛ التفاصيل الكاملة بتقرير ميزان المراجعة المرافق، البند 1) — غير مستخدَمين هنا أيضاً، رغم أن `voucherApi.listAccountStatement` مسار كود منفصل تماماً (استعلامات Supabase مباشرة لا استدعاء RPC) فليست فجوة موروثة آلياً من نفس الدالة، بل فجوة مستقلة يتوجّب سدّها بمكانين منفصلين.

**الأثر:** كشف حساب لحساب مشترك بين فروع (مثل حساب بنكي مركزي تُرحَّل عليه قيود من فروع متعددة عبر `journal_entry_lines.branch_id` الموصوف بأنه *"أساس المقاصة بين الفروع"*) لا يمكن تصفيته لفرع واحد لمعرفة مساهمة كل فرع بحركة الحساب.

---

## 4) لا فحص صلاحية على استعلام كشف الحساب ولا على الصفحة — اعتماد كامل على RLS المفتوح لجداول القيود والسندات

**المكان:** `web/src/app/reports/account-statement/page.tsx` لا يستدعي `hasPermission`/`has_permission` بأي مكان (تحقّق كامل بالبحث بالملف). بما أن `voucherApi.listAccountStatement` يستخدم استعلامات `.from(...)` مباشرة لا RPC، الحماية الوحيدة هي RLS على `journal_entry_lines`/`journal_entries`/`accounts`/`vouchers`/`cost_centers` — وكلها سياسات `select ... using(true)` بلا قيد (`setup_all.sql:2738-2777, 2938-2941`). لا يوجد مفتاح صلاحية `reports.*` بجدول الصلاحيات أصلاً (نفس النتيجة الموثّقة بتقرير ميزان المراجعة).

**الأثر:** أي مستخدم مسجّل دخول يستطيع طلب كشف حساب كامل التفاصيل (حتى بيانات وصفية حساسة كالبيان ومركز الكلفة ورقم القيد) لأي حساب بالنظام — بما فيها حسابات الرواتب أو حسابات الشركاء إن وُجدت — بلا أي فحص صلاحية مخصص لهذه الشاشة تحديداً.

---

## 5) تحويل العملة لعرضٍ بعملة ثالثة يعتمد دائماً السعر **الحيّ**، لا سعر تاريخ الحركة — نفس نمط الخلل الموثَّق بتقرير العملات، لكن بملف لم يُغطَّ هناك

**السياق:** `resolveStatementLineAmounts()` (`web/src/modules/reports/utils/account-statement-utils.ts:22-168`) يتعامل بشكل صحيح مع حالتين: عملة العرض = عملة السطر نفسه (بلا تحويل، صحيح) وعملة العرض = العملة الأساسية (يستخدم `debit_base`/`credit_base` المحفوظتين تاريخياً وقت الترحيل، صحيح — هذا أفضل من وضع "base" بميزان المراجعة الذي كان يحوّل مضاعفاً قبل إصلاحه). **لكن** عند اختيار عملة عرض **ثالثة** (لا هي عملة السطر ولا الأساس — سيناريو واقعي: حساب دولاري، والمحاسب يختار عرض الكشف باليورو)، يستخدم دوماً سعر الصرف **الحيّ** لعملة العرض:

```ts
// account-statement-utils.ts:89-97 — تحويل من الأساس (تاريخي) إلى عملة ثالثة بسعرها الحيّ
return {
  debit: debitBase > 0
    ? convertAmount(debitBase, 1, params.displayCurrency.exchange_rate)
    : 0,
  ...
```

وبالمثل بمسار الأسطر بلا `currency_id` صريح (أسطر أساسية العملة عملياً بحساب أجنبي): `account-statement-utils.ts:139-157` يحوّل عبر `convertAmount(nativeDebit, accountCurrency.exchange_rate, params.displayCurrency.exchange_rate)` — **كلا السعرين حيّان دائماً**، بصرف النظر عن `entry_date` الحركة الفعلي، رغم أن `currencyApi.getExchangeRateAtDate()` جاهزة وتُستخدم فعلياً بمسار إدخال السند (`voucher-currency-utils.ts:39`، كما وثّق تقرير العملات).

**النص المُضلِّل بالواجهة:** المكوّن نفسه يعرض جملة توحي بالدقة التاريخية: *"حركات السندات تُعرض بسعر الصرف المحفوظ على السند؛ القيم بالعملة الأساسية من القيد المرحّل"* (`account-statement-section.tsx:242-245`) — هذه الجملة **صحيحة فقط** عند عملة العرض = عملة السطر أو الأساس؛ تصبح غير دقيقة تماماً بمجرد اختيار عملة عرض ثالثة، دون أي تمييز بالنص بين الحالتين.

**الأثر:** كشف حساب لفترة منتهية قبل أشهر، بعملة عرض غير عملة الحساب وغير الأساس، يُظهر أرقاماً مبنية على سعر اليوم لا سعر تلك الفترة — قد يكون الفرق جوهرياً مع تحرّك سعر الصرف، بينما النص المرافق بالواجهة يوحي بعكس ذلك تماماً.

---

## 6) تضارب تصميمي: أزرار وصندوق خطأ بمكوّن كشف الحساب يتجاوزان نظام التصميم المشترك

**المكان:** `web/src/modules/accounts/components/account-statement-section.tsx`:
- زر "كل الفترة" (`السطر 200-206`): `className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"` بدل `.btn .btn-outline`.
- زر "تحديث" (`السطر 207-214`): `className="rounded-md bg-blue-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"` بدل `.btn .btn-primary`.
- صندوق رسالة الخطأ (`السطر 231-235`): `className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"` بدل `text-[var(--danger)]` المستخدَمة بنفس الصفحة الأم مباشرة (`account-statement/page.tsx:248`) وبصفحة ميزان المراجعة الشقيقة (`trial-balance/page.tsx:487`).

**بالمقارنة:** نفس الصفحة الحاوية (`account-statement/page.tsx`) تستخدم `.btn .btn-sm .btn-outline` بشكل صحيح لأزرارها الخاصة (رابط "ميزان المراجعة"، "نسخة في تبويب جديد" — السطر 229-236)، ما يُظهر أن المكوّن الفرعي `AccountStatementSection` تحديداً هو من يخرج عن النمط المُتّبع بالصفحة الحاضنة له نفسها، لا أن غياب `.btn` عام بالمشروع.

---

## 7) لا طباعة/تصدير، ولا فهرسة كافية لحجم البيانات — نفس فجوتَي ميزان المراجعة

بالبحث الكامل بملفات هذا التقرير عن `print`/`export`/`csv`/`xlsx`: لا نتيجة — لا وسيلة تصدير كشف الحساب. وبما أن الاستعلامات هنا تُصفّي مباشرة على `journal_entries.status`/`entry_date` (بلا فهرس، انظر تقرير ميزان المراجعة البند 6) **إضافة** لغياب فهرس مركّب `(account_id, entry_date)` على `journal_entry_lines` (الفهرس الوحيد المتاح أحادي العمود: `idx_journal_lines_account_id`، `setup_all.sql:385`) — فإن هذا التقرير أكثر تأثراً بالأداء من ميزان المراجعة لأنه يجلب كل سطر تفصيلي فعلياً إلى المتصفح (لا تجميع SQL بالخادم كما بـ`get_trial_balance`) ويُشغّل حسابات الرصيد الجاري بالكامل بجافاسكربت من جانب العميل.

---

## ملخّص الفجوات

| # | الملاحظة | الموقع | الخطورة |
|---|---|---|---|
| 1 | `.limit(5000)` بلا ترتيب مسبق ولا تحذير — بتر بيانات صامت وأرقام إجمالي/رصيد جارٍ خاطئة للحسابات عالية الحركة | `voucher-api.ts:558-565` | 🔴 حرج |
| 1ب | استعلام الرصيد الافتتاحي بلا `.limit()` صريح — قد يخضع لحد PostgREST افتراضي صامت (يحتاج تأكيد) | `voucher-api.ts:499-514` | 🟠 عالٍ (تأكيد مطلوب) |
| 2 | عمود "المصدر" يربط بالسندات فقط؛ قيود الفواتير (`source_type='invoice'`، تُنشأ فعلياً) بلا رابط رغم توفر `source_invoice_id` وصفحة `/invoices/[id]` | `account-statement-section.tsx:378-397`, `setup_all.sql:19220-19234` | 🟠 عالٍ |
| 3 | لا فلترة بالفرع رغم عمود `branch_id` مخصَّص "للتقارير" | `voucher-api.ts:397-784` | 🟠 عالٍ |
| 4 | لا فحص صلاحية على استعلام/صفحة كشف الحساب؛ لا صلاحية `reports.*` بالنظام | `voucher-api.ts:397-784`, `account-statement/page.tsx` | 🟠 عالٍ |
| 5 | تحويل عملة ثالثة (غير عملة السطر وغير الأساس) بسعر حيّ لا تاريخي؛ نص الواجهة يوحي بخلاف ذلك | `account-statement-utils.ts:89-103, 139-157`, `account-statement-section.tsx:242-245` | 🟠 عالٍ |
| 6 | أزرار/صندوق خطأ بـ`AccountStatementSection` يتجاوزان `.btn`/`var(--danger)` رغم استخدامهما الصحيح بالصفحة الحاضنة نفسها | `account-statement-section.tsx:200-214, 231-235` | 🟡 متوسط |
| 7 | لا طباعة/تصدير؛ لا فهرسة مركّبة `(account_id, entry_date)` على `journal_entry_lines`، ولا فهرس على `journal_entries.entry_date`/`status` | — | 🟡 متوسط |

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **أزل `.limit(5000)` أو حوّله لصفحات (pagination) حقيقية** بترتيب صريح (`.order("journal_entries.entry_date")`) قبل أي تقطيع، مع رفع تحذير واضح بالواجهة عند بلوغ الحد الأقصى ("تم عرض أول N حركة من أصل أكثر — ضيّق نطاق التاريخ"). إجماليات/رصيد جارٍ لا يجوز حسابهما أبداً على مجموعة مبتورة بصمت.

### 🟠 عالٍ

2. **تحقّق فوراً** إن كان استعلام الرصيد الافتتاحي (بند 1ب) يتأثر بحد PostgREST افتراضي (فحص إعدادات `db-max-rows` بمشروع Supabase، أو اختبار يدوي بحساب يحمل أكثر من 1000 حركة قبل تاريخ معيّن) — إن صحّ، طبّق نفس إصلاح البند 1.
3. **اجلب `source_invoice_id`/`source_type`/`source_id` من كلا المصدرين (سطر وقيد) واربط `source_type === 'invoice'` بـ`/invoices/[id]`** بنفس نمط رابط السند الحالي.
4. **أضف فلتر فرع** لاستعلامَي الرصيد الافتتاحي والأسطر الرئيسية بنفس التوصية الواردة بتقرير ميزان المراجعة.
5. **أضف فحص صلاحية `reports.view`** (بعد استحداثها) على مستوى الصفحة، وقيّد RLS الجداول المُستهلَكة هنا بفحص صلاحية بدل `using(true)` المطلق.
6. **مرّر `entry_date` الحركة إلى `getExchangeRateAtDate()`** عند التحويل لعملة عرض ثالثة (غير عملة السطر وغير الأساس) بدل `displayCurrency.exchange_rate` الحيّ دوماً، أو على الأقل عدّل نص التنبيه بالواجهة (`account-statement-section.tsx:242-245`) ليوضّح أن هذه الحالة تحديداً تستخدم سعر اليوم لا سعر تاريخ الحركة.

### 🟡 متوسط

7. **استبدل تصميم الأزرار وصندوق الخطأ بـ`AccountStatementSection`** بـ`.btn`/`.btn-primary`/`.btn-outline`/`var(--danger)` ليطابق الصفحة الحاضنة له.
8. **أضف تصدير CSV/Excel** لكشف الحساب، وفهرس مركّب `(account_id, journal_entry_id)` أو ما يعادله زمنياً على `journal_entry_lines`، وفهرس `journal_entries(status, entry_date)`.

## ملحق — ملفات مرجعية رئيسية

- `web/src/modules/vouchers/services/voucher-api.ts:397-784` — `listAccountStatement()` الكاملة: استعلام الرصيد الافتتاحي (499-556)، الاستعلام الرئيسي مع `.limit(5000)` (558-576)، حساب الرصيد الجاري والإجماليات جانب العميل (644-784).
- `web/src/modules/reports/utils/account-statement-utils.ts` — `resolveStatementLineAmounts()` (22-168، منطق تحويل العملة بالسعر الحيّ لعملة ثالثة عند 89-103, 139-157).
- `web/src/modules/accounts/components/account-statement-section.tsx` — عرض الجدول، رابط "المصدر" (378-397)، الأزرار غير المتوافقة مع نظام التصميم (200-214, 231-235).
- `web/src/app/reports/account-statement/page.tsx` — الشاشة الحاوية، منطق عملة العرض الافتراضية (102-107، سبب البند 3 بتقرير ميزان المراجعة).
- `database/setup_all.sql` — إنشاء قيد الفاتورة بـ`post_invoice()` (19220-19234، آخر نسخة نافذة)، `journal_entry_lines.source_invoice_id` (3740-3741, 3753-3754)، `branch_id` على القيد/السطر "للتقارير" (3912-3923, 3737-3763)، RLS الجداول المُستهلَكة (2738-2777, 2938-2941)، فهرس `journal_entry_lines.account_id` الوحيد المتاح (380-385).
- تقارير ذات صلة: `audit-reports/2026-07-25-currencies-audit.md` (نمط السعر الحيّ العام)، `audit-reports/2026-07-25-trial-balance-audit.md` (التقرير الشقيق — نفس فجوتَي الفرع والصلاحية بمسار كود مختلف).
