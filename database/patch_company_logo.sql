-- إضافة شعار الشركة لإعدادات الشركة (تشغيل على قاعدة موجودة)
alter table public.company_settings
  add column if not exists logo_url text null;
