# تدقيق دقيق — القيد الافتتاحي (Opening Entry)

> **تحديث جزئي (2026-07-25):** التوصية #9 (نص «per فرع») ✓ مُغلقة. البنود الحرجة (#1 فقدان الأسطر بلا CC، #2 زر ترحيل، …) **ما زالت مفتوحة**.

منهجية: قراءة الكود الفعلي (SQL + TypeScript) لشاشتَي القيد الافتتاحي (`/vouchers/opening-entry`, `/vouchers/opening-entry/new`) ووحدة `web/src/modules/opening-entry/**` كاملة، وتتبّع ترتيب تطبيق الـpatches الحقيقي عبر `database/build_setup_all.ps1` باعتبار `database/setup_all.sql` هو المصدر المُجمَّع الفعلي (الحقيقة الأرضية) — أي دالة يعاد تعريفها أكثر من مرة عبر ملفات patch متعددة، النسخة الفعّالة هي آخر ملف يعيد تعريفها حسب ترتيب مصفوفة `$patchFiles`. هذا التقرير يُكمّل `AUDIT_PERIODS_AND_SECURITY.md` (الذي غطّى فهرس القيد الافتتاحي الفريد وRLS الفترات المحاسبية على مستوى القاعدة، وكل بنوده مُعالجة) بفحص شاشات وطبقة التحقق الأمامية (frontend) للقيد الافتتاحي تحديداً — وهي منطقة لم تُفحص سابقاً بعمق.

**نطاق الملفات المفحوصة**: `web/src/app/vouchers/opening-entry/{page,new/page}.tsx`, `web/src/modules/opening-entry/{components/opening-entry-voucher-form,services/opening-entry-api,utils/opening-entry-utils}.{ts,tsx}`, `database/patch_opening_entry.sql`, `database/patch_audit_governance_security.sql` (الفهرس المُصلَح)، `database/patch_trial_balance_opening.sql`، وربطها بـ`database/patch_period_enforcement.sql`/`patch_reverse_invoice_settlement.sql` (قفل الفترة المحاسبية الموحّد).

## 0. تحقق إيجابي — الفهرس الفريد لمنع تكرار القيد الافتتاحي سليم فعلياً

أكّدتُ أن الإصلاح الموثّق بـ`AUDIT_PERIODS_AND_SECURITY.md` (البند 2) لا يزال قائماً فعلياً بالكود الحالي، وبنسختين متطابقتين: النسخة الأصلية بـ`patch_opening_entry.sql:30-36` **حُدِّثت في مكانها** لتشمل `coalesce(branch_id, '00000000-...')`، وأُعيد تأكيدها مرة أخرى بـ`patch_audit_governance_security.sql:15-21` (نفس التعريف حرفياً، يُعاد إنشاؤه بلا تعارض). الفهرس مفروض فعلياً على مستوى القاعدة (`unique index ... where is_opening_entry = true and status = 'posted'`) — منع تكرار قيد افتتاحي مرحّل لنفس الفرع (أو بلا فرع) بنفس السنة **محمي بشكل صحيح ولا يعتمد فقط على تحقق الواجهة**.

## 1. 🔴 عطل صامت خطير: أسطر القيد الافتتاحي بلا مركز كلفة تُحذف بصمت عند الحفظ رغم عرض "متوازن ✓"

هذا أخطر اكتشاف بهذا التقرير — تتبّعت سلسلة التحقق والحفظ الكاملة سطراً بسطر:

- شاشة القيد الافتتاحي تُعيد استخدام مكوّن أسطر سند التصفية نفسه (`SettlementVoucherLinesTable`، مستورَد مباشرة بـ`opening-entry-voucher-form.tsx:15-17`) — بما فيه عمود "مركز الكلفة *" (بعلامة نجمية توحي بالإلزام).
- لكن التحقق من التوازن الخاص بالقيد الافتتاحي له دالة **منفصلة تماماً** لا تشترط مركز كلفة إطلاقاً:
  ```ts
  // opening-entry-utils.ts:11-15
  export function isValidOpeningEntryLine(line: OpeningEntryLine): boolean {
    if (!line.account_id) return false;
    if (settlementLineHasBothSides(line)) return false;
    return settlementLineHasAmount(line);   // لا فحص لـ cost_center_id
  }
  ```
  و`validateOpeningEntryBalance()` (سطر 63-79) تستخدم هذا الفلتر تحديداً لحساب "متوازن/غير متوازن" وتُفعّل شارة **"القيد متوازن ✓"** الخضراء (`opening-entry-voucher-form.tsx:504-508`) بمجرد تساوي مدين=دائن، **بصرف النظر تماماً عن وجود مركز كلفة من عدمه**.
- لكن دالة الحفظ الفعلية تستدعي مساراً مختلفاً تماماً:
  ```ts
  // opening-entry-utils.ts:37-42
  export function buildOpeningEntryLinesForSave(
    userLines: OpeningEntryLine[],
  ): VoucherLine[] {
    const validLines = userLines.filter(isValidOpeningEntryLine); // لا يشترط مركز كلفة
    return buildSettlementVoucherLinesForSave("", validLines);    // ⚠️ يُعيد الفلترة!
  }
  ```
  و`buildSettlementVoucherLinesForSave()` (من وحدة سند التصفية، `settlement-voucher-lines-table.tsx:508-522`) تُصفّي الأسطر **مجدداً** بشرط مختلف تماماً:
  ```ts
  export function isValidSettlementUserLine(line: SettlementUserLine): boolean {
    if (!line.account_id || !line.cost_center_id) return false;  // ⚠️ يشترط مركز كلفة هنا
    if (settlementLineHasBothSides(line)) return false;
    return settlementLineHasAmount(line);
  }
  ```
- **النتيجة**: أي سطر بالقيد الافتتاحي بحساب ومبلغ صحيحين لكن **بلا مركز كلفة** (وهذا متوقَّع وشائع فعلياً — قيود الافتتاح غالباً حسابات ميزانية عمومية صرفة مثل النقدية/البنك/رأس المال لا تُنسَب بالضرورة لمركز كلفة) يمرّ من فحص التوازن الأمامي بنجاح (يُحسَب ضمن المدين/الدائن، يُظهر "متوازن ✓")، **لكنه يُستبعَد بصمت بالكامل** عند `buildOpeningEntryLinesForSave()` قبل الإرسال إلى `voucherApi.replaceVoucherLines()`. لا رسالة خطأ، لا تحذير، لا استثناء — السطر يختفي فقط من البيانات المُرسَلة للقاعدة.
- **لا يوجد أي شبكة أمان أخرى توقف هذا**: لا وسم `<form>` في المكوّن (بحث كامل بالملف يؤكد غياب أي عنصر `<form>`)، وكل الأزرار `type="button"` بمعالِج `onClick` مباشر — أي أن خاصية `required` HTML الممرَّرة إلى `CostCenterSearchField` (`settlement-voucher-lines-table.tsx:273`) **بلا أي أثر فعلي**؛ لا تحقق تصديقي متصفّح (browser-native validation) يمكن أن يمنع الحفظ لأنه لا يوجد نموذج (`form`) يُرسَل أصلاً.
- **سيناريو ملموس**: محاسب يُنشئ قيداً افتتاحياً بسطرين بسيطين (نقدية مدين 1000، رأس مال دائن 1000) بلا مراكز كلفة (الحالة الطبيعية لأغلب شركات التجربة الأولى بلا مراكز كلفة مفعّلة) → يرى "القيد متوازن ✓" → يضغط "حفظ مسودة" → `syncVoucherLines()` يرسل مصفوفة **فارغة تماماً** لـ`replaceVoucherLines` → السند يُحفَظ بصفر أسطر بصمت. إذا أعاد فتح السند (وضع تعديل)، يجد الجدول فارغاً فجأة بلا أي تفسير. إن حاول "اعتماد وترحيل" (مع تفعيل الترحيل التلقائي) سيصطدم بخطأ الخادم `Cannot post empty voucher` (مُترجَم بـ"لا يمكن ترحيل سند بدون أسطر.") — رسالة مُربِكة تماماً لمستخدم متأكد من أنه أدخل سطرين متوازنين للتو.
- هذا يخالف السلوك بسند التصفية العادي (حيث نفس شرط `cost_center_id` **مطلوب ومفروض من الأصل** بواجهة التحقق الخاصة به، `settlement-voucher-form.tsx:262-271` — لا تناقض هناك). العلة تحديداً بإعادة استخدام دالة تحقق مختلفة (خاصة بالافتتاحي) مع دالة حفظ لم تُبنَ لتتوافق معها (خاصة بالتصفية).

## 2. 🔴 لا يوجد زر "ترحيل" في شاشة القيد الافتتاحي المخصَّصة — يعتمد كلياً على إعداد الترحيل التلقائي المشترك مع سند التصفية العادي

- قارنت أزرار `opening-entry-voucher-form.tsx:509-569` بأزرار `settlement-voucher-form.tsx:613-706` (المكوّن المكافئ لسند التصفية العادي، وكلاهما بنفس نموذج الصلاحيات `useVoucherFormPermissions`). سند التصفية العادي يحتوي **ثلاث** حالات أزرار: مسودة+اعتماد (مع ترحيل تلقائي اختياري)، **زر "ترحيل" منفصل** يظهر فقط عند `canPostPermission && !canEditPosted && !autoPostEnabled`، وزر تعديل المدير.
- شاشة القيد الافتتاحي تحتوي **فقط** الحالة الأولى (مسودة + اعتماد). **الكتلة الخاصة بزر "ترحيل" المستقل غائبة تماماً من الملف** (تأكّدت بقراءة كامل الملف، 573 سطراً).
- عملياً: إن كان إعداد `auto_post_enabled` لنوع السند `"settlement"` (نفس الإعداد المشترك مع سند التصفية العادي — راجع البند 4 أدناه) **مطفأً** (وهو الوضع الافتراضي الأكثر أماناً لغالب الأنظمة)، فإن أقصى ما يمكن فعله بشاشة القيد الافتتاحي المخصَّصة هو الوصول لحالة `approved` **بلا أي وسيلة لترحيله من نفس الشاشة**. زر "اعتماد" يبقى نفسه معروضاً بنفس التسمية بلا أي تغيير بعد الاعتماد (لأن الكتلة المعروضة مشروطة فقط بـ`canSave && !canEditPosted`، وليست مشروطة بالحالة الحالية)، وبلا أي رسالة توجّه المستخدم لخطوة تالية.
- **المخرج الوحيد**: الانتقال يدوياً للقائمة العامة `/vouchers` (وليس شاشة `/vouchers/opening-entry` المخصَّصة نفسها، التي لا تعرض أي إجراء ترحيل — فقط رابط "فتح" للقراءة فقط، `opening-entry/page.tsx:97-104`)، وهناك — عبر `VoucherListActions` المشترك — الضغط على "ترحيل". هذا المسار غير موثَّق بأي مكان بالواجهة، ويتطلب من المستخدم معرفة أن القيد الافتتاحي "سند تصفية" تقنياً بالخلفية.

## 3. 🟠 القيد الافتتاحي غير مُميَّز بصرياً عن سند التصفية العادي بالقائمة العامة — وهذا هو المخرج الوحيد للترحيل/الحذف

- `voucherApi.listVouchers()` (`voucher-api.ts:261-268`) **لا يفلتر ولا يُرجع `is_opening_entry`** — القيد الافتتاحي يظهر بقائمة `/vouchers` العامة مختلطاً مع كل سندات التصفية العادية، بعمود "النوع" يعرض حرفياً نفس التسمية **"تصفية"** لكليهما (`getVoucherTypeLabel(item.voucher_type)`، لا تمييز لـ`is_opening_entry`).
- بما أن هذه القائمة العامة هي المكان الوحيد الذي يحتوي فعلياً على زر "ترحيل" وزر "حذف" لسند مرحّل (البند 2)، فإن محاسباً يفلتر القائمة بـ"تصفية" (زر الفلتر الموجود بالفعل بـ`vouchers/page.tsx:139-148`) سيرى قيوده الافتتاحية مختلطة بلا أي شارة أو عمود يميّزها، معرَّضاً لخطر التعامل مع قيد افتتاحي (يحدّد كامل الأرصدة الافتتاحية لفرع/سنة) بنفس الاستهتار الذي قد يتعامل به مع سند تصفية عادي — بما في ذلك **الحذف الفعلي النهائي (hard delete) بلا فحص فترة محاسبية** الموثّق مسبقاً بالتقرير الأساسي (`2026-07-22-accounts-vouchers-audit.md`, البند #3)، الذي يصبح أثره هنا أخطر بكثير (فقدان كامل الأرصدة الافتتاحية بصمت، وليس مجرد حركة تسوية عادية).

## 4. 🟡 القيد الافتتاحي وسند التصفية العادي يتشاركان نفس سجل إعدادات النوع (`voucher_type_defaults('settlement')`)

- `opening-entry-voucher-form.tsx:275`: `voucherApi.getVoucherTypeDefaults("settlement")` — **نفس المفتاح بالضبط** المستخدَم بـ`settlement-voucher-form.tsx:388`. هذا يعني `auto_post_enabled` و`default_currency_id` مشتركان بين النوعين تماماً: لا توجد وسيلة لتفعيل الترحيل التلقائي للقيود الافتتاحية فقط (لتجاوز فجوة البند 2) دون أن يتفعّل تلقائياً أيضاً لكل سندات التصفية العادية (والعكس)، رغم أنهما تدفّقان محاسبيان مختلفان تماماً بمخاطر مختلفة تماماً (قيد افتتاحي واحد بالسنة مقابل تسويات دورية متكررة).

## 5. 🟠 عدم اتساق الصلاحيات: صفحة القيد الافتتاحي تتطلب `vouchers.create` حتى للعرض فقط

- `web/src/modules/settings/permissions/permission-utils.ts:49`: `{ prefix: "/vouchers/opening-entry", permission: "vouchers.create" }` — هذا يغطي **كلا الصفحتين**: قائمة العرض (`/vouchers/opening-entry`) وشاشة الإنشاء (`/vouchers/opening-entry/new`) بنفس الصلاحية.
- بالمقابل، `/vouchers` (القائمة العامة، حيث تظهر نفس سجلات القيد الافتتاحي فعلياً كما بالبند 3) تتطلب فقط `vouchers.view` (سطر 56 بنفس الملف).
- **النتيجة**: مستخدم لديه `vouchers.view` فقط (بلا `vouchers.create`) — دور "مُطّلِع"/مراجع مثلاً — يستطيع مشاهدة القيود الافتتاحية عبر `/vouchers?type=settlement` لكن **يُمنَع بالكامل من فتح شاشة `/vouchers/opening-entry` المخصَّصة** التي صُمِّمت أصلاً لعرضها بشكل أوضح (رقم/تاريخ/فرع/حالة/مدين). عدم اتساق واضح بين صفحتين تعرضان نفس البيانات فعلياً.

## 6. 🟡 رسالة خطأ مضلِّلة عند تكرار الترحيل من المسار غير المخصَّص

- التحقق الودود من التكرار (`openingEntryApi.assertCanPostOpeningEntry`, `opening-entry-api.ts:116-129` — استعلام أمامي بحت، وليس دالة قاعدة بيانات) يُستدعى فقط من داخل `opening-entry-voucher-form.tsx` (مباشرة قبل `saveVoucher`، وضمن `postVoucher` الممرَّرة لـ`approveWithOptionalAutoPost`).
- لكن الترحيل عبر القائمة العامة (`voucher-list-actions.tsx:112-115`) يستدعي `voucherApi.postVoucher(item.id)` **مباشرة بلا أي استدعاء لـ`assertCanPostOpeningEntry`**. إن كان القيد الافتتاحي الثاني لنفس الفرع/السنة يُرحَّل من هذا المسار، سيصطدم مباشرة بانتهاك الفهرس الفريد على مستوى القاعدة (`idx_vouchers_opening_per_branch_year`، البند 0 — الحماية الفعلية لا تزال تعمل، فلا تكرار بيانات حقيقي يحدث)، لكن رسالة الخطأ الناتجة (`duplicate key value violates unique constraint...`) تُطابَق بقائمة `ERROR_TRANSLATIONS` (`voucher-feedback-utils.ts:31`) بنمط عام: `[/duplicate key|already exists/i, "رقم أو بيانات مكررة — تحقق من رقم السند."]` — **رسالة مضلِّلة** توجّه المستخدم للتحقق من "رقم السند" رغم أن السبب الحقيقي هو وجود قيد افتتاحي آخر مرحّل لنفس الفرع/السنة، وليس تكرار رقم.

## 7. 🔵 تناسق واجهة/تصميم — الوحدة الوحيدة التي لا تستخدم رموز `.btn` المشتركة

- كل أزرار `opening-entry-voucher-form.tsx` (سطر 519, 563) وكل روابط `opening-entry/page.tsx` (سطر 51) مبنية بفئات Tailwind خام (`rounded-md border border-slate-300 px-4 py-2 text-sm`، `rounded-md bg-indigo-900 px-3 py-2 ...`) **وليس** بالفئات المشتركة `.btn`/`.btn-primary`/`.btn-outline` المستخدَمة باتساق فعلي في `settlement-voucher-form.tsx` (`btn btn-outline`, `btn btn-primary`) وبقية نماذج السندات — وهذا يعني أزرار القيد الافتتاحي لا تتّبع لون `--brand-navy` ولا ظل `--shadow-sm` الموحّدين، وتستخدم بدلاً منها لوناً "indigo" مخصَّصاً غير مرتبط بأي متغيّر CSS من `globals.css`، مختلفاً بصرياً عن بقية شاشات السندات.
- نفس النمط بشريط المعلومات العلوي: صندوق "قيد افتتاحي" (`opening-entry-voucher-form.tsx:374-380`) بألوان indigo يدوية، بينما الصندوق المكافئ بسند التصفية (`settlement-voucher-form.tsx:482-488`) بألوان blue يدوية أيضاً — لا أحدهما يستخدم متغيّرات موحّدة، لكن كل شاشة اخترعت مجموعة ألوانها الخاصة بشكل مستقل.

## 8. 🔵 علّة نص عربي/إنجليزي مختلط — ✓ مُغلق

~~«ميزانية افتتاحية per فرع» / «متوازنة per فرع».~~

**الإصلاح (2026-07-25):** «لكل فرع» في `opening-entry/page.tsx` و`opening-entry-voucher-form.tsx`.

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **إصلاح فقدان الأسطر بلا مركز كلفة عند حفظ القيد الافتتاحي** — إمّا: (أ) توحيد `isValidOpeningEntryLine` مع `isValidSettlementUserLine` بحيث يشترط الأول أيضاً `cost_center_id` إن كان مطلوباً فعلياً (ويُعرَض تحذير واضح بالواجهة قبل الحفظ بدل الفشل الصامت)، أو (ب) الأصح محاسبياً: إن كان مركز الكلفة غير ضروري فعلاً للقيد الافتتاحي، إنشاء `buildOpeningEntryLinesForSave` مستقل تماماً لا يمرّ عبر `buildSettlementVoucherLinesForSave` (الذي بُني خصيصاً لمنطق الحساب الوسيط ومركز الكلفة الإلزامي بسند التصفية)، مع تحديث عمود "مركز الكلفة *" ليصبح "مركز الكلفة (اختياري)" بجدول الأسطر عند استخدامه من شاشة القيد الافتتاحي.
2. **إضافة زر "ترحيل" مستقل بشاشة القيد الافتتاحي المخصَّصة** بنفس نمط سند التصفية العادي (`canPostPermission && !canEditPosted && !autoPostEnabled`) بدل الاعتماد الحصري على الترحيل التلقائي أو التوجّه غير الموثَّق للقائمة العامة.

### 🟠 عالٍ

3. **تمييز القيد الافتتاحي بصرياً بالقائمة العامة `/vouchers`** — عمود/شارة صريحة (`is_opening_entry`) بدل الاختفاء داخل تصنيف "تصفية" العام، خصوصاً بما أن الحذف الفعلي النهائي بلا فحص فترة محاسبية (فجوة موثّقة بالتقرير الأساسي) متاح من نفس هذه القائمة لأي سند بصلاحية `vouchers.delete` العادية.
4. **توحيد متطلبات الصلاحية بين `/vouchers/opening-entry` و`/vouchers`** — فصل صلاحية عرض القائمة (`vouchers.view`) عن صلاحية الإنشاء (`vouchers.create`) بجدول `ROUTE_PERMISSIONS`، بدل ربط الصفحة كاملة بـ`vouchers.create`.

### 🟡 متوسط

5. **فصل إعدادات النوع بين القيد الافتتاحي وسند التصفية العادي** (`auto_post_enabled`, `default_currency_id`) — سجل مستقل أو مفتاح فرعي مخصَّص، بدل مشاركة `voucher_type_defaults('settlement')` نفسه.
6. **استدعاء `assertCanPostOpeningEntry` من `voucher-list-actions.tsx`** أيضاً عند الترحيل إن كان السند `is_opening_entry`، مع إضافة نمط مطابقة مخصَّص بـ`ERROR_TRANSLATIONS` لرسالة انتهاك `idx_vouchers_opening_per_branch_year` تحديداً (بدل الرسالة العامة المضلِّلة عن "رقم مكرر").
7. **دراسة إضافة صلاحية مخصَّصة** (مثل `vouchers.opening_entry`، أو تقييدها بـ`is_admin()`) نظراً لأن ترحيل/حذف قيد افتتاحي يؤثر على كامل الأرصدة الافتتاحية لفرع/سنة — أثر أكبر بكثير من سند تسوية أو قبض/دفع عادي، رغم استخدامه لنفس صلاحيات `vouchers.create/edit/post/delete` العامة حالياً.

### 🔵 لغوي/تصميم

8. **توحيد أزرار وصناديق معلومات القيد الافتتاحي مع رموز `.btn`/`.btn-primary`/`.btn-outline` و`var(--brand-navy)` المشتركة** بدل الألوان اليدوية (indigo) المستقلة.
9. ~~**تصحيح "per فرع"**~~ — ✓ مُغلق 2026-07-25 في صفحتَي القيد الافتتاحي.

## ملحق — ملفات مرجعية رئيسية

- `web/src/modules/opening-entry/components/opening-entry-voucher-form.tsx` — النموذج الكامل (573 سطراً)؛ غياب زر الترحيل المستقل (509-569)؛ الألوان اليدوية (374-380).
- `web/src/modules/opening-entry/utils/opening-entry-utils.ts` — `isValidOpeningEntryLine` (11-15) بلا شرط مركز كلفة، مقابل `buildOpeningEntryLinesForSave` (37-42) الذي يمرّر عبر فلتر مختلف يشترطه.
- `web/src/modules/vouchers/components/settlement-voucher-lines-table.tsx` — `isValidSettlementUserLine` (77-81) و`buildSettlementVoucherLinesForSave` (508-556)، مصدر إعادة الفلترة غير المتوقَّعة.
- `web/src/modules/opening-entry/services/opening-entry-api.ts` — `assertCanPostOpeningEntry`/`hasPostedOpeningForBranchYear` (87-129)، تحقق أمامي فقط.
- `web/src/modules/vouchers/components/voucher-list-actions.tsx` — مسار الترحيل/الحذف البديل غير المخصَّص لأنواع السندات (108-140).
- `web/src/modules/settings/permissions/permission-utils.ts` — جدول `ROUTE_PERMISSIONS` (42-56)، تفاوت `/vouchers/opening-entry` مقابل `/vouchers`.
- `web/src/modules/vouchers/utils/voucher-feedback-utils.ts` — قائمة `ERROR_TRANSLATIONS` (10-42)، لا نمط مخصَّص لانتهاك فهرس القيد الافتتاحي.
- `database/patch_opening_entry.sql` — الجدول والفهرس الفريد المُصلَح (8-36)، `sync_voucher_journal_opening_flag()` (39-56).
- `database/patch_audit_governance_security.sql` — إعادة تأكيد نفس الفهرس (13-24)، تحقق إيجابي أن الإصلاح لا يزال قائماً.
- `database/patch_trial_balance_opening.sql` — فصل `opening_entry_balance` بميزان المراجعة (استخدام `is_opening_entry` بالتقارير).
- `AUDIT_PERIODS_AND_SECURITY.md` — التقرير السابق الذي وثّق إصلاح الفهرس الفريد (البند 2) وRLS الفترات المحاسبية (كل بنوده مُعالجة).
