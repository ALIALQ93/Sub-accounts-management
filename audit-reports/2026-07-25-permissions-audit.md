# تدقيق دقيق — الصلاحيات (Permissions)

منهجية: قراءة الكود الفعلي (SQL + TypeScript) لـ `web/src/app/settings/permissions/**`، `web/src/modules/settings/permissions/permission-catalog.ts`، `permission-utils.ts`، `web/src/modules/settings/services/permissions-api.ts`، ودوال `has_permission()`/`is_admin()` وجداول `profiles`/`user_permissions` في `database/setup_all.sql`. `database/setup_all.sql` هو المصدر المُعتمَد لأن الترتيب الفعلي للتنفيذ يحدَّده `database/build_setup_all.ps1`؛ تم التحقق (بحث نصي شامل عن `on public.profiles` و`on public.user_permissions`) من أن سياسات RLS لهذين الجدولين ودوال `is_admin()`/`has_permission()` **مُعرَّفة مرة واحدة فقط** في كتلة `02_rls.sql` (ضمن `setup_all.sql`) ولا يُعاد تعريفها في أي patch لاحق — فلا التباس بشأن "أي نسخة فعّالة" هنا، خلافاً لحالات أخرى في هذا المشروع.

السؤال الحرج المطروح لهذه الوحدة: هل يمكن لمستخدم غير مدير أن يمنح نفسه صلاحيات إضافية بالكتابة المباشرة إلى `user_permissions`؟ **الجواب: لا — جدول `user_permissions` نفسه محمي بشكل صحيح.** لكن التدقيق كشف عن ثغرة تصعيد صلاحيات (privilege escalation) حقيقية وخطيرة عبر مسار مختلف تماماً: تحديث عمود `profiles.role` مباشرة. تفاصيلها موثّقة هنا مع الإشارة الكاملة في `audit-reports/2026-07-25-users-audit.md` لأن السطح الأمامي (`/settings/users`) هو حيث تظهر.

## 1. `user_permissions` محمي بشكل صحيح — نقطة إيجابية يجب توثيقها

خلافاً لكل الجداول المدقَّقة اليوم (accounts، cost_centers، currencies، customers، vendors، voucher-settings) التي تستخدم `using(true)` بلا أي فحص، سياسات `user_permissions` (`setup_all.sql:2830-2850`) مبنية بشكل صحيح:

- `user_permissions_select` (`2830-2833`): `user_id = auth.uid() or has_permission('settings.permissions.manage')`.
- `user_permissions_insert` (`2836-2839`): `with check (has_permission('settings.permissions.manage'))`.
- `user_permissions_update` (`2841-2845`): نفس الشرط `using`/`with check`.
- `user_permissions_delete` (`2847-2850`): نفس الشرط.

أي مستخدم authenticated عادي (بلا `settings.permissions.manage`) **لا يستطيع** إدراج/تعديل/حذف أي صف في `user_permissions` — لا لنفسه ولا لغيره — عبر `supabase.from('user_permissions')` مباشرة من الواجهة أو devtools. هذا يتطابق مع طبقة التطبيق: `permissionsApi.setUserPermissions()` (`web/src/modules/settings/services/permissions-api.ts:46-72`) يعتمد كلياً على RLS دون أي دالة `security definer` تتجاوزها، وهذا هو النمط الصحيح.

## 2. لكن: مالك `settings.permissions.manage` يستطيع منح نفسه أي صلاحية أخرى بلا قيد على `user_id`

سياسة `user_permissions_insert` تتحقق فقط من صلاحية **المُنفِّذ** (`has_permission('settings.permissions.manage')`)، ولا تتحقق إطلاقاً من أن `user_id` المُدرَج يخص شخصاً آخر. أي مستخدم يملك هذه الصلاحية الواحدة فقط (وليس بالضرورة `role = 'admin'`) يستطيع تنفيذ:

```js
supabase.from('user_permissions').insert(
  ALL_PERMISSION_KEYS.map(k => ({ user_id: myOwnId, permission_key: k }))
)
```

ويمنح نفسه **كل** مفاتيح الصلاحيات دفعة واحدة (بما فيها `settings.users.manage`) — وهذا يفتح مساراً غير مباشر نحو التصعيد الكامل لدور `admin` عبر ثغرة `profiles_update_admin` الموثّقة في تقرير المستخدمين (البند الحرج رقم 1 هناك). بما أن `settings.permissions.manage` تُمنَح فقط من قِبل مدير أو مالك سابق لنفس الصلاحية (سلسلة ثقة مغلقة أصلاً)، هذا ليس ثغرة مستقلة بحد ذاتها بقدر ما هو **تأكيد أن `settings.permissions.manage` تكافئ عملياً `admin` كامل** — يجب على المدير التعامل معها بهذا المستوى من الحذر عند منحها، رغم أن تسميتها في الفهرس ("إدارة الصلاحيات التفصيلية") لا توحي بذلك الوزن.

## 3. عدم ذرّية `setUserPermissions()` (حذف ثم إدراج بطلبين منفصلين)

`permissionsApi.setUserPermissions()` (`permissions-api.ts:46-72`) ينفّذ `delete` ثم `insert` كطلبين REST منفصلين، بلا معاملة قاعدة بيانات واحدة (Supabase JS لا يدعم ذلك مباشرة على عدة جداول/طلبات). إن نجح الحذف وفشل الإدراج (مثلاً بسبب انقطاع شبكة لحظي)، يبقى المستخدم بلا أي صلاحيات مخصّصة مخزَّنة. الأثر مخفَّف جزئياً: `resolveEffectivePermissions()` (`permission-utils.ts:8-26`) يرجع تلقائياً لقالب الدور (`ROLE_PERMISSION_DEFAULTS`) عندما تكون القائمة المخزَّنة فارغة، فلا يُقفَل المستخدم كلياً، لكن أي تخصيص سابق (صلاحيات أوسع أو أضيق من قالب الدور) يضيع بصمت دون رسالة خطأ للمستخدم النهائي بأن الحفظ تم جزئياً فقط.

## 4. الواجهة الأمامية فقط: `ALL_PERMISSION_KEYS`/`PERMISSION_MODULES` كتالوج بلا أي مقابل SQL موحَّد

`permission-catalog.ts` هو مصدر الحقيقة الوحيد لأسماء مفاتيح الصلاحيات (`accounts.view`, `vouchers.post`, ...) — لا يوجد جدول SQL (enum أو reference table) يعكس هذه القائمة في قاعدة البيانات؛ `user_permissions.permission_key` هو `varchar(80)` حر بلا `check` أو `foreign key` (`setup_all.sql:429-434`). النتيجة: `sanitizePermissionKeys()` (`permissions-api.ts:17-20`) هو خط الدفاع **الوحيد** ضد إدراج مفاتيح غير صالحة، وهو تحقق واجهة أمامية بحت. مستخدم يملك `settings.permissions.manage` ويستدعي الجدول مباشرة (متجاوزاً `permissionsApi`) يمكنه إدراج أي نص عشوائي كـ`permission_key` (لا يُستخدم عملياً في أي فحص `has_permission()` لاحق لأنه لن يطابق أي مفتاح حقيقي، فالأثر محدود لتلوّث بيانات فقط) — أثر منخفض لكنه يستحق ملاحظة معمارية.

## 5. تناقض واجهة بسيط: تحذير "لن يقيّد الوصول" لحساب المدير غير دقيق تماماً

في `web/src/app/settings/users/[id]/permissions/page.tsx:197-201`، يظهر نص: "مدير النظام يملك جميع الصلاحيات تلقائياً — التعديلات هنا للتوثيق فقط ولن تقيّد الوصول." هذا صحيح طالما بقي `role = 'admin'` — لكن الرسالة لا تحذّر من الحالة المعاكسة: إن غيَّر مستخدم آخر (يملك `settings.users.manage` فقط) دور هذا الحساب لاحقاً، تصبح الصلاحيات المخصّصة المحفوظة هنا (إن وُجدت) فعّالة فجأة. ملاحظة تجميلية بحتة، لا خطورة أمنية.

## ملخّص الفجوات

| # | الملاحظة | الموقع | الخطورة |
|---|---|---|---|
| 1 | `user_permissions` RLS محمي بشكل صحيح (`has_permission('settings.permissions.manage')` على insert/update/delete) — لا ثغرة تصعيد مباشرة هنا | `setup_all.sql:2830-2850` | ✅ نقطة إيجابية (تُذكر لأهميتها) |
| 2 | `settings.permissions.manage` تسمح لحاملها بمنح نفسه أي صلاحية أخرى بلا قيد على `user_id` (تكافئ admin عملياً) | `setup_all.sql:2837-2839` | 🟠 عالٍ (تصميمي، مرتبط بثغرة حرجة في تقرير المستخدمين) |
| 3 | `setUserPermissions()` غير ذرّية (حذف ثم إدراج بطلبين) — فقدان صامت للتخصيص عند فشل جزئي | `permissions-api.ts:46-72` | 🟡 متوسط |
| 4 | `permission_key` بلا enum/FK في القاعدة — التحقق من صحة المفاتيح واجهة أمامية فقط | `setup_all.sql:429-434`, `permissions-api.ts:17-20` | 🟡 متوسط |
| 5 | رسالة تحذير غير مكتملة السياق لحساب المدير في محرر الصلاحيات | `web/src/app/settings/users/[id]/permissions/page.tsx:197-201` | 🔵 معماري |

## توصيات مرتّبة حسب الأولوية

### 🟠 عالٍ

1. **وثِّق صراحةً (أو قيِّد) أن `settings.permissions.manage` = صلاحية إدارية كاملة فعلياً** — إما بمنع حاملها من تعديل صفّه الخاص في `user_permissions` (`with check (has_permission('settings.permissions.manage') and user_id <> auth.uid())` لعمليات المنح على النفس، مع استثناء `is_admin()`)، أو على الأقل توضيح ذلك في نص "كيف يعمل النظام؟" بصفحة `/settings/permissions` (`page.tsx:110-123`).
2. **راجع البند الحرج المكافئ في `audit-reports/2026-07-25-users-audit.md`** (ثغرة `profiles_update_admin`) — فهي الأثر العملي الفعلي لقوة `settings.permissions.manage`/`settings.users.manage` الموصوفة هنا.

### 🟡 متوسط

3. **اجعل `setUserPermissions()` أقرب للذرّية**: نفّذها عبر دالة SQL واحدة (`security definer` مع فحص `has_permission` داخلي) تستقبل مصفوفة المفاتيح وتنفّذ `delete` + `insert` داخل معاملة واحدة، بدل طلبين REST منفصلين من العميل.
4. **أضف قيداً على `user_permissions.permission_key`** (مثلاً `check (permission_key = any(array[...]))` يُولَّد من نفس قائمة `ALL_PERMISSION_KEYS`، أو جدول مرجعي `permission_catalog`) لمنع تلوّث البيانات بمفاتيح غير صالحة حتى لو تجاوز أحدهم طبقة الواجهة.

### 🔵 معماري

5. **حدِّث نص التحذير في `[id]/permissions/page.tsx:197-201`** ليشمل حالة "إن تغيّر الدور لاحقاً، الصلاحيات المخصّصة المحفوظة هنا ستصبح فعّالة".

## ملحق — ملفات مرجعية رئيسية

- `database/setup_all.sql` — `profiles`/`user_permissions` (415-436)، `is_admin()`/`has_permission()` (1328-1358)، RLS كاملة لكلا الجدولين (2796-2850).
- `web/src/app/settings/permissions/page.tsx` — لوحة الصلاحيات (عرض/تعديل لكل مستخدم).
- `web/src/app/settings/users/[id]/permissions/page.tsx` — محرر صلاحيات مستخدم واحد.
- `web/src/modules/settings/permissions/permission-catalog.ts` — الكتالوج الكامل + `ROLE_PERMISSION_DEFAULTS`.
- `web/src/modules/settings/permissions/permission-utils.ts` — `resolveEffectivePermissions`/`canAccessRoute`/`getRoutePermission`.
- `web/src/modules/settings/services/permissions-api.ts` — طبقة النداء المباشر لـ`user_permissions` (بلا RPC وسيط).
- `web/src/modules/auth/auth-context.tsx` — تحميل الصلاحيات الفعّالة عند تسجيل الدخول.
