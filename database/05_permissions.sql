-- =============================================================================
-- 05_permissions.sql — ترقية قاعدة موجودة: صلاحيات تفصيلية
-- =============================================================================
-- شغّل بعد 04_auth.sql (أو بعد setup_all.sql — غير مطلوب للتثبيت الكامل).
-- =============================================================================

create table if not exists public.user_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_key varchar(80) not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, permission_key)
);

create index if not exists idx_user_permissions_key
  on public.user_permissions(permission_key);

create or replace function public.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.user_permissions
      where user_id = auth.uid()
        and permission_key = p_key
    );
$$;

alter table public.user_permissions enable row level security;

drop policy if exists "user_permissions_select" on public.user_permissions;
create policy "user_permissions_select" on public.user_permissions
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('settings.permissions.manage'));

drop policy if exists "user_permissions_admin_all" on public.user_permissions;
drop policy if exists "user_permissions_insert" on public.user_permissions;
create policy "user_permissions_insert" on public.user_permissions
  for insert to authenticated
  with check (public.has_permission('settings.permissions.manage'));

drop policy if exists "user_permissions_update" on public.user_permissions;
create policy "user_permissions_update" on public.user_permissions
  for update to authenticated
  using (public.has_permission('settings.permissions.manage'))
  with check (public.has_permission('settings.permissions.manage'));

drop policy if exists "user_permissions_delete" on public.user_permissions;
create policy "user_permissions_delete" on public.user_permissions
  for delete to authenticated
  using (public.has_permission('settings.permissions.manage'));

-- تحديث سياسات profiles / company_settings لاستخدام has_permission
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    auth.uid() = id
    or public.is_admin()
    or public.has_permission('settings.users.view')
    or public.has_permission('settings.permissions.manage')
  );

drop policy if exists "profiles_update_admin" on public.profiles;
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

drop policy if exists "company_settings_update_admin" on public.company_settings;
create policy "company_settings_update_admin" on public.company_settings
  for update to authenticated
  using (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  )
  with check (
    public.is_admin()
    or public.has_permission('settings.company.edit')
  );
