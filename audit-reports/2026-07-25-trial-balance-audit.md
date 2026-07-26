# تدقيق دقيق — ميزان المراجعة (Trial Balance)

> **حالة المعالجة (2026-07-26):** #1 فلتر فرع ✓ (`p_branch_id` + واجهة). #2 صلاحية ✓ (`assert_can_view_reports` / `ReportsAccessGate`). رابط كشف العملة وفرق القيد الافتتاحي ما زالا مفتوحين كتحسينات.

منهجية: قراءة الكود الفعلي (SQL + TypeScript) — الشاشة `web/src/app/reports/trial-balance/page.tsx`، طبقة العرض `web/src/modules/reports/utils/trial-balance-utils.ts`، ودالة `get_trial_balance()` كما تُستدعى فعلياً عبر `voucherApi.listTrialBalanceRows` (`web/src/modules/vouchers/services/voucher-api.ts:934-958`). الاعتماد على `database/setup_all.sql` كناتج البناء الفعلي حسب `database/build_setup_all.ps1` — بما أن `get_trial_balance` مُعاد تعريفها (`create or replace`) ثلاث مرات في الملفات المصدر (`01_schema.sql`, `patch_trial_balance_opening.sql`)، فآخر نسخة تفوز حسب ترتيب دمج الباتشات، وهي الموجودة عند `setup_all.sql:6387-6501` (تعليق التوثيق عندها يؤكد أنها فعلاً الأخيرة: "opening_entry_balance منفصل عن حركة الفترة"). لا تُعاد مسألتا خلط عملة الحساب/الأساس (✓ محلولة) ولا مشكلة السعر الحيّ بوضع `native`/`all` (موثّقة بـ`audit-reports/2026-07-25-currencies-audit.md`) — التركيز هنا على ما لم يُغطَّ بالتقريرين.

---

## 1) لا فلترة بالفرع (`branch_id`) رغم وجود عمود مخصّص صراحة "للتقارير" لم يُستخدم قط هنا

**المكان:** توقيع `get_trial_balance()` (`setup_all.sql:6387-6394`) لا يملك أي معامل `p_branch_id`، ولا تُصفّي أي من `scoped_accounts`/`line_agg` (`setup_all.sql:6412-6478`) حسب فرع، ولا يُعاد أي عمود `branch_id` بالنتيجة.

**لماذا هذه فجوة حقيقية لا نظرية:** `journal_entries.branch_id` أُضيف صراحة تحت عنوان القسم "توسيع journal_entries — فرع اختياري على مستوى القيد **(للتقارير)**" (`setup_all.sql:3912-3917`)، وتعليق العمود نفسه يقول حرفياً: *"فرع القيد — اختياري؛ التفصيل per سطر في journal_entry_lines"* (`setup_all.sql:3919-3920`). وعمود `journal_entry_lines.branch_id` (مُفهرَس عند `setup_all.sql:3758-3759`) موصوف بأنه *"أساس المقاصة بين الفروع"* (`setup_all.sql:3749-3750`) — أي عمود عامل فعلياً في منطق التسوية بين الفروع، وليس بقايا غير مستخدمة. بل إن دالة تقرير أخرى بنفس الملف، `get_open_items()` (`setup_all.sql:3874-3907`)، **تستخدم فعلياً** `p_branch_id`/`oi.branch_id` للفلترة (`setup_all.sql:3898`) — ما يثبت أن النمط المتوقع بهذا الجزء من النظام هو تمرير فلتر فرع بكل دالة تقرير، وأن ميزان المراجعة استُثني منه سهواً لا تصميماً.

**الأثر:** لا توجد أي طريقة بالواجهة (لا فلتر، لا حتى عمود معروض) لعرض ميزان مراجعة فرع واحد بمعزل عن بقية الفروع؛ أي شركة متعددة الفروع تحصل دائماً على أرقام مُجمَّعة على مستوى الشركة كلها بلا استثناء، رغم أن العمود اللازم لذلك موجود ومُفهرَس ومُوثَّق أنه "للتقارير" تحديداً.

---

## 2) لا فحص صلاحية على `get_trial_balance()` ولا على صفحة التقرير؛ لا توجد صلاحية "reports.*" بالنظام أصلاً

**المكان:** الدالة `language sql stable set search_path = public` (`setup_all.sql:6408-6410`) — **ليست** `security definer`، وبلا أي `if not public.has_permission(...)`. لا يوجد `grant`/`revoke execute` خاص بها بأي مكان بـ`setup_all.sql` (تم التأكد بالبحث)، فتبقى صلاحية `EXECUTE` الافتراضية لـ`PUBLIC` سارية (نفس الآلية الموثّقة بـ`audit-reports/2026-07-25-currencies-audit.md §2` لـ`update_currency_exchange_rate`/`set_base_currency` — فقط `anon` سُحبت صلاحيته عبر `patch_revoke_anon_table_access.sql`، لا `authenticated`).

بالمقابل، الحماية الوحيدة المتوقعة هي RLS على `accounts`/`journal_entries`/`journal_entry_lines` — وكلها `using(true)` بلا قيد (`setup_all.sql:2738-2777`؛ نفس النمط "using(true) بلا فحص صلاحية" الموجود بمعظم وحدات النظام حسب تدقيق اليوم).

**على مستوى الواجهة:** `web/src/app/reports/trial-balance/page.tsx` لا يستدعي `hasPermission`/`has_permission` بأي مكان (تم التحقق بالبحث الكامل بالملف) — على خلاف `accounts/page.tsx`, `cost-centers/page.tsx`, `currencies/page.tsx`, `vouchers/page.tsx` وغيرها التي تُخفي/تُعطّل أزرارها حسب الصلاحية. لا يوجد أصلاً أي مفتاح صلاحية باسم `reports.*` أو مشابه بجدول الصلاحيات المزروع بـ`setup_all.sql` (تم التحقق بالبحث عن `'reports.` — لا نتائج).

**الأثر:** أي مستخدم مسجّل دخول — حتى موظف POS بلا أي صلاحية محاسبية مُسندة له — يستطيع استدعاء `supabase.rpc('get_trial_balance', ...)` مباشرة أو فتح `/reports/trial-balance` ورؤية الوضع المالي الكامل للشركة (كل الحسابات، كل الفترات، بلا أي قيد).

---

## 3) رابط "كشف" من ميزان المراجعة لا يمرّر عملة العرض — كشف الحساب المفتوح يعرض رقماً مختلفاً عمّا كان ظاهراً لتوّه

**المكان:** بناء رابط "كشف" لكل صف (`web/src/app/reports/trial-balance/page.tsx:512-520`):

```ts
const statementHref = buildUrlWithQuery("/reports/account-statement", {
  accountId: row.account_id,
  from: fromDate || undefined,
  to: toDate || undefined,
  costCenterId: costCenterId || undefined,
});
```

لا يُمرَّر `currency` إطلاقاً. وصفحة كشف الحساب، عند غياب `currency` من الرابط، **لا تفتح دائماً بعملة الحساب المعروض بميزان المراجعة** — بل بالعملة الأساسية دوماً: `web/src/app/reports/account-statement/page.tsx:102-107` يضبط `displayCurrencyId` على العملة الأساسية كلما كان `initial.displayCurrencyId` فارغاً، بصرف النظر عن عملة الحساب نفسه.

**الأثر الملموس:** محاسب يعرض ميزان المراجعة بالوضع الافتراضي "كل العملات (عملة كل حساب)" ويرى حساباً دولارياً برصيد ختامي مثلاً `$ 1,250.00`، يضغط "كشف" لهذا الحساب — تُفتح صفحة كشف الحساب بعملة العرض = العملة الأساسية (دينار)، فيظهر رقم إجمالي مختلف كلياً (بالدينار) بلا أي تنبيه أن العملة تغيّرت، وقد يُفسَّر خطأً كخطأ حسابي بين التقريرين بدل كونه فرق عملة عرض فقط. يتطلب الأمر تدخّلاً يدوياً من المستخدم لإعادة اختيار الدولار من قائمة "عملة العرض" بصفحة الكشف للتحقق من التطابق.

---

## 4) لا تطابق مضمون بين إجمالي الفترة بميزان المراجعة وإجمالي كشف الحساب لنفس الحساب/الفترة عندما يقع تاريخ القيد الافتتاحي داخل الفترة المطلوبة

**السياق:** `get_trial_balance()` يستثني أي قيد `is_opening_entry = true` من `period_debit`/`period_credit` **دائماً وبصرف النظر عن تاريخه** — يُحسب حصراً ضمن `opening_entry_balance` (`setup_all.sql:6440-6446` مقابل `6456-6473`؛ الشرط `not coalesce(je.is_opening_entry, false)` موجود بكل حالات `period_debit`/`period_credit`).

كشف الحساب (`voucherApi.listAccountStatement`, `web/src/modules/vouchers/services/voucher-api.ts:558-576`) **لا يستثني** `is_opening_entry` إطلاقاً من استعلام السطور الرئيسي — يجلب كل الأسطر المرحّلة بالفترة `[fromDate, toDate]` بلا فرز حسب هذا الحقل. فإن كان القيد الافتتاحي مؤرَّخاً **ضمن** الفترة المطلوبة (سيناريو شائع: محاسب يحدد `fromDate` = بداية السنة المالية، وهو نفسه تاريخ القيد الافتتاحي المُدخَل عبر `web/src/modules/opening-entry/components/opening-entry-voucher-form.tsx`)، فسيظهر ضمن `period_debit`/`period_credit`/سطور الجدول بكشف الحساب كحركة عادية، بينما ميزان المراجعة يستبعده دوماً من عمودَي "مدين الفترة"/"دائن الفترة" ويضعه بعمود "رصيد افتتاحي" المنفصل بدل ذلك — فيختلف مجموع "مدين الفترة + دائن الفترة" بين التقريرين لنفس الحساب/نفس الفلاتر تحديداً في هذه الحالة.

**الأثر:** فرصة تطابق فاشلة تحديداً في أول تقرير يُشغَّله محاسب بعد إدخال القيد الافتتاحي (السيناريو الأكثر شيوعاً لاستخدام الميزات معاً)، لا سيناريو نادر.

---

## 5) لا طباعة ولا تصدير (Excel/CSV/PDF) لميزان المراجعة إطلاقاً

تم التحقق بالبحث الكامل بـ`web/src/app/reports/trial-balance/page.tsx` عن أي إشارة لـ"طباعة"/"تصدير"/`print`/`export`/`csv`/`xlsx` — لا نتيجة واحدة. التقرير قابل للعرض على الشاشة فقط (مع رابط "نسخة في تبويب جديد" الذي يشارك فلاتر الرابط لا محتوى مطبوعاً). لتطبيق محاسبي فعلي يُستخدم يومياً، غياب أي وسيلة تصدير لأهم تقرير محاسبي (لتقديمه لمراجع خارجي أو أرشفته) فجوة وظيفية أساسية، لا تحسين ثانوي.

---

## 6) لا فهرسة على `journal_entries.entry_date`/`journal_entries.status` — كل استعلام ميزان مراجعة بفلتر تاريخ يفحص الجدول كاملاً

**المكان:** فحص شامل لكل تعريفات `create index` المرتبطة بـ`journal_entries` بـ`setup_all.sql` يُظهر فهرسين فقط: `idx_journal_entries_branch_id` (`3922-3923`) و`idx_journal_entries_is_opening_entry` (`6341` تقريباً، جزئي `where is_opening_entry = true`). **لا يوجد فهرس على `entry_date` ولا على `status`** رغم أن `get_trial_balance()` يُصفّي بكلا الشرطين بكل استدعاء (`je.status = 'posted'`، `je.entry_date < / >= / <= p_from_date/p_to_date` — `setup_all.sql:6449-6476`)، والفهرس الوحيد المتاح لـ`journal_entry_lines` هو `account_id` (`idx_journal_lines_account_id`, `380-385`) لا يغطي فلترة التاريخ. مع نمو حجم بيانات شركة تستخدم النظام لسنوات، هذا يعني فحصاً تسلسلياً (`seq scan`) متكرراً على `journal_entries` لكل تقرير — يشترك هذا القصور مع كشف الحساب (انظر التقرير المرافق).

---

## 7) التباس تسمية "رصيد افتتاحي" مقابل "رصيد سابق" — عمودان لمفهومين مختلفين بأسماء متشابهة لغوياً

**المكان:** رأس الجدول (`trial-balance/page.tsx:496-503`) يعرض عمودين منفصلين محتملَي الظهور معاً: "رصيد افتتاحي" (`opening_entry_balance` — يظهر **دائماً**، `showOpeningEntry = true` ثابتة بالسطر 214) و"رصيد سابق" (`opening_balance` — حركة ما قبل `fromDate` باستثناء القيد الافتتاحي، يظهر فقط عند تحديد `fromDate`، `showMovementOpening = Boolean(fromDate)`).

المصطلحان بالعربية متقاربان جداً دلالياً ("افتتاحي" و"سابق" كلاهما يوحيان بـ"الرصيد قبل الفترة") لمحاسب غير مطّلع على الفرق التقني الدقيق بين "القيد الافتتاحي المُدخَل يدوياً عبر شاشة افتتاح الحسابات" و"مجموع الحركات المرحّلة قبل تاريخ البداية". لا يوجد أي تلميح/tooltip بالواجهة يوضّح الفرق — الاعتماد الكامل على فهم القارئ لمنطق النظام الداخلي.

---

## ملخّص الفجوات

| # | الملاحظة | الموقع | الخطورة |
|---|---|---|---|
| 1 | لا فلترة بالفرع رغم عمود `branch_id` مخصَّص صراحة "للتقارير" ومُستخدَم بتقرير آخر (`get_open_items`) | `setup_all.sql:6387-6501`, `3912-3923` | 🟠 عالٍ |
| 2 | لا فحص صلاحية على `get_trial_balance()` ولا بالواجهة؛ لا صلاحية `reports.*` بالنظام أصلاً | `setup_all.sql:6387-6410`, `trial-balance/page.tsx` | 🟠 عالٍ |
| 3 | رابط "كشف" لا يمرّر عملة العرض — كشف الحساب يفتح بالعملة الأساسية دوماً بصرف النظر عن عملة ميزان المراجعة المعروضة | `trial-balance/page.tsx:512-520`, `account-statement/page.tsx:102-107` | 🟠 عالٍ |
| 4 | عدم تطابق إجمالي الفترة بين التقريرين إذا وقع تاريخ القيد الافتتاحي ضمن الفترة المطلوبة | `setup_all.sql:6440-6478`, `voucher-api.ts:558-576` | 🟠 عالٍ |
| 5 | لا طباعة ولا تصدير لميزان المراجعة | `trial-balance/page.tsx` | 🟡 متوسط |
| 6 | لا فهرسة على `journal_entries.entry_date`/`status` | `setup_all.sql` (غياب) | 🟡 متوسط |
| 7 | التباس تسمية "رصيد افتتاحي" مقابل "رصيد سابق" | `trial-balance/page.tsx:496-503, 213-214` | 🔵 منخفض |

## توصيات مرتّبة حسب الأولوية

### 🟠 عالٍ

1. **أضف `p_branch_id` لـ`get_trial_balance()`** بنفس نمط `get_open_items()` (فلترة `line_agg`/`scoped_accounts` حسب `journal_entries.branch_id`/`journal_entry_lines.branch_id`)، ومرّره من فلتر جديد بالواجهة.
2. **أضف فحص `has_permission('reports.view')`** (أو ما يعادلها بعد استحداث المفتاح بجدول الصلاحيات) داخل `get_trial_balance()` نفسها، وأخفِ/عطّل الوصول لصفحة التقرير بالواجهة حسبها — بدل الاعتماد الكامل على RLS المفتوح.
3. **مرّر `currency`/`currencyMode` ضمن رابط "كشف"** بـ`buildUrlWithQuery` (`trial-balance/page.tsx:512-520`)، واجعل `account-statement/page.tsx` يحترم `initial.displayCurrencyId` القادم من الرابط بدل تجاوزه دوماً بالعملة الأساسية عند التحميل الأول.
4. **وثّق أو عالج تعارض القيد الافتتاحي**: إما استثناء `is_opening_entry` من استعلام كشف الحساب الرئيسي أيضاً (ليطابق منطق ميزان المراجعة) بحقل "رصيد افتتاحي" منفصل بكشف الحساب، أو على الأقل ملاحظة تحذيرية بالواجهتين عندما يقع تاريخ القيد الافتتاحي ضمن نطاق الفلترة.

### 🟡 متوسط

5. **أضف تصدير CSV/Excel على الأقل** لميزان المراجعة (وطباعة مهيّأة بصفحة منفصلة `@media print`)، حتى لو لم تُنفَّذ PDF كاملة.
6. **أضف فهارس** `create index on journal_entries(status, entry_date)` و`create index on journal_entry_lines(account_id, journal_entry_id)` (أو مركّب مشابه) لتفادي الفحص التسلسلي مع نمو البيانات.

### 🔵 منخفض

7. **وضّح الفرق بين "رصيد افتتاحي" و"رصيد سابق"** بعنوان عمود أدق (مثلاً "رصيد افتتاحي (قيد يدوي)" مقابل "رصيد ما قبل الفترة") أو `title`/tooltip يشرح الفرق.

## ملحق — ملفات مرجعية رئيسية

- `database/setup_all.sql` — `get_trial_balance()` (6387-6501)، إضافة `journal_entries.branch_id`/`journal_entry_lines.branch_id` "للتقارير" (3912-3923, 3737-3763)، `get_open_items()` كمرجع نمط فلترة الفرع الصحيح (3874-3907)، RLS الحسابات/القيود (2738-2777)، غياب فهارس `entry_date`/`status` على `journal_entries`.
- `web/src/app/reports/trial-balance/page.tsx` — الشاشة الكاملة؛ رابط "كشف" (512-520)؛ `showOpeningEntry`/`showMovementOpening` (213-214).
- `web/src/modules/reports/utils/trial-balance-utils.ts` — `applyTrialBalanceCurrencyDisplay` (172-234، مُعالَجة سابقاً)، `computeTrialBalanceTotals`، `aggregateTrialBalanceTree`.
- `web/src/modules/vouchers/services/voucher-api.ts:934-958` — `listTrialBalanceRows` (استدعاء RPC مباشر، بلا فلتر فرع).
- `web/src/app/reports/account-statement/page.tsx:102-107` — منطق تعيين عملة العرض الافتراضية عند غياب `currency` بالرابط (سبب البند 3).
- تقارير ذات صلة: `audit-reports/2026-07-25-currencies-audit.md` (سعر الصرف الحيّ)، `AUDIT_REPORTS.md` (خلط عملة الحساب/الأساس — محلول)، `audit-reports/2026-07-25-account-statement-audit.md` (التقرير الشقيق لهذا الملف).
