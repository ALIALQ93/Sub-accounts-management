# فهرس التدقيق الشامل — كل الملفات

تدقيق تفصيلي لكامل المشروع، مُقسَّم لوحدات صغيرة جداً (كل وحدة = مجموعة شاشات مترابطة وظيفياً)، كل وحدة بتقرير `audit-reports/2026-07-25-*.md` منفصل. المنهجية بكل تقرير: قراءة الكود الفعلي وتتبّع ترتيب تطبيق الباتشات الحقيقي (`database/build_setup_all.ps1`)، لأن `database/setup_all.sql` هو النسخة المُجمَّعة الفعّالة فعلياً — آخر `create or replace` لأي دالة/تريغر/سياسة هو الفعّال، وليس أول نتيجة بحث نصي.

**ملاحظة مهمة:** بعض التقارير أدناه (قسم المواد/نقاط البيع تحديداً) عُدِّلت لاحقاً وأُضيفت لها حالة "✓ مُغلق" بعد تنفيذ الإصلاحات فعلياً بالكود — راجع رأس كل ملف للحالة الأحدث، فهذا الفهرس يعكس آخر حالة معروفة وقت كتابته.

---

## 🔴 أولوية حرجة — عبر المشروع كامل (الأخطر أولاً)

1. **تصعيد صلاحيات فعلي — أي مستخدم يملك `settings.users.manage` أو `settings.permissions.manage` يقدر يرقّي نفسه لأدمن كامل.** سياسة `profiles_update_admin` بلا قيد على الصف المُحدَّث؛ الحماية الوحيدة حقل معطّل بالواجهة. ([`users-audit.md`](audit-reports/2026-07-25-users-audit.md), [`permissions-audit.md`](audit-reports/2026-07-25-permissions-audit.md))
2. **تقرير COGS: عمود "الإيراد" فعلياً بيانات تكلفة معاد تسميتها** — الهامش المعروض ≈ صفر دائماً بغض النظر عن الربح الحقيقي؛ وتكلفة مرتجعات المبيعات بالتقرير تُحسب بصيغة مختلفة بنيوياً عمّا يُرحَّل فعلياً بدفتر الأستاذ (تلوّث حسابات المتوسط المرجّح المستقبلية). ([`cogs-report-audit.md`](audit-reports/2026-07-25-cogs-report-audit.md))
3. **كشف الحساب: `.limit(5000)` بلا ترتيب وبلا تنبيه** — لأي حساب عالي الحركة يُسقِط معاملات فعلية بصمت وتظهر أرصدة/إجماليات خاطئة وكأنها صحيحة. ([`account-statement-audit.md`](audit-reports/2026-07-25-account-statement-audit.md))
4. **تقرير أعمار الذمم على الأرجح معطّل بالكامل فعلياً** — `party_id` بلا FK حقيقي للعملاء/الموردين، والاستعلام يطلب تضمين علاقة تتطلب FK. ([`receivables-aging-report-audit.md`](audit-reports/2026-07-25-receivables-aging-report-audit.md))
5. **تعديل المدير لسند دفع/قبض مرحّل يكتب جزئياً بصمت** (الرأس يتغيّر، السطور تُرفض) مع رسالة خطأ مضلِّلة؛ و**زر "عكس السند" غير قابل للوصول فعلياً** لهذين النوعين (مسار ميت بالكود) — لا توجد طريقة آمنة حالياً لتصحيح سند دفع/قبض مرحّل بالخطأ. ([`payment-receipt-vouchers-audit.md`](audit-reports/2026-07-25-payment-receipt-vouchers-audit.md))
6. **قيد يومية مرحّل قابل للتعديل المباشر بلا أي كشف** — لا تريغر حماية على `journal_entries`، RLS مفتوحة بلا فحص صلاحية، فحص الاتزان يعمل فقط عند مسودة→مرحّل. ([`journals-audit.md`](audit-reports/2026-07-25-journals-audit.md))
7. **نموذج الفاتورة: الترحيل يرحّل آخر نسخة محفوظة وليس التعديلات المعروضة** — تعديل سطر بفاتورة مسودة مفتوحة ثم الضغط على "ترحيل" مباشرة (بدون "حفظ") يُرحِّل بصمت البيانات القديمة مع رسالة نجاح مضلِّلة. ([`invoice-form-audit.md`](audit-reports/2026-07-25-invoice-form-audit.md))
8. **مقاصة مراكز الكلفة/الفروع بسند التسوية غير قابلة للترحيل إطلاقاً** — حقل مطلوب بدالة الترحيل لا تملأه الواجهة أبداً. **القيد الافتتاحي: سطور بلا مركز كلفة تُحذف بصمت عند الحفظ** رغم ظهور "متوازن ✓"، ولا زر ترحيل مخصص للشاشة. ([`settlement-voucher-audit.md`](audit-reports/2026-07-25-settlement-voucher-audit.md), [`opening-entry-audit.md`](audit-reports/2026-07-25-opening-entry-audit.md))
9. **إعدادات فئات سطور السندات (تتضمن `auto_post_enabled`) بلا أي صلاحية بقاعدة البيانات** — أي مستخدم مسجّل دخول يقدر يعطّل المراجعة البشرية قبل الترحيل مباشرة. ([`voucher-line-categories-audit.md`](audit-reports/2026-07-25-voucher-line-categories-audit.md))
10. **مناقلات المخزون: زر "إدخال" (استلام) يبقى فعّالاً دائماً حتى بعد الاستلام الكامل** — بلا منع تكرار، فاتورة/قيد إدخال مكرّر ممكن بلا تحذير. أعمدة الكمية المشحونة/المستلمة لا تُحدَّث إطلاقاً — منطق "استلام جزئي" كود ميت فعلياً. ([`inventory-transfers-audit.md`](audit-reports/2026-07-25-inventory-transfers-audit.md))
11. **RLS مفتوحة بالكامل (`using(true)`, بلا `has_permission()`) على: العملاء، الموردون، مراكز الكلفة، العملات (تعديل سعر الصرف)، `cost_centers`.** إنشاء عميل/مورد أيضاً عملية غير ذرّية (حساب فرعي يتيم عند الفشل). ([`customers-audit.md`](audit-reports/2026-07-25-customers-audit.md), [`vendors-audit.md`](audit-reports/2026-07-25-vendors-audit.md), [`cost-centers-audit.md`](audit-reports/2026-07-25-cost-centers-audit.md), [`currencies-audit.md`](audit-reports/2026-07-25-currencies-audit.md))
12. **`bulk_create_accounts()` بلا فحص صلاحية داخلها إطلاقاً** — دالة `SECURITY DEFINER` تتجاوز RLS بالكامل. ([`accounts-audit.md`](audit-reports/2026-07-25-accounts-audit.md))
13. **رصيد المخزون بتقرير رصيد المخزون خاطئ حسابياً عند تطبيق فلتر تاريخ** (يبدأ من صفر بدل الرصيد الافتتاحي الحقيقي). ([`inventory-balance-report-audit.md`](audit-reports/2026-07-25-inventory-balance-report-audit.md))
14. **تقريرا سطور المبيعات والمشتريات يجمعان المرتجعات بنفس إشارة العملية الأصلية** بدل طرحها — "الإجمالي" مبالغ فيه دائماً عند وجود مرتجعات. ([`sales-lines-report-audit.md`](audit-reports/2026-07-25-sales-lines-report-audit.md), [`purchase-lines-report-audit.md`](audit-reports/2026-07-25-purchase-lines-report-audit.md))
15. **مسار الإعداد الأولي: لو انفرغ جدول المستخدمين بأي طريقة بعد الإطلاق، أول تسجيل جديد يصبح أدمن تلقائياً** بلا تحقق من اكتمال الإعداد. ([`setup-audit.md`](audit-reports/2026-07-25-setup-audit.md))

## 🟠 أولوية عالية

- أنماط الفواتير: قيود "المواد/الأصناف المسموحة" **بلا أي تنفيذ خلفي لفواتير عادية** (مُنفَّذة فقط لفواتير POS) — 11 شرط "إجباري" أخرى واجهة فقط. ([`invoice-patterns-audit.md`](audit-reports/2026-07-25-invoice-patterns-audit.md))
- تعطيل فرع لا ينعكس على مستودعاته/نقاط بيعه؛ تعطيل آخر فرع نشط يُفرغ كل قوائم اختيار الفروع بصمت. "العملة الأساسية" بإعدادات الشركة منفصلة تماماً عن العملة الأساس الفعلية — بلا أي أثر. ([`branches-audit.md`](audit-reports/2026-07-25-branches-audit.md), [`company-settings-audit.md`](audit-reports/2026-07-25-company-settings-audit.md))
- لا صلاحية وصول (`reports.*`) فعلية على أي تقرير بالمشروع بالكامل — معرَّفة بالكتالوج، ميتة فعلياً بكل تقرير فُحص اليوم (ميزان مراجعة، كشف حساب، مبيعات، مشتريات، أعمار ذمم، مخزون، حركات، COGS).
- ميزان المراجعة بلا فلترة فرع رغم وجود العمود/الفهرس المخصص؛ تقرير حركات المخزون بلا أي drill-down لمستند المصدر إطلاقاً. ([`trial-balance-audit.md`](audit-reports/2026-07-25-trial-balance-audit.md), [`inventory-movements-report-audit.md`](audit-reports/2026-07-25-inventory-movements-report-audit.md))
- تغيير فرع المستودع محمي بالواجهة فقط (لا تريغر DB) — **ملاحظة: تقرير المستودعات لاحقاً صحّح هذه النقطة، التريغر موجود فعلياً بـ`patch_audit_remaining.sql`؛ راجع [`warehouses-audit.md`](audit-reports/2026-07-25-warehouses-audit.md) للحالة الدقيقة.**
- سعر الصرف: تاريخ "سريان من" شكلي فقط؛ ميزان المراجعة وبطاقة الحساب يحوّلان بسعر اليوم دائماً بدل السعر التاريخي لفترة العرض. ([`currencies-audit.md`](audit-reports/2026-07-25-currencies-audit.md))
- حامل صلاحية `settings.permissions.manage` يقدر يمنح نفسه أي صلاحية أخرى بلا قيد. ([`permissions-audit.md`](audit-reports/2026-07-25-permissions-audit.md))

## 🟡 أولوية متوسطة (مختارة — التفاصيل الكاملة بكل تقرير)

- لا اختبارات آلية بالمشروع إطلاقاً؛ ملفات ضخمة تكبر باستمرار بلا إعادة هيكلة (`invoice-form.tsx` 2083 سطر). ([`2026-07-22-general-audit.md`](audit-reports/2026-07-22-general-audit.md))
- تشتت `post_invoice()`/`vouchers_before_update_handle_posting()` عبر 5 نسخ متفرقة (ازداد سوءاً، لم يتحسّن).
- قوائم السندات/الفواتير بلا ترقيم صفحات أو فلترة تاريخ/حالة — تحميل كل الصفوف دفعة واحدة دائماً.
- فجوات RLS/صلاحيات إضافية أقل حرجية بوحدات: القيود اليومية (إدراج بلا فحص صلاحية)، الحركات المفتوحة (خلط عملات فعلي بهذه الشاشة).

---

## فهرس كل التقارير حسب المجال

### دليل الحسابات والأطراف
| التقرير | أهم اكتشاف |
|---|---|
| [`accounts-audit.md`](audit-reports/2026-07-25-accounts-audit.md) | `bulk_create_accounts` بلا فحص صلاحية (🔴) |
| [`cost-centers-audit.md`](audit-reports/2026-07-25-cost-centers-audit.md) | RLS مفتوحة بالكامل (🔴) |
| [`currencies-audit.md`](audit-reports/2026-07-25-currencies-audit.md) | تعديل سعر الصرف بلا صلاحية + تحويل بسعر اليوم دائماً (🔴) |
| [`customers-audit.md`](audit-reports/2026-07-25-customers-audit.md) | RLS مفتوحة + إنشاء غير ذرّي (🔴) |
| [`vendors-audit.md`](audit-reports/2026-07-25-vendors-audit.md) | نفس ثغرات العملاء (كود مشترك) (🔴) |

### السندات والقيود
| التقرير | أهم اكتشاف |
|---|---|
| [`payment-receipt-vouchers-audit.md`](audit-reports/2026-07-25-payment-receipt-vouchers-audit.md) | تعديل مدير لسند مرحّل = كتابة جزئية صامتة + عكس السند مسار ميت (🔴🔴) |
| [`settlement-voucher-audit.md`](audit-reports/2026-07-25-settlement-voucher-audit.md) | مقاصة CC/الفروع غير قابلة للترحيل إطلاقاً (🔴) |
| [`opening-entry-audit.md`](audit-reports/2026-07-25-opening-entry-audit.md) | سطور بلا مركز كلفة تُحذف بصمت (🔴) |
| [`voucher-line-categories-audit.md`](audit-reports/2026-07-25-voucher-line-categories-audit.md) | `auto_post_enabled` بلا صلاحية بقاعدة البيانات (🔴) |
| [`journals-audit.md`](audit-reports/2026-07-25-journals-audit.md) | قيد مرحّل قابل للتعديل المباشر بلا كشف (🔴) |
| [`open-movements-audit.md`](audit-reports/2026-07-25-open-movements-audit.md) | خلط عملات فعلي بهذه الشاشة (🔴) |

### الفواتير والمخزون التشغيلي
| التقرير | أهم اكتشاف |
|---|---|
| [`invoice-form-audit.md`](audit-reports/2026-07-25-invoice-form-audit.md) | الترحيل يرحّل بيانات قديمة عند نسيان الحفظ (🔴) |
| [`invoice-patterns-audit.md`](audit-reports/2026-07-25-invoice-patterns-audit.md) | قيود المواد/الأصناف المسموحة بلا تنفيذ خلفي لفواتير عادية (🔴) |
| [`inventory-transfers-audit.md`](audit-reports/2026-07-25-inventory-transfers-audit.md) | زر الاستلام يبقى فعّالاً بعد الاكتمال — تكرار ممكن (🔴) |

### المواد ونقاط البيع (كل الوحدات أدناه أُصلحت لاحقاً — راجع رأس كل ملف)
[`material-card-audit.md`](audit-reports/2026-07-25-material-card-audit.md) · [`material-categories-audit.md`](audit-reports/2026-07-25-material-categories-audit.md) · [`material-units-audit.md`](audit-reports/2026-07-25-material-units-audit.md) · [`warehouses-audit.md`](audit-reports/2026-07-25-warehouses-audit.md) · [`warehouse-limits-audit.md`](audit-reports/2026-07-25-warehouse-limits-audit.md) · [`inventory-settings-audit.md`](audit-reports/2026-07-25-inventory-settings-audit.md) · [`stock-adjustment-audit.md`](audit-reports/2026-07-25-stock-adjustment-audit.md) · [`pos-points-audit.md`](audit-reports/2026-07-25-pos-points-audit.md) · [`pos-sell-audit.md`](audit-reports/2026-07-25-pos-sell-audit.md) · [`materials-ui-categories-audit.md`](audit-reports/2026-07-25-materials-ui-categories-audit.md) (الملخّص الأصلي قبل التقسيم)

### التقارير
| التقرير | أهم اكتشاف |
|---|---|
| [`trial-balance-audit.md`](audit-reports/2026-07-25-trial-balance-audit.md) | بلا فلترة فرع، بلا صلاحية (🟠) |
| [`account-statement-audit.md`](audit-reports/2026-07-25-account-statement-audit.md) | `.limit(5000)` بلا ترتيب يُسقط معاملات بصمت (🔴) |
| [`inventory-balance-report-audit.md`](audit-reports/2026-07-25-inventory-balance-report-audit.md) | رصيد جاري خاطئ عند فلتر تاريخ (🔴) |
| [`inventory-movements-report-audit.md`](audit-reports/2026-07-25-inventory-movements-report-audit.md) | بلا drill-down لمستند المصدر إطلاقاً (🔴) |
| [`cogs-report-audit.md`](audit-reports/2026-07-25-cogs-report-audit.md) | عمود "الإيراد" فعلياً بيانات تكلفة (🔴🔴) |
| [`sales-lines-report-audit.md`](audit-reports/2026-07-25-sales-lines-report-audit.md) | جمع المرتجعات بإشارة خاطئة (🔴) |
| [`purchase-lines-report-audit.md`](audit-reports/2026-07-25-purchase-lines-report-audit.md) | نفس ثغرة الإشارة (🔴) |
| [`receivables-aging-report-audit.md`](audit-reports/2026-07-25-receivables-aging-report-audit.md) | على الأرجح معطّل بالكامل (لا FK) (🔴) |

### الإعدادات والأمان
| التقرير | أهم اكتشاف |
|---|---|
| [`company-settings-audit.md`](audit-reports/2026-07-25-company-settings-audit.md) | "العملة الأساسية" هنا بلا أي أثر فعلي (🔴) |
| [`branches-audit.md`](audit-reports/2026-07-25-branches-audit.md) | تعطيل فرع بلا تسلسل + إفراغ صامت لقوائم الاختيار (🔴) |
| [`accounting-periods-audit.md`](audit-reports/2026-07-25-accounting-periods-audit.md) | لا فحص تداخل فترات، إعادة فتح بلا تأكيد (🟠) |
| [`permissions-audit.md`](audit-reports/2026-07-25-permissions-audit.md) | منح صلاحيات لنفسك بلا قيد (🟠) |
| [`users-audit.md`](audit-reports/2026-07-25-users-audit.md) | **تصعيد صلاحيات فعلي لأدمن (🔴🔴)** |
| [`login-auth-audit.md`](audit-reports/2026-07-25-login-auth-audit.md) | لا ثغرات حرجة — `SKIP_AUTH` مؤكَّد محصور بـCI فقط |
| [`setup-audit.md`](audit-reports/2026-07-25-setup-audit.md) | أدمن ثانٍ صامت لو انفرغ جدول المستخدمين (🔴) |

### الملفات الأقدم (جذر المشروع + تدقيقات 22-23 يوليو) — مُحدَّثة بحالة معالجة بأعلى كل ملف
[`AUDIT_FINDINGS.md`](AUDIT_FINDINGS.md) · [`AUDIT_FINDINGS_PENDING.md`](AUDIT_FINDINGS_PENDING.md) · [`AUDIT_REMAINING.md`](AUDIT_REMAINING.md) · [`AUDIT_INVOICES_JOURNAL.md`](AUDIT_INVOICES_JOURNAL.md) · [`AUDIT_PERIODS_AND_SECURITY.md`](AUDIT_PERIODS_AND_SECURITY.md) · [`AUDIT_REPORTS.md`](AUDIT_REPORTS.md) · [`AUDIT_INVENTORY.md`](AUDIT_INVENTORY.md) · [`AUDIT_INVOICE_PATTERNS.md`](AUDIT_INVOICE_PATTERNS.md) · [`AUDIT_POS.md`](AUDIT_POS.md) — جميعها إما ✓ مُغلقة بالكامل أو معماريّة الطابع (RLS بالفرع، رصيد مُخزَّن)، حسب حالة المعالجة المُدرَجة بأعلى كل ملف. [`audit-reports/2026-07-22-accounts-vouchers-audit.md`](audit-reports/2026-07-22-accounts-vouchers-audit.md) — 7 بنود لا تزال مفتوحة (راجع رأس الملف). [`audit-reports/2026-07-22-general-audit.md`](audit-reports/2026-07-22-general-audit.md) — بند تشتت الدوال لا يزال مفتوحاً.

---

## ما لم يُدقَّق بعد
- الاستيراد الجماعي بكل الوحدات (مواد، حسابات، مراكز كلفة) — لُمس جزئياً فقط ضمن تقارير الوحدات الأم.
- شاشات الطباعة/التصدير عبر المشروع — لوحظ غيابها بأغلب التقارير كملاحظة، بلا تدقيق مخصص لآلية الطباعة نفسها.
- اختبار فعلي بأحمال بيانات كبيرة (كل ملاحظات "الأداء" بالتقارير نظرية بناءً على قراءة الكود، وليست قياساً فعلياً).
