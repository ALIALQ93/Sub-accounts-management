# نشر عميل جديد — دليل تشغيلي

دليل يدوي لعميل واحد على مشروع Supabase وتطبيق منفصلين (نموذج العزل **أ**).  
مرجع القرارات: [`proposals/2026-07-23-initial-setup-and-multi-company.md`](../proposals/2026-07-23-initial-setup-and-multi-company.md).

> **لا تستخدم** `setup_all.sql` على قاعدة فيها بيانات إنتاج — يحذف كل شيء.

---

## 1) إنشاء مشروع Supabase

1. [Supabase Dashboard](https://supabase.com/dashboard) → **New project**.
2. اختر المنطقة الأقرب للعميل واحفظ كلمة مرور قاعدة البيانات في مكان آمن.
3. من **Project Settings → API** انسخ:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (سري — لإنشاء المستخدمين من التطبيق فقط)

---

## 2) تثبيت المخطط

في **SQL Editor** شغّل محتوى الملف كاملاً:

```
database/setup_all.sql
```

التحقق السريع:

```sql
select count(*) as root_accounts from public.accounts where parent_id is null;
-- متوقع: 7

select branch_code from public.branches;
-- متوقع: MAIN

select warehouse_code from public.warehouses;
-- متوقع: WH-MAIN

select is_setup_complete from public.company_settings where id = 1;
-- متوقع: false
```

تفاصيل إضافية: [`database/TRIAL_SETUP.md`](../database/TRIAL_SETUP.md) · [`database/README.md`](../database/README.md).

---

## 3) المصادقة وأول مدير

1. **Authentication → Providers → Email** — فعّل Email/Password.
2. **Authentication → Users → Add user** — أنشئ حساب المدير الأول (بريد + كلمة مرور).
3. المحفّز `handle_new_user` يمنحه دور `admin` تلقائياً لأنه أول صف في `profiles`.

---

## 4) متغيرات البيئة ونشر التطبيق

### محلي (`web/.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Vercel (أو مضيف مماثل)

| الإعداد | القيمة |
|---------|--------|
| Root Directory | `web` |
| نفس متغيرات env أعلاه | لكل مشروع عميل على حدة |

لا تشارك مفاتيح عميل مع عميل آخر.

---

## 5) إكمال ويزارد `/setup`

1. افتح التطبيق → سجّل دخول المدير.
2. يُعاد التوجيه تلقائياً إلى `/setup` طالما `is_setup_complete = false`.
3. أكمل الخطوات: الشركة → المدير → الفرع/المستودع → قبول دليل الحسابات → المخزون → (تخطي القيد الافتتاحي) → إتمام.
4. بعد الإتمام تُفتح الشاشة الرئيسية ولا يُعاد فتح الويزارد.

القيد الافتتاحي وبضاعة أول المدة يُكمَلان لاحقاً من الشاشات العادية عند الحاجة.

---

## 6) النسخ الاحتياطي (إلزامي لكل عميل)

| الطبقة | إجراء |
|--------|--------|
| نسخ Supabase | Settings → Database → تأكد من النسخ اليومية؛ على Pro فعّل PITR إن أمكن |
| `pg_dump` يدوي | دوري (أسبوعي مقترح) + حفظ خارج Supabase (قرص/تخزين سحابي للعميل) |
| اختبار استعادة | مرة عند الإطلاق + بعد ترقيات كبيرة |

مثال `pg_dump` (من جهاز فيه اتصال بقاعدة المشروع — استخدم connection string من Dashboard):

```bash
pg_dump "%DATABASE_URL%" --format=custom --file="backup-%DATE%.dump"
```

استعادة (بيئة فارغة للاختبار فقط):

```bash
pg_restore --clean --if-exists --no-owner --dbname="%DATABASE_URL%" backup-YYYYMMDD.dump
```

لا تعتمد على نسخة واحدةحدة داخل جهاز المطوّر فقط.

---

## 7) قائمة تحقق ترقيات منتج على عملاء موجودين

عند إصدار ميزة جديدة تتطلب SQL:

1. أضف/حدّث `database/patch_<feature>.sql` وأعد توليد `setup_all` عبر `build_setup_all.ps1` (للبيئات الجديدة فقط).
2. على **كل** مشروع عميل حي: شغّل **فقط** ملفات الـpatch الجديدة بالترتيب الموثّق في `database/README.md` — **وليس** `setup_all.sql`.
3. انشر نسخة التطبيق الجديدة على بيئة كل عميل (نفس الـcommit أو الوسم).
4. دخّل كمدير وتحقق من مسار دخان قصير (دخول، قائمة، عملية واحدة أساسية للميزة).
5. سجّل تاريخ الترقيع واسم الملف في مذكرة تشغيل العميل.

| عميل | مشروع Supabase | تاريخ آخر patch | ملاحظات |
|------|----------------|-----------------|--------|
| … | … | … | … |

---

## 8) قائمة تحقق إطلاق سريعة

- [ ] مشروع Supabase خاص بالعميل
- [ ] `setup_all.sql` نُفِّذ والتحقق (§2) ناجح
- [ ] Email Auth + مستخدم مدير أول
- [ ] env التطبيق مضبوط ومنشور (Root = `web`)
- [ ] ويزارد `/setup` مكتمل
- [ ] نسخ Supabase مفعّلة + أول `pg_dump` خارجي محفوظ
- [ ] (اختياري) حسابات فرعية تشغيلية وأنماط فواتير/سندات حسب حاجة العميل
