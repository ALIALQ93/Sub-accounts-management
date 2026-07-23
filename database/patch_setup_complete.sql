-- إعداد أولي: علامة اكتمال ويزارد التثبيت (تشغيل على قاعدة موجودة أو ضمن setup_all)
alter table public.company_settings
  add column if not exists is_setup_complete boolean not null default false;

comment on column public.company_settings.is_setup_complete is
  'false = يجب إكمال /setup؛ true = اكتمل الإعداد الأولي';

-- قواعد موجودة فيها مستخدمون مسبقاً: لا تُجبر على الويزارد
update public.company_settings cs
set is_setup_complete = true
where cs.id = 1
  and cs.is_setup_complete = false
  and exists (select 1 from public.profiles limit 1);
