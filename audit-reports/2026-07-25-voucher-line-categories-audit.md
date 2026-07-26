# تدقيق دقيق — إعدادات فئات سطور السندات (Voucher Line Categories Settings)

منهجية: قراءة الكود الفعلي (SQL + TypeScript) لكامل مساحة `web/src/app/vouchers/settings/**` (الإعدادات العامة للسندات + شاشة فئات الأسطر تحديداً)، وتتبّع ترتيب تطبيق الـpatches الحقيقي عبر `database/build_setup_all.ps1` باعتبار `database/setup_all.sql` هو المصدر المُجمَّع الفعلي (الحقيقة الأرضية) — أي دالة/سياسة يعاد تعريفها أكثر من مرة، النسخة الفعّالة هي آخر ملف يعيد تعريفها حسب ترتيب مصفوفة `$patchFiles`. هذا التقرير يُكمّل `2026-07-22-accounts-vouchers-audit.md` (الذي وثّق فجوة RLS المفتوحة على `accounts`/`vouchers`/`journal_entries` كنمط عام) بفحص محدَّد جدول-بجدول لكل الجداول التي تغذّي شاشتَي إعدادات السندات — وهي منطقة لم تُفحص سابقاً بالاسم.

**نطاق الملفات المفحوصة**: `web/src/app/vouchers/settings/{page,line-categories/page}.tsx`, `web/src/modules/vouchers/components/voucher-line-categories-settings.tsx`, `web/src/modules/vouchers/components/voucher-line-category-fields.tsx`, `web/src/modules/vouchers/services/voucher-line-category-api.ts`, `web/src/modules/vouchers/utils/voucher-feedback-utils.ts`، و`database/{01_schema,02_rls,patch_voucher_line_categories,patch_remove_voucher_line_category_seed}.sql`.

## 1. 🔴 RLS مفتوحة بالكامل على كل جداول إعدادات السندات الأربعة — لا علاقة فعلية بصلاحية `vouchers.settings`

فحصتُ `database/02_rls.sql:205-247` كاملاً لكل الجداول التي تغذّي شاشتَي الإعدادات — والنمط متطابق حرفياً على الأربعة:

```sql
-- voucher_settings (205-214) / voucher_number_sequences (216-225) /
-- voucher_type_defaults (227-236) / voucher_line_categories (238-247)
create policy "..._select_all" ... for select to authenticated using (true);
create policy "..._insert_all" ... for insert to authenticated with check (true);
create policy "..._update_all" ... for update to authenticated using (true) with check (true);
```

لا وجود لأي شرط `is_admin()` أو `has_permission('vouchers.settings')` داخل أي من الاثنتي عشرة سياسة. بالمقابل، الواجهة تحجب التعديل بالكامل خلف هذه الصلاحية تحديداً: `voucher-line-categories-settings.tsx` عبر `readOnly = !hasPermission("vouchers.settings")` (يُمرَّر من `line-categories/page.tsx:13`)، وكذلك `vouchers/settings/page.tsx:25` (`formDisabled = !hasPermission("vouchers.settings")`)، وحتى ظهور رابطَي القائمة نفسيهما بالشريط العلوي مقيَّد بنفس المفتاح (`web/src/config/app-navigation.ts:39,44`).

**الأثر المحاسبي الملموس** (وليس نظرياً فقط) — بما أن العميل يتصل مباشرة بـSupabase بلا طبقة API وسيطة (نمط معماري ثابت بكل التطبيق)، أي مستخدم `authenticated` — حتى بلا أي صلاحية مخصَّصة إطلاقاً — يستطيع تقنياً عبر استدعاء مباشر (console/fetch):
- تعديل `voucher_type_defaults.auto_post_enabled` لأي نوع سند إلى `true` — يُسقِط فعلياً خطوة المراجعة البشرية قبل الترحيل لكل السندات الجديدة من ذلك النوع (زر "اعتماد" يُرحّل تلقائياً، راجع `voucher-auto-post-utils.ts`).
- تغيير `voucher_type_defaults.default_account_id` (الحساب الوسيط الافتراضي لسند التصفية، أو حساب القبض/الدفع الافتراضي) لحساب مختلف تماماً — يُخطئ في كل سند جديد يعتمد على القيمة الافتراضية بصمت.
- التلاعب بـ`voucher_number_sequences.last_number`/`prefix`/`padding` — تكرار أرقام سندات أو قفزها.
- إضافة/تعديل فئات سطور (`voucher_line_categories`) — أقل خطورة محاسبياً من الثلاثة أعلاه، لكن نفس الفجوة بالضبط.

هذا امتداد مباشر لنفس النمط الموثّق عاماً بالتقرير الأساسي (البند #7 هناك: `accounts`/`vouchers`/`journal_entries`)، لكنه **لم يُذكر بالاسم لهذه الجداول الأربعة تحديداً** من قبل — وأخطرها عملياً `voucher_type_defaults` بسبب `auto_post_enabled`.

## 2. 🟠 `requires_quantity` علَم واجهة بحت — لا إنفاذ فعلي على مستوى القاعدة

- عمود `voucher_line_categories.requires_quantity` (`01_schema.sql:244`) يُستهلَك فقط بواجهة الإدخال: `voucher-line-category-fields.tsx:45-59` يُظهر حقل الكمية عند التفعيل، و`validateLineCategory()` (سطر 64-80 بنفس الملف) يرفض الحفظ أمامياً إن كانت `category_quantity` فارغة أو ≤ 0 لفئة تتطلب كمية.
- بحث شامل عبر كل ملفات SQL يؤكد: **لا يوجد أي `trigger`/`check constraint` يربط `voucher_lines.category_quantity` بـ`voucher_line_categories.requires_quantity`**. العمود غير مُشار إليه إطلاقاً خارج تعريفه وقراءته بالواجهة.
- بما أن RLS على `voucher_lines` نفسها مفتوحة أيضاً (موثّق بالتقرير الأساسي)، يمكن تقنياً إدراج سطر سند بفئة تتطلب كمية (`requires_quantity=true`) بلا `category_quantity` مباشرة عبر تجاوز الواجهة — يُقبَل، يُرحَّل، ويُنشئ قيد يومية بوصف يستبعد جزء الكمية بصمت (شرط `when vl.category_quantity is not null and vl.category_quantity > 0` بمولّد الوصف، `patch_reverse_invoice_settlement.sql:224-232`) بلا أي رفض أو تنبيه.
- هذا نمط "قيد واجهة بلا نظير خلفي" مطابق تماماً لما وُثِّق بتقريرَي سند التسوية والقيد الافتتاحي — يتكرر بثالث وحدة مستقلة.

## 3. 🟠 لا طبقة ترجمة أخطاء إطلاقاً بشاشتَي الإعدادات — رسائل Postgres/Supabase الخام تصل المستخدم حرفياً

- وحدة السندات نفسها (`voucher-feedback-utils.ts`) لديها طبقة ترجمة كاملة (`ERROR_TRANSLATIONS`, 30+ نمطاً) تُستخدَم بكل نماذج القبض/الدفع/التصفية/الافتتاحي عبر `useVoucherFeedback`.
- **شاشتا الإعدادات لا تستوردان أو تستخدمان هذه الطبقة إطلاقاً** — تحققتُ ببحث مباشر: لا وجود لـ`translateVoucherErrorMessage`/`formatVoucherError`/`ERROR_TRANSLATIONS` في أي من `voucher-line-categories-settings.tsx`، `line-categories/page.tsx`، أو `vouchers/settings/page.tsx`. كل معالجات الأخطاء بالنمط:
  ```ts
  catch (err) { setFeedback(err instanceof Error ? err.message : "فشل الإضافة."); }
  ```
  تعرض `err.message` **الخام كما هو** مباشرة بشريط التغذية الراجعة الرمادي أسفل الصفحة.
- **سيناريو قابل لإعادة الإنتاج بسهولة**: لا يوجد أي تحقق أمامي من تكرار الكود قبل الحفظ — `validateForm()` بـ`voucher-line-categories-settings.tsx:183-189` يفحص فقط أن الكود والاسم غير فارغين، **لا فحص تكرار**. الجدول له قيد فريد فعلي `unique (voucher_type, code)` (`01_schema.sql`/`patch_voucher_line_categories.sql:18`). محاسب يضيف فئة بكود مستخدَم مسبقاً لنفس نوع السند سيرى حرفياً رسالة من نوع: `duplicate key value violates unique constraint "voucher_line_categories_voucher_type_code_key"` **بالإنجليزية الكاملة، غير مفهومة لمستخدم لا يقرأ الإنجليزية بالضرورة (بحسب سياق المستخدم: محاسب وليس مبرمجاً).**

## 4. ملاحظة توثيقية — `patch_voucher_line_categories.sql` غير مستدعى من `build_setup_all.ps1`، لكن هذا سليم فعلياً وليس فجوة

- `patch_voucher_line_categories.sql` (إنشاء الجدول الأصلي) من بين الملفات "اليتيمة" غير المُستدعاة من `build_setup_all.ps1` (نفس الفئة الموثّقة عاماً بالتقرير الأساسي، البند #1) — لكن تحققتُ تحديداً أن محتواه **مدمج فعلياً وبالكامل** داخل `01_schema.sql:237-254` (تعريف الجدول والفهرس والمحفز حرفياً بنفس البنية)، فلا فجوة وظيفية هنا.
- **لكن** `patch_remove_voucher_line_category_seed.sql` (سكربت `DELETE` منفصل تماماً، يحذف فئات بذرية قديمة `PAY-FOOD`/`PAY-NUTR`/`PAY-CONST` كانت تُزرَع بإصدار سابق) هو **بطبيعته سكربت ترحيل بيانات لمرة واحدة** يُشغَّل يدوياً على قواعد بيانات موجودة مسبقاً كانت مزروعة بهذه البيانات الافتراضية القديمة — وليس جزءاً من إعادة بناء مخطط كامل من الصفر (`patch_voucher_line_categories.sql` الحالي لا يزرع أي بيانات افتراضية أصلاً: "لا بيانات افتراضية لتصنيفات الأسطر — تُعرَّف من التطبيق"، سطر 35). استبعاده من `build_setup_all.ps1` **صحيح تصميمياً** وليس نفس فئة الملفات اليتيمة الأخرى — يستحق توضيحاً بالاسم داخل تعليقات `build_setup_all.ps1` لتفادي التباس مستقبلي (لماذا هذا الملف تحديداً مختلف عن البقية)، لكنه ليس عيباً وظيفياً.

## 5. تحقق إيجابي — لا مسار حذف فعلي مكشوف، والتصميم (تعطيل بدل حذف) متّسق فعلياً

- لا زر حذف بالواجهة (`voucher-line-categories-settings.tsx` يعرض فقط "تعديل"/"تفعيل"–"تعطيل")، ولا دالة حذف مكشوفة بـ`voucher-line-category-api.ts` (فقط `listCategories`/`createCategory`/`updateCategory`).
- **مؤكَّد بمستوى القاعدة أيضاً**: لا سياسة `for delete` معرَّفة إطلاقاً على `voucher_line_categories` بـ`02_rls.sql` — RLS تمنع الحذف افتراضياً بغياب أي سياسة مطابقة، بصرف النظر عن فجوة الصلاحية ببندَي 1-2 أعلاه. حتى لو أُضيف زر حذف مستقبلاً بالخطأ، الحذف الفعلي محمي أيضاً بـ`voucher_lines.line_category_id references ... on delete restrict` (`01_schema.sql:303`) لأي فئة مستخدَمة فعلياً. **هذا الجزء من التصميم سليم فعلياً ومتّسق بين الواجهة والقاعدة** (خلافاً لبقية العمليات بهذه الوحدة).

## 6. تناسق واجهة/تصميم

- الأزرار (`btn btn-sm btn-primary`, `btn btn-sm btn-outline`) والشارات (`badge badge-success`, `badge badge-muted`) تستخدم فعلياً الفئات المشتركة من `globals.css` — **متّسقة تماماً** مع بقية التطبيق، بخلاف ما لوحظ بوحدة القيد الافتتاحي (تقرير منفصل).
- التنقّل بين الشاشتين (الإعدادات العامة / فئات الأسطر) يستخدم قائمة منسدلة موحّدة بالشريط العلوي (`app-navigation.ts:36-45`) بنفس مفتاح الصلاحية `vouchers.settings` في كل من: ظهور الرابط بالقائمة، حارس المسار (`canAccessRoute` بـ`app-shell.tsx`)، ومنطق `readOnly` داخل الصفحة نفسها — **تناسق كامل بلا أي تفاوت**، خلافاً لتفاوت `/vouchers/opening-entry` (`vouchers.create`) مقابل `/vouchers` (`vouchers.view`) الموثّق بتقرير القيد الافتتاحي.
- لا أخطاء نص عربي/إنجليزي مختلط لوحظت بهذه الشاشة تحديداً (خلافاً لعلّة "per" المتكررة بوحدتَي سند التسوية والقيد الافتتاحي).

---

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **إضافة فحص `has_permission('vouchers.settings') or is_admin()` إلى سياسات `insert`/`update` على الجداول الأربعة**: `voucher_settings`, `voucher_number_sequences`, `voucher_type_defaults`, `voucher_line_categories` (`02_rls.sql:205-247`) — أولوية عالية بالذات لـ`voucher_type_defaults.auto_post_enabled` بما أنه يتحكم مباشرة بتجاوز خطوة المراجعة البشرية قبل الترحيل لكل سند جديد من النوع المتأثر.

### 🟠 عالٍ

2. **ربط `requires_quantity` بإنفاذ فعلي على مستوى القاعدة** — إضافة `trigger` (أو `check` عبر دالة) على `voucher_lines` يرفض `insert`/`update` بسطر له `line_category_id` تشير لفئة `requires_quantity=true` بينما `category_quantity` فارغة أو ≤ 0، بدل الاعتماد فقط على `validateLineCategory()` الأمامية.
3. **استخدام طبقة `translateVoucherErrorMessage`/`ERROR_TRANSLATIONS` (أو نظيرة مخصَّصة) بشاشتَي الإعدادات** بدل عرض `err.message` الخام — مع إضافة تحقق أمامي من تكرار الكود (`voucher_type` + `code`) قبل الإرسال بـ`validateForm()` لتفادي الوصول أصلاً لرسالة قيد التفرّد الخام.

### 🟡 متوسط

4. **توضيح داخل `build_setup_all.ps1`** أن `patch_remove_voucher_line_category_seed.sql` سكربت ترحيل بيانات لمرة واحدة (وليس جزءاً من إعادة البناء الكامل)، بتعليق صريح يفرّقه عن بقية الملفات اليتيمة المدمجة فعلياً بـ`01_schema.sql`.

### 🔵 تحسين

5. لا توصيات لغوية/تصميمية لهذه الوحدة تحديداً — الاتساق البصري والنصي جيد بالفعل مقارنة بالوحدتين الأخريين المفحوصتين بهذا التدقيق.

## ملحق — ملفات مرجعية رئيسية

- `web/src/modules/vouchers/components/voucher-line-categories-settings.tsx` — واجهة الإدارة الكاملة (383 سطراً)؛ `validateForm()` بلا فحص تكرار (183-189)؛ معالجة الأخطاء الخام (201-202, 218-219, 236-237).
- `web/src/modules/vouchers/services/voucher-line-category-api.ts` — CRUD كامل (114 سطراً)، لا دالة حذف مكشوفة.
- `web/src/modules/vouchers/components/voucher-line-category-fields.tsx` — `validateLineCategory()`/`lineCategoryPayload()` (64-93)، إنفاذ أمامي فقط لـ`requires_quantity`.
- `web/src/modules/vouchers/utils/voucher-feedback-utils.ts` — طبقة `ERROR_TRANSLATIONS` الموجودة بوحدة السندات لكن غير مُستخدَمة بشاشتَي الإعدادات.
- `database/01_schema.sql` — تعريف `voucher_line_categories` المدمَج فعلياً (237-254)، `voucher_lines.line_category_id ... on delete restrict` (303).
- `database/02_rls.sql:205-247` — سياسات RLS المفتوحة بالكامل للجداول الأربعة (المصدر الأساسي لهذا التقرير).
- `database/patch_voucher_line_categories.sql` — الملف اليتيم المدمَج بالفعل بـ`01_schema.sql` (لا فجوة وظيفية).
- `database/patch_remove_voucher_line_category_seed.sql` — سكربت ترحيل بيانات لمرة واحدة، استبعاده من `build_setup_all.ps1` صحيح تصميمياً.
- `2026-07-22-accounts-vouchers-audit.md` — البند #7 (نمط RLS المفتوح العام) الذي يُبنى عليه هذا التقرير بتفصيل جداول إضافية لم تُذكر هناك بالاسم.
