# تدقيق دقيق — دليل الحسابات (Chart of Accounts)

منهجية: قراءة الكود الفعلي (SQL + TypeScript) لكل ملفات `web/src/app/accounts/**` و`web/src/modules/accounts/**`، وتتبّع ترتيب تطبيق الـpatches الحقيقي عبر `database/build_setup_all.ps1` — `database/setup_all.sql` هو المصدر المُعتمَد لأن دوال مثل `bulk_create_accounts()` أُعيد تعريفها أكثر من مرة عبر ملفات مختلفة، والنسخة الفعّالة هي آخر تعريف حسب ترتيب البناء وليس أول نتيجة بحث نصي. تم تصفّح `audit-reports/2026-07-22-accounts-vouchers-audit.md` و`AUDIT_FINDINGS.md`/`AUDIT_FINDINGS_PENDING.md` مسبقاً لتفادي تكرار ما وُثِّق هناك (هرمية `parent_id`/`level`، `is_postable`، منع الحذف، غياب `account_type`/`is_system`، RLS مفتوحة عموماً على `accounts`) — هذا التقرير يركّز على ما لم يُغطَّ سابقاً: مسار الاستيراد الجماعي، الفرق بين نموذج الإضافة الفردية والجماعية، وبطاقة/تعديل الحساب بالواجهة.

## 1. `bulk_create_accounts()` — دالة SECURITY DEFINER بلا أي فحص صلاحية

الدالة معرّفة مرتين: أولاً في `01_schema.sql` (تظهر بـ`setup_all.sql:2325`)، ثم يُعاد تعريفها حرفياً بنفس المحتوى ضمن `patch_voucher_atomic_ops.sql` (تظهر بـ`setup_all.sql:9723`، تبدأ كتلة الباتش في `setup_all.sql:9586`) — وهذه الأخيرة هي النسخة الفعّالة حسب ترتيب `build_setup_all.ps1` (الباتش رقم 33 في القائمة). كلا التعريفين متطابقان تماماً، فلا تغيير وظيفي بين النسختين، لكن كلاهما يحمل نفس الثغرة:

- الدالة `security definer` (`setup_all.sql:9726`) — أي أنها تُنفَّذ بصلاحيات مالك الدالة، متجاوزةً RLS تماماً على جدول `accounts` بغضّ النظر عمّا تنص عليه سياساته.
- **لا يوجد أي استدعاء لـ`has_permission('accounts.create')` داخل الدالة** — بعكس دوال أخرى بالمشروع (مثل `delete_voucher_with_journal`) التي تتحقق من الصلاحية داخلياً رغم كونها `security definer`.
- لا `grant execute` مخصّص يقيّدها؛ الصلاحية الافتراضية (`PUBLIC`) على الدوال في Postgres تبقى سارية لأي دور `authenticated` (فقط `anon` سُحبت منه صلاحية التنفيذ عموماً عبر `patch_revoke_anon_table_access.sql:18`).

النتيجة: أي مستخدم `authenticated` — حتى من لا يملك مفتاح `accounts.create` في نموذج الصلاحيات — يستطيع استدعاء `supabase.rpc('bulk_create_accounts', {...})` مباشرة من الـdevtools لإدراج حسابات جديدة بالجملة، **بغضّ النظر عن أي تشديد مستقبلي لسياسات RLS** لأن الدالة تتجاوزها أصلاً بحكم `security definer`. هذا أخطر من فجوة RLS العامة الموثّقة سابقاً لأنه يبقى قائماً حتى لو أُصلحت تلك الفجوة.

## 2. فشل الدفعة كاملة عند تصادم كود واحد (لا معالجة استثناءات)

`bulk_create_accounts()` (`setup_all.sql:9723-9779`) تُنفَّذ كحلقة `for ... loop` واحدة داخل استدعاء دالة واحد، بلا كتلة `exception` لالتقاط تصادم `unique` على `accounts.code` وتخطّي الصف المتعارض فقط. أي صف واحد يصطدم بكود مكرر (مثلاً بسبب حساب أُنشئ من تبويب آخر بين لحظة توليد الأكواد بالواجهة ولحظة الإرسال) **يُسقط المعاملة بالكامل** — فتفشل كل الدفعة (قد تصل حتى 200 صف حسب `BULK_ACCOUNT_IMPORT_MAX_ROWS`)، وليس فقط الصف المتعارض.

هذا يتناقض مع مسار الإضافة الفردية: `createAccountWithGeneratedCode()` (`web/src/modules/accounts/utils/create-account-with-code.ts:28-69`) يتعامل مع هذا السيناريو تحديداً عبر إعادة محاولة تلقائية حتى 8 مرات عند اكتشاف `isDuplicateAccountCodeError`. الاستيراد الجماعي لا يملك أي آلية مكافئة — تعليق الدالة نفسه بـ`setup_all.sql:9814` يقول صراحة "الأكواد تُحسب مسبقاً بالواجهة" (client-computed)، أي أن الافتراض التصميمي هو ثقة كاملة بأن اللقطة (`snapshot`) المحسوبة لحظة الفتح ستبقى صحيحة حتى لحظة الإرسال، بلا أي تحقق ذرّي نهائي أو إعادة محاولة على مستوى القاعدة.

## 3. غياب فحص تكرار الاسم العربي كليّاً داخل `bulk_create_accounts`

بخلاف مسار الإضافة الفردية بالواجهة (`web/src/app/accounts/page.tsx:178-186` يستخدم `normalizeArabicForComparison` لمنع اسم مكرر) وبخلاف التحقق الأمامي في نافذة الاستيراد الجماعي نفسها (`bulk-import-accounts.ts:130-163` يفحص التكرار ضمن الدفعة ومقابل الموجود)، فإن الدالة الخلفية `bulk_create_accounts()` **لا تفرض أي قيد فريد أو تحقق على `name_ar`** (`accounts.name_ar` بلا `unique` بالمخطط `01_schema.sql:52`). التحقق من تكرار الاسم بالكامل يقع في طبقة الواجهة فقط؛ أي استدعاء مباشر للـRPC (نفس ثغرة القسم 1) يتجاوز هذا التحقق تماماً ويستطيع إدراج حسابات بأسماء عربية مكررة حرفياً.

## 4. بحث شجرة الحسابات لا يوحّد أشكال الحروف العربية، خلافاً لفحص التكرار

`nodeMatchesQuery()` (`web/src/modules/accounts/utils/account-tree.ts:125-134`) يقارن نص البحث بـ`.toLowerCase()` فقط (لا تأثير فعلي على العربية). أما فحص تكرار الاسم عند الإنشاء فيستخدم `normalizeArabicForComparison()` (`web/src/modules/accounts/utils/normalize-arabic-text.ts`) الذي يوحّد الألف (أ/إ/آ/ٱ ← ا) والياء/الهمزة (ى/ؤ/ئ) ويحذف التشكيل. النتيجة: البحث عن "احمد" لن يجد حساباً اسمه "أحمد" رغم أن نظام منع التكرار يعتبرهما نفس الاسم — تناقض بين أداتين تفترضان نفس "توحيد النص" لكن إحداهما فقط تطبّقه فعلياً. أثر عملي: مستخدم قد يظن أن الحساب غير موجود عبر البحث بينما محاولة إنشائه ستُرفض لاحقاً بسبب "الاسم موجود مسبقاً".

## 5. أزرار نوافذ الحسابات تخرج عن نظام التصميم المشترك

المشروع يملك نظام أزرار موحّد (`web/src/app/globals.css:123-176` — `.btn`, `.btn-primary`, `.btn-outline`, `.btn-sm`) تستخدمه صفحات مثل `cost-centers/page.tsx` و`currencies/page.tsx` بانضباط. لكن نماذج الحسابات الثلاثة التالية تُعيد اختراع الأزرار يدوياً بألوان Tailwind خام بدل الكلاسات المشتركة:

- `web/src/modules/accounts/components/account-form.tsx:239-254` — زر الإلغاء `rounded-md border border-slate-300...` وزر الإرسال `rounded-md bg-blue-900...` بدل `btn`/`btn-primary`.
- `web/src/modules/accounts/components/account-edit-modal.tsx:225-242` — نفس النمط تماماً.
- `web/src/modules/accounts/components/account-bulk-import-modal.tsx:283-314, 430-455` — كل أزرار شريط الأدوات («لصق من Excel»، «تحميل قالب»، «+ صف»، «مسح الكل») وأزرار «تحقق»/«استيراد» بأسفل النافذة، جميعها بألوان يدوية (`bg-blue-900`, `border-amber-300 text-amber-900`...) بدل `btn-outline`/`btn-primary`.

هذا لا يكسر الوظيفة، لكنه يعني أن أي تعديل مستقبلي على هوية الألوان (`--brand-navy` مثلاً) بملف `globals.css` **لن ينعكس** على نوافذ الحسابات هذه لأنها لا تستخدم المتغيرات أصلاً — عكس ما يحدث في صفحتَي مراكز الكلفة والعملات.

## ملخّص الفجوات

| # | الملاحظة | الموقع | الخطورة |
|---|---|---|---|
| 1 | `bulk_create_accounts()` بلا `has_permission('accounts.create')`، و`security definer` يتجاوز RLS كلياً | `setup_all.sql:9723-9781` | 🔴 حرج |
| 2 | فشل الدفعة الجماعية كاملة عند تصادم كود واحد — لا معالجة استثناءات لكل صف | `setup_all.sql:9740-9779` | 🟠 عالٍ |
| 3 | لا فحص تكرار اسم عربي على مستوى القاعدة في `bulk_create_accounts` (التحقق UI-only) | `setup_all.sql:9723-9781` + `bulk-import-accounts.ts:130-163` | 🟠 عالٍ |
| 4 | بحث شجرة الحسابات لا يوحّد أشكال الألف/الهمزة خلافاً لفحص التكرار عند الإنشاء | `account-tree.ts:125-134` | 🟡 متوسط |
| 5 | نوافذ الحسابات (إضافة/تعديل/استيراد جماعي) تُعيد اختراع الأزرار بدل `.btn`/`.btn-primary`/`.btn-outline` | `account-form.tsx:239-254`, `account-edit-modal.tsx:225-242`, `account-bulk-import-modal.tsx` | 🟡 متوسط |

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **أضف `if not public.has_permission('accounts.create') then raise exception ... end if;` داخل `bulk_create_accounts()`** — بنفس نمط `delete_voucher_with_journal()`. بما أنها `security definer`، هذا هو المكان الوحيد الذي يمكن أن يفرض الصلاحية فعلياً؛ الاعتماد على RLS وحده لا يجدي هنا لأنها تتجاوزه أصلاً.

### 🟠 عالٍ

2. **لفّ حلقة الإدراج داخل `bulk_create_accounts()` بمعالجة استثناء لكل صف** (`begin ... exception when unique_violation then ...`) بحيث يُرجع للواجهة قائمة الصفوف الناجحة والفاشلة معاً بدل إسقاط الدفعة كاملة على أول تصادم — أو، كحدّ أدنى، أعد توليد الكود من داخل الدالة نفسها (وليس فقط من لقطة الواجهة) مع إعادة محاولة، أسوة بما يفعله `createAccountWithGeneratedCode()` للإضافة الفردية.
3. **أضف فحص تكرار `name_ar` (بعد توحيد النص) داخل `bulk_create_accounts()` نفسها**، وليس فقط بالواجهة — يمكن استدعاء نفس منطق `normalizeArabicForComparison` بمكافئ SQL (`unaccent`/`translate`) أو تمرير الاسم الموحَّد جاهزاً من الواجهة والتحقق منه بالدالة.

### 🟡 متوسط

4. **وحّد أداة البحث في الشجرة مع منطق فحص التكرار** — مرّر نص البحث عبر `normalizeArabicForComparison` (أو نسخة مبسّطة منها) قبل المقارنة في `nodeMatchesQuery`، حتى لا يختلف سلوك "البحث" عن سلوك "منع التكرار" على نفس البيانات.
5. **استبدل الأزرار اليدوية في `account-form.tsx`/`account-edit-modal.tsx`/`account-bulk-import-modal.tsx` بكلاسات `.btn .btn-primary` / `.btn .btn-outline` / `.btn .btn-sm`** لتتماشى مع بقية الشاشات (`cost-centers/page.tsx`, `currencies/page.tsx`) وتستفيد تلقائياً من أي تحديث مستقبلي لمتغيرات الهوية البصرية.

## ملحق — ملفات مرجعية رئيسية

- `database/setup_all.sql` — `accounts`/`cost_centers` (309-341)، RLS الحسابات (2730-2739)، `bulk_create_accounts()` الفعّالة ضمن `patch_voucher_atomic_ops.sql` (9723-9781، الكتلة تبدأ 9586).
- `database/patch_revoke_anon_table_access.sql` — سحب صلاحية `anon` فقط؛ `authenticated` تبقى بصلاحية `PUBLIC` الافتراضية على الدوال.
- `web/src/app/accounts/page.tsx` — تدفّق الإضافة/التعديل/التفعيل، فحص تكرار الاسم عند الإنشاء (178-186).
- `web/src/modules/accounts/utils/create-account-with-code.ts` — آلية إعادة المحاولة عند تصادم الكود (الإضافة الفردية فقط).
- `web/src/modules/accounts/utils/bulk-import-accounts.ts` — تحقق الواجهة للدفعة (تكرار اسم، كود أب، عملة) — لا مقابل له بقاعدة البيانات.
- `web/src/modules/accounts/utils/account-tree.ts` — منطق البحث والتصفية بالشجرة.
- `web/src/modules/accounts/utils/normalize-arabic-text.ts` — توحيد النص العربي (يُستخدم جزئياً فقط).
- `web/src/app/globals.css` — تعريف `.btn`/`.btn-primary`/`.btn-outline` (123-176).
- `web/src/components/modal.tsx` — الحاوية المشتركة للنوافذ (الأزرار الداخلية غير موحّدة رغم ذلك).
