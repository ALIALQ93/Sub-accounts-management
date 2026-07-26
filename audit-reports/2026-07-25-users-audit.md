# تدقيق دقيق — المستخدمون (Users)

منهجية: قراءة الكود الفعلي (SQL + TypeScript) لـ `web/src/app/settings/users/**`، `web/src/app/api/admin/users/route.ts`، `web/src/modules/settings/services/settings-api.ts`، وسياسات RLS لجدول `public.profiles` في `database/setup_all.sql`. تم التحقق نصياً من أن سياسات `profiles` مُعرَّفة مرة واحدة فقط ضمن كتلة `02_rls.sql` (لا يعاد تعريفها في أي `patch_*.sql` لاحق حسب ترتيب `database/build_setup_all.ps1`)، فهي فعّالة كما هي في `setup_all.sql:2796-2827` دون التباس بشأن "آخر نسخة".

## 1. 🔴 تصعيد صلاحيات كامل: أي مستخدم يملك `settings.users.manage` يستطيع ترقية نفسه (أو أي أحد) إلى `admin` مباشرة، متجاوزاً حماية الواجهة

سياسة `profiles_update_admin` (`setup_all.sql:2807-2817`):

```sql
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (
    public.is_admin()
    or public.has_permission('settings.users.manage')
  )
  with check (
    public.is_admin()
    or public.has_permission('settings.users.manage')
  );
```

هذه السياسة **لا تقيّد `id` المستهدف بأي شكل** — لا `id <> auth.uid()` ولا أي شرط آخر. أي مستخدم يملك مفتاح `settings.users.manage` (الموصوف في الكتالوج بأنه "إدارة المستخدمين (إضافة/تفعيل)" فقط — `permission-catalog.ts:138`) يستطيع تنفيذ استدعاء مباشر:

```js
await supabase.from('profiles')
  .update({ role: 'admin', is_active: true })
  .eq('id', (await supabase.auth.getUser()).data.user.id);
```

وتنجح العملية، لأن `has_permission('settings.users.manage')` صحيحة بغضّ النظر عن هوية الصف المستهدَف. هذا يمنحه دور `admin` الكامل — تجاوز تام لكل نظام الصلاحيات التفصيلية دفعة واحدة.

**الحماية الوحيدة الموجودة حالياً هي في الواجهة فقط وليست في القاعدة:** في `web/src/app/settings/users/page.tsx:195` القائمة المنسدلة لتغيير الدور معطَّلة صراحةً عند `profile.id === currentProfile?.id` — أي "لا يمكنك تغيير دورك من نفس الصف بالواجهة". لكن هذا فحص عميل بحت (`disabled` على عنصر `<select>`)؛ أي استدعاء مباشر لـ`supabase.from('profiles').update(...)` من console المتصفح أو أي عميل API آخر يتجاوزه بالكامل لأن RLS — خط الدفاع الحقيقي — لا يفرض نفس القيد.

هذا هو بالضبط نمط الثغرة المتكرر في وحدات أخرى من هذا المشروع (RLS بلا فحص كافٍ رغم أن الواجهة "تبدو" محمية)، لكنه هنا أخطر لأنه في **نظام الصلاحيات نفسه**: أي مدير يمنح موظفاً صلاحية "إدارة المستخدمين (إضافة/تفعيل)" — تصميمياً صلاحية محدودة النطاق — يمنحه فعلياً مساراً كاملاً لتنصيب نفسه (أو أي حساب آخر) مديراً كامل الصلاحيات، بلا أي أثر إضافي في السجلات يميّز هذا عن تحديث دور عادي.

مسار الاستغلال الكامل (خطوتان محتملتان، أو خطوة واحدة إذا مُنحت الصلاحية مباشرة):
1. مستخدم يملك `settings.permissions.manage` فقط (بلا `settings.users.manage`) يمنح نفسه `settings.users.manage` عبر `user_permissions` (مسموح — راجع `audit-reports/2026-07-25-permissions-audit.md` البند 2؛ `user_permissions_insert` تتحقق فقط من صلاحية المنفِّذ لا من هوية `user_id` المستهدف).
2. باستخدام `settings.users.manage` الجديدة، يحدّث `profiles.role` الخاص به إلى `'admin'` مباشرة كما بالأعلى.

النتيجة: أي مستخدم يملك **إما** `settings.permissions.manage` **أو** `settings.users.manage` (منفردة، ولو بلا `role='admin'`) يستطيع الوصول لصلاحيات admin الكاملة خلال طلبين API، دون أي عائق من القاعدة.

## 2. تناقض بين ما تُظهره الواجهة وما يقبله الخادم: زر "إضافة مستخدم" يظهر لمن لا يستطيع فعلياً إنشاء مستخدم

الزر "إضافة مستخدم" في `web/src/app/settings/users/page.tsx:138-152` يظهر عند `canManageUsers = isAdmin || hasPermission("settings.users.manage")` (`page.tsx:27-28`) — أي أن مستخدماً يملك `settings.users.manage` فقط (دون أن يكون `role === 'admin'`) يرى الزر، يفتح النافذة (`Modal`)، يملأ النموذج، ويضغط "إنشاء".

لكن `POST /api/admin/users` (`web/src/app/api/admin/users/route.ts:23-46`) يتحقق عبر `assertAdmin()`:

```ts
if (!profile?.is_active || profile.role !== "admin") {
  return { error: NextResponse.json({ error: "يتطلب صلاحية مدير النظام." }, { status: 403 }) };
}
```

هذا فحص `role === 'admin'` **حرفي**، وليس `has_permission('settings.users.manage')`. مستخدم يملك الصلاحية التفصيلية فقط (لا الدور) يواجه رسالة خطأ 403 "يتطلب صلاحية مدير النظام" رغم أن الواجهة أظهرت له الإجراء كمتاح بالكامل. هذا تناقض وظيفي (وليس ثغرة أمنية — الاتجاه هنا آمن، الخادم أكثر تشدداً من الواجهة) لكنه يكسر تجربة أي مستخدم مُنح هذه الصلاحية تحديداً كي يضيف مستخدمين.

ملاحظة: هذا التشدد في `/api/admin/users` نفسه (يتطلب `role==='admin'` حرفياً) هو ما يجعل **إنشاء** مستخدمين جدد آمناً فعلاً؛ المشكلة الحرجة (البند 1) هي فقط في **تحديث** `profiles.role` لحساب موجود، لأن RLS هناك أضعف من الفحص اليدوي في route.ts.

## 3. لا حماية في القاعدة تمنع تعطيل آخر حساب `admin` نشط

لا يوجد أي قيد (`check` أو `trigger`) في `setup_all.sql` يمنع تحديث كل صفوف `profiles` ذات `role='admin'` إلى `is_active=false` في وقت واحد. من الناحية العملية، مالك `settings.users.manage` (أو `admin`) يستطيع تعطيل كل حسابات المدراء الأخرى بلا أي تحذير من النظام، مما قد يترك الشركة بلا أي حساب admin نشط (حالة يصعب التعافي منها إلا عبر Supabase Dashboard مباشرة). ملاحظة معمارية إضافية لا علاقة مباشرة لها بالبند الحرج أعلاه.

## 4. لا مسار لإعادة تعيين كلمة مرور من داخل التطبيق

صفحة `/settings/users` تعرض ملاحظة صريحة (`page.tsx:261-265`) بأن إنشاء المستخدمين من الواجهة يتطلب `SUPABASE_SERVICE_ROLE_KEY`، وإلا يُنشَأ المستخدم من لوحة Supabase مباشرة. لا يوجد أي إجراء "إعادة تعيين كلمة المرور" لا في هذه الصفحة ولا في `/api/admin/users` (الذي يدعم فقط `POST` لإنشاء مستخدم جديد، بلا `PATCH`/endpoint لتحديث كلمة مرور مستخدم موجود). أي محاسب نسي كلمة مروره يعتمد كلياً على وصول المدير للوحة Supabase Auth مباشرة — فجوة وظيفية، ليست أمنية.

## 5. أزرار صفحة صلاحيات المستخدم الفردي تخرج عن نظام التصميم المشترك

`web/src/app/settings/users/[id]/permissions/page.tsx:164-179` يستخدم أزراراً يدوية (`rounded-md bg-blue-900...`, `rounded-md border border-slate-300...`) بدل `.btn`/`.btn-primary`/`.btn-outline` المعرَّفة في `web/src/app/globals.css:123-176`، خلافاً لصفحة `/settings/users` الرئيسية نفسها (`page.tsx:145-152, 353-364`) التي تستخدم `.btn`/`.btn-primary`/`.btn-outline` بانضباط. كذلك رسائل الخطأ/النجاح في نفس الصفحة (`[id]/permissions/page.tsx:206-215`) تستخدم `border-rose-200`/`bg-emerald-50` بدل `var(--danger)`/`var(--success)` المستخدمة في `page.tsx:158-166`.

## ملخّص الفجوات

| # | الملاحظة | الموقع | الخطورة |
|---|---|---|---|
| 1 | `profiles_update_admin` RLS بلا قيد على هوية الصف المستهدف — أي حامل `settings.users.manage` يرقّي نفسه لـ`admin` مباشرة، متجاوزاً تعطيل القائمة المنسدلة بالواجهة | `setup_all.sql:2807-2817` + `users/page.tsx:195` | 🔴 حرج — تصعيد صلاحيات |
| 2 | تناقض واجهة/خادم: زر "إضافة مستخدم" يظهر لحامل `settings.users.manage` لكن `/api/admin/users` يرفضه (يتطلب `role==='admin'` حرفياً) | `users/page.tsx:27-28,138-152` vs `api/admin/users/route.ts:39` | 🟠 عالٍ (وظيفي، الاتجاه آمن) |
| 3 | لا قيد يمنع تعطيل كل حسابات admin النشطة دفعة واحدة | لا يوجد (غياب) | 🟡 متوسط |
| 4 | لا مسار لإعادة تعيين كلمة مرور مستخدم من داخل التطبيق | `users/page.tsx:261-265`, `api/admin/users/route.ts` | 🟡 متوسط |
| 5 | أزرار ورسائل صفحة صلاحيات المستخدم الفردي تخرج عن نظام التصميم المشترك | `users/[id]/permissions/page.tsx:164-179,206-215` | 🟡 متوسط |

## توصيات مرتّبة حسب الأولوية

### 🔴 حرج

1. **قيّد سياسة `profiles_update_admin` لمنع تعديل `role`/`is_active` للصف الخاص بالمنفِّذ نفسه ما لم يكن `is_admin()` فعلاً**: مثلاً `with check ((public.is_admin()) or (public.has_permission('settings.users.manage') and id <> auth.uid()))`. هذا يمنع تصعيد الذات عبر مسار `settings.users.manage` وحده، مع إبقاء قدرة الأدمن الحقيقي على تعديل أي صف بما فيه صفّه.
2. **بديل/إضافة أقوى**: افصل صراحة القدرة على "تغيير `role` إلى admin" عن "تفعيل/تعطيل مستخدم" — أضف سياسة أو دالة `security definer` منفصلة (`promote_to_admin(user_id)`) تتحقق من `is_admin()` حصراً (وليس أي صلاحية تفصيلية)، وامنع تحديث عمود `role` مباشرة عبر RLS العام لحملة `settings.users.manage` (اسمح لهم فقط بـ `is_active`/الحقول غير الحساسة عبر `with check` يستثني عمود `role`، أو تحقق من عدم تغيّر `role` في نفس الشرط المستخدم في `profiles_update_self`).

### 🟠 عالٍ

3. **وحّد فحص الصلاحية بين الواجهة و`/api/admin/users`**: إما اجعل `assertAdmin()` (`route.ts:23-46`) يقبل أيضاً `has_permission('settings.users.manage')` (باستخدام `has_permission` عبر استعلام SQL بدل فحص `role` حرفي)، أو أخفِ زر "إضافة مستخدم" لمن لا يملك `role==='admin'` فعلياً بدل الاعتماد على `settings.users.manage` وحدها في `canManageUsers` بالواجهة.

### 🟡 متوسط

4. **أضف تحذيراً في الواجهة (وربما فحصاً بسيطاً من جهة العميل قبل الإرسال)** عند تعطيل آخر حساب admin نشط — عدّ صفوف `role='admin' and is_active=true` قبل الحفظ وامنع الوصول لصفر.
5. **أضف مساراً لإعادة تعيين كلمة المرور** من `/settings/users` عبر `serviceClient.auth.admin.updateUserById()` (نفس نمط `route.ts` الحالي)، محمياً بنفس `assertAdmin()`.
6. **وحّد أزرار ورسائل `[id]/permissions/page.tsx`** مع `.btn`/`.btn-primary`/`.btn-outline` و`var(--danger)`/`var(--success)` أسوة بصفحة `/settings/users` الرئيسية.

## ملحق — ملفات مرجعية رئيسية

- `database/setup_all.sql` — `profiles` (415-427)، `is_admin()`/`has_permission()` (1328-1358)، `handle_new_user()` (1500-1531)، RLS كاملة لـ`profiles` (2796-2827).
- `web/src/app/settings/users/page.tsx` — قائمة المستخدمين، تغيير الدور/الحالة، نافذة الإنشاء.
- `web/src/app/settings/users/[id]/permissions/page.tsx` — محرر صلاحيات مستخدم واحد.
- `web/src/app/api/admin/users/route.ts` — إنشاء مستخدم عبر `service_role` مع `assertAdmin()`.
- `web/src/modules/settings/services/settings-api.ts` — `updateProfile`/`listProfiles`/`createUserViaApi`.
- `audit-reports/2026-07-25-permissions-audit.md` — تحليل `user_permissions` وسلسلة الثقة المؤدية لهذا البند الحرج.
