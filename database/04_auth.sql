-- =============================================================================
-- 04_auth.sql — ترقية قاعدة موجودة: مصادقة + ملفات شخصية + إعدادات
-- =============================================================================
-- شغّل على قاعدة أنشئت بـ 01_schema.sql القديم (بدون profiles).
-- إذا أعدت التثبيت من الصفر استخدم setup_all.sql — لا حاجة لهذا الملف.
-- يتطلب تفعيل Supabase Auth (Email/Password).
-- =============================================================================

create type if not exists public.app_role as enum ('admin', 'accountant', 'viewer');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name_ar text not null,
  full_name_en text null,
  role public.app_role not null default 'accountant',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_is_active on public.profiles(is_active);

create table if not exists public.company_settings (
  id int primary key default 1 check (id = 1),
  legal_name_ar text not null default 'شركتي',
  legal_name_en text null,
  tax_number text null,
  address text null,
  phone text null,
  email text null,
  fiscal_year_start_month int not null default 1
    check (fiscal_year_start_month between 1 and 12),
  base_currency_id uuid null references public.currencies(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id, legal_name_ar)
values (1, 'شركتي')
on conflict (id) do nothing;

create table if not exists public.party_settings (
  id int primary key default 1 check (id = 1),
  customer_parent_account_id uuid null references public.accounts(id) on delete set null,
  vendor_parent_account_id uuid null references public.accounts(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.party_settings (id)
values (1)
on conflict (id) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_count int;
begin
  select count(*) into v_count from public.profiles;

  if v_count = 0 then
    v_role := 'admin';
  else
    v_role := 'accountant';
  end if;

  insert into public.profiles (id, email, full_name_ar, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'full_name_ar',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    v_role
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_company_settings_updated_at on public.company_settings;
create trigger trg_company_settings_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.party_settings enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and is_active = (select p.is_active from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "company_settings_select" on public.company_settings;
create policy "company_settings_select" on public.company_settings
  for select to authenticated, anon
  using (true);

drop policy if exists "company_settings_update_admin" on public.company_settings;
create policy "company_settings_update_admin" on public.company_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "company_settings_insert_admin" on public.company_settings;
create policy "company_settings_insert_admin" on public.company_settings
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "party_settings_select_all" on public.party_settings;
create policy "party_settings_select_all" on public.party_settings
  for select to authenticated using (true);
drop policy if exists "party_settings_insert_all" on public.party_settings;
create policy "party_settings_insert_all" on public.party_settings
  for insert to authenticated with check (true);
drop policy if exists "party_settings_update_all" on public.party_settings;
create policy "party_settings_update_all" on public.party_settings
  for update to authenticated using (true) with check (true);

-- مزامنة مستخدمي auth الحاليين
do $$
declare
  v_has_profiles boolean;
begin
  select exists (select 1 from public.profiles limit 1) into v_has_profiles;

  insert into public.profiles (id, email, full_name_ar, role)
  select
    u.id,
    coalesce(u.email, ''),
    coalesce(
      u.raw_user_meta_data->>'full_name_ar',
      split_part(coalesce(u.email, 'user'), '@', 1)
    ),
    case
      when not v_has_profiles
        and u.id = (select id from auth.users order by created_at asc limit 1)
      then 'admin'::public.app_role
      else 'accountant'::public.app_role
    end
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id);
end $$;
