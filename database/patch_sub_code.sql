-- =============================================================================
-- patch_sub_code.sql — كود فرعي للمستخدم (منفصل عن كود النظام)
-- =============================================================================

alter table public.accounts
  add column if not exists sub_code varchar(30) null;

alter table public.cost_centers
  add column if not exists sub_code varchar(30) null;
