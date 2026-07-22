# تقرير تدقيق عام — 2026-07-22

تدقيق شامل لعموم المشروع (تقنيات، هيكلية، أمان، جودة كود، Git، قاعدة البيانات). هذا تدقيق عام مكمّل لملفات `AUDIT_*.md` في جذر المشروع التي تركّز على المنطق المحاسبي التفصيلي (ترحيل القيود، RLS، تخصيص السندات...).

## 1. نوع المشروع والتقنيات

نظام محاسبي شامل (ERP محاسبي) باللغة العربية:

- **الواجهة الأمامية:** `web/` — Next.js `16.2.9` + React `19.2.4` + TypeScript `5` + Tailwind CSS `4` (`web/package.json`).
- **قاعدة البيانات/الخلفية:** Supabase (PostgreSQL) — كل المنطق (RLS، Triggers، RPC functions) مكتوب بـ SQL خام في `database/`، لا يوجد backend منفصل؛ الواجهة تتصل مباشرة بـ Supabase عبر `@supabase/supabase-js` و`@supabase/ssr`.
- **البنية:** ~31,835 سطر SQL موزعة على 57 ملف "patch" + `01_schema.sql` (2419 سطر) تُجمَّع تلقائياً في ملف واحد `database/setup_all.sql` (14,911 سطر) عبر `database/build_setup_all.ps1`.
- **الواجهة:** بنية معيارية `app/` (Next.js App Router) + `modules/` (منطق أعمال معزول لكل نطاق: vouchers, invoices, materials, accounts...) — 276 ملف `.ts`/`.tsx`.
- **CI:** GitHub Actions (`.github/workflows/web-ci.yml`) يشغّل lint + build عند كل push/PR على `web/**`.
- **التوثيق:** ثري وبالعربية — `docs/` (21 قسماً وظيفياً)، `ACCOUNTING_RULES.md`, `API_CONTRACT.md`, `VOUCHER_WORKFLOW.md`, `SCREEN_SPECS.md`، وملفات تدقيق داخلية متعددة (`AUDIT_*.md`).

الإصدار الحالي: `0.1.0+trial-1` ("تجربة أولى" حسب `README.md` و`CHANGELOG.md`).

## 2. هيكل المجلدات الرئيسي

```
├── database/          # كل SQL: schema + RLS + patches تراكمية (57 ملف) + setup_all.sql المُولَّد
├── web/                # تطبيق Next.js
│   └── src/
│       ├── app/        # صفحات App Router (vouchers, invoices, materials, pos, reports, settings...)
│       ├── modules/     # منطق أعمال معزول لكل نطاق (components/services/utils لكل موديول)
│       ├── components/  # مكونات مشتركة (إشعارات)
│       ├── lib/supabase/# عملاء Supabase + middleware auth
│       ├── config/, hooks/
├── docs/               # توثيق وظيفي بالعربية، 21 قسماً + قرارات المنتج
├── .github/workflows/  # CI
├── AUDIT_*.md, ACCOUNTING_RULES.md, API_CONTRACT.md, CHANGELOG.md, RELEASE_CHECKLIST.md
```

## 3. نقاط القوة

1. **ثقافة تدقيق داخلي فعلية وموثّقة**: 8 ملفات `AUDIT_*.md` في الجذر تُظهر منهجية جادة (تتبّع "آخر نسخة فعّالة" من كل دالة عبر ترتيب تطبيق الـpatches بدل الاعتماد على أول ملف يظهر بالبحث). تحقّقتُ أن عدة نتائج حرجة موثّقة فيها **أُصلحت فعلاً** في الكود الحالي:
   - خطأ `debit_base_base` الذي كان يكسر ميزان المراجعة بالكامل → مُصلَح.
   - الخصم المزدوج في فواتير الشراء (`post_invoice`) → مُصلَح (`database/patch_invoice_pricing_cost.sql:729-730`).
   - RLS المفتوح على `accounting_periods` و`branches` → مُصلَح في `database/patch_audit_governance_security.sql`.
   - `invoice_reference_links` بدون RLS إطلاقاً → مُصلَح في نفس الملف.
   - خيار "FIFO" الوهمي في تكلفة المخزون → عُطِّل من واجهة الاختيار (`web/src/app/materials/settings/page.tsx:166-180`) مع تحذير صريح.
2. **حماية معاملات جيدة**: `post_invoice()` مُغلَّفة كدالة `plpgsql` واحدة، أي فشل يتراجع تلقائياً بالكامل — لا ترحيل جزئي.
3. **لا أسرار مكشوفة في Git**: `.env.local` غير متتبّع؛ فقط `web/.env.example` (قيم وهمية) متتبّع. لا نتائج لأي `service_role key` عبر كامل تاريخ Git.
4. **لا ملفات بناء متتبّعة**: `node_modules/`, `.next/` غير موجودة في `git ls-files`؛ `.gitignore` سليم ومعياري.
5. **RLS شامل تقريباً**: فحص داخلي سابق قارن الجداول الـ44 مقابل ما فعّل RLS ولم يجد فجوة أخرى بخلاف ما ذُكر أعلاه (وقد أُصلح).
6. **CI فعلي** يبني ويفحص (lint) كل push على `web/**`.

## 4. نقاط الضعف والمشاكل

### 4.1 مشاكل غير محلولة بعد (موثّقة داخلياً، لم أجد إصلاحاً لها في الكود الحالي)

| # | المشكلة | الموقع | الخطورة |
|---|---------|--------|----------|
| 1 | لا ضمان على مستوى قاعدة البيانات يمنع تجاوز تخصيص السندات (`voucher_allocations`) لمبلغ الحركة الفعلي — التحقق الوحيد بالواجهة (JS)، نمط TOCTOU كلاسيكي | `web/src/modules/vouchers/utils/validate-voucher-allocations.ts`؛ محفز `voucher_allocations_validate()` في `database/01_schema.sql` (~1353-1382) | عالٍ |
| 2 | فحص الرصيد المخزني الكافي عند البيع/الإخراج بلا قفل تزامن (`select sum(...)` بدون `for update`) | `database/patch_outbound_lot_stock.sql`, دالة `inventory_movements_enforce_stock` (سطر 84-168) | متوسط |
| 3 | إعدادات وهمية بدون تنفيذ فعلي: `invoice_patterns.max_discount_percent` و`invoice_patterns.release_on_cancel` معروضة بالواجهة بلا أثر خلفي | `database/patch_invoice_reservation_discount.sql`, `database/patch_invoice_discount_rounding.sql:186-197` | عالٍ (توهم المستخدم بضمانات غير موجودة) |
| 4 | زر "عكس السند" بلا تأكيد (`confirm()`) قبل إنشاء وترحيل سند عكسي | `web/src/modules/vouchers/components/voucher-form.tsx:362-377, 696-704` | متوسط |
| 5 | إنشاء مادة بلا وحدة قياس ممكن — عمليتان منفصلتان (إدراج مادة ثم وحدة أساس)؛ فشل الخطوة الثانية يترك مادة بلا وحدات | `web/src/modules/materials/services/material-api.ts:132-179`؛ `web/src/modules/invoices/components/invoice-material-lines-table.tsx:148` | عالٍ |
| 6 | القيد الافتتاحي بدون فرع (`branch_id = null`) غير محمي من التكرار للشركات بلا فروع | `database/patch_opening_entry.sql:23-28` | متوسط-عالٍ |
| 7 | تشتت تعريف دوال حرجة عبر ملفات patch متتابعة (`vouchers_before_update_handle_posting()` أُعيد تعريفها 5 مرات، `post_invoice()` 3 مرات) — هش بنيوياً | عبر `database/patch_*.sql` | توصية معمارية |

### 4.2 جودة الكود العام

- **لا توجد اختبارات إطلاقاً**: لا مجلد `tests`، لا `*.test.*`/`*.spec.*`، لا Jest/Vitest/Playwright. الاعتماد الوحيد: `eslint` + `next build` بـ CI. لنظام محاسبي، هذه أضعف نقطة في المشروع.
- **ملفات كبيرة تستحق إعادة هيكلة (> 500 سطر):**
  - `web/src/modules/invoices/components/invoice-form.tsx` — 1975 سطر
  - `web/src/modules/vouchers/services/voucher-api.ts` — 1577 سطر
  - `web/src/modules/materials/components/material-form.tsx` — 1379 سطر
  - `web/src/modules/invoices/components/invoice-pattern-form.tsx` — 1181 سطر
  - `receipt-voucher-form.tsx` (958)، `payment-voucher-form.tsx` (956)، `voucher-form.tsx` (736)، `settlement-voucher-form.tsx` (720)
  - SQL: `database/patch_invoice_pricing_cost.sql` (1319 سطر، يحوي `post_invoice()` كاملة)، `database/01_schema.sql` (2419 سطر)
- لا تكرار كبير عرضي؛ تكرار `create or replace function` بين ملفات الـpatch مقصود ومُدار عبر `build_setup_all.ps1`.
- لا TODO/FIXME حقيقية بكود الواجهة — المشاكل المعروفة تُسجَّل في `AUDIT_*.md` بدل تعليقات مضمّنة.

### 4.3 سجل Git

- 90 commit إجمالاً، **62 منها (~69%) برسائل بلا معنى** (أرقام مفردة: "3" ×22، "6" ×20، "66" ×9...).
- نشاط مكثّف بأيام معينة (38 commit في 2026-07-02، 18 في 2026-07-04) ثم فجوات كبيرة — نمط نموذجي لمطوّر منفرد/AI-assisted يعمل بدفعات.
- `docs/PROGRESS.md` آخر تحديث شامل مسجَّل 2026-07-07 رغم استمرار التطوير حتى 2026-07-22 — التوثيق التتبّعي بدأ يتخلّف عن الكود.

### 4.4 قاعدة البيانات / Migrations

- لا نظام migrations حقيقي (لا Supabase CLI migrations، لا Prisma). البنية: `00_reset.sql` → `01_schema.sql` → 57 `patch_*.sql` مُطبَّقة بترتيب محدد في `build_setup_all.ps1`، مُجمَّعة في `setup_all.sql` (reset + rebuild كامل). عملي لمرحلة "تجربة أولى"، **غير مناسب لبيئة إنتاج فيها بيانات حقيقية** لاحقاً دون خطة ترقية تراكمية آمنة.
- ترتيب التطبيق حرج وغير موثّق كفاية خارج السكربت نفسه — مصدر الحقيقة الوحيد لـ"أي نسخة من كل دالة فعّالة" هو ترتيب `build_setup_all.ps1`.

### 4.5 ملاحظة تكوين

- `NEXT_PUBLIC_SKIP_AUTH=true` يتجاوز التحقق من الهوية بالكامل (`web/src/lib/supabase/middleware.ts:8` عبر `isAuthDisabled()` في `web/src/lib/supabase/env.ts:16-18`). مضبوط حالياً بشكل صحيح فقط بـ CI. بما أنه متغيّر `NEXT_PUBLIC_*` (يُضمَّن بحزمة العميل عند البناء)، يجب التأكد الصارم عند أي نشر فعلي أنه غير مضبوط على `true`.

## 5. توصيات عملية (مرتّبة حسب الأولوية)

1. إضافة اختبارات آلية — على الأقل لدوال SQL الحرجة (`post_invoice`, `vouchers_before_update_handle_posting`, حسابات التخصيص) عبر pgTAP أو سكربتات تحقق مؤتمتة ضمن CI، وبعض اختبارات E2E خفيفة (Playwright) لدورة سند/فاتورة كاملة.
2. معالجة سباقات التزامن المتبقية (البند 4.1 #1 و#2) بنفس أسلوب قفل الصف المُستخدم فعلاً لسقف تخصيص السندات.
3. حذف أو تفعيل الإعدادات الوهمية (`max_discount_percent`, `release_on_cancel`).
4. إصلاح فهرس القيد الافتتاحي ليغطي حالة `branch_id is null`.
5. إضافة `confirm()` قبل عكس السند.
6. تحويل إنشاء المادة إلى عملية واحدة ذرّية (RPC واحدة).
7. تقسيم الملفات الضخمة (`invoice-form.tsx`, `voucher-api.ts`) إلى مكونات/hooks/خدمات أصغر.
8. تحسين رسائل commit مستقبلاً.
9. تحديث `docs/PROGRESS.md` بانتظام.
10. توثيق واضح لعملية النشر على الإنتاج، والتأكد الصارم من `NEXT_PUBLIC_SKIP_AUTH`، وخطة migrations تدريجية آمنة.
11. دمج نسخ الدوال المتشتتة دورياً في `01_schema.sql`.

## الخلاصة

المشروع منظّم جيداً، موثّق بعمق غير معتاد (خصوصاً ثقافة التدقيق الذاتي عبر `AUDIT_*.md` التي أثبتت فعاليتها فعلاً)، ولا توجد أسرار مكشوفة أو ثغرات RLS واضحة متبقية غير موثّقة. أكبر فجوتين حقيقيتين: **غياب كامل للاختبارات الآلية**، و**سباقات تزامن وإعدادات غير مُنفَّذة معروفة داخلياً لكن لم تُعالَج بعد** (تخصيص السندات، فحص المخزون، `max_discount_percent`, `release_on_cancel`). المشروع لا يزال رسمياً في مرحلة "تجربة أولى" (0.1.0-trial-1)، ما يتّسق مع حجم النواقص الموثّقة ذاتياً.
