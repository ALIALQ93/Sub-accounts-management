-- =============================================================================
-- 06_storage.sql — Supabase Storage (شعار الشركة + مرفقات السندات مستقبلاً)
-- =============================================================================
-- شغّل بعد 05_permissions.sql (أو بعد setup_all.sql) على قاعدة موجودة.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-assets',
  'company-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit)
values (
  'voucher-attachments',
  'voucher-attachments',
  false,
  10485760
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- ---------------------------------------------------------------------------
-- company-assets — شعار الشركة (قراءة عامة لصفحة الدخول)
-- ---------------------------------------------------------------------------

drop policy if exists "company_assets_public_read" on storage.objects;
create policy "company_assets_public_read" on storage.objects
  for select to public
  using (bucket_id = 'company-assets');

drop policy if exists "company_assets_insert" on storage.objects;
create policy "company_assets_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = 'company'
    and (
      public.is_admin()
      or public.has_permission('settings.company.edit')
    )
  );

drop policy if exists "company_assets_update" on storage.objects;
create policy "company_assets_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = 'company'
    and (
      public.is_admin()
      or public.has_permission('settings.company.edit')
    )
  );

drop policy if exists "company_assets_delete" on storage.objects;
create policy "company_assets_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'company-assets'
    and (storage.foldername(name))[1] = 'company'
    and (
      public.is_admin()
      or public.has_permission('settings.company.edit')
    )
  );

-- ---------------------------------------------------------------------------
-- voucher-attachments — جاهز لمرفقات السندات (قراءة للمصادقين فقط)
-- ---------------------------------------------------------------------------

drop policy if exists "voucher_attachments_select" on storage.objects;
create policy "voucher_attachments_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'voucher-attachments'
    and (
      public.is_admin()
      or public.has_permission('vouchers.view')
    )
  );

drop policy if exists "voucher_attachments_insert" on storage.objects;
create policy "voucher_attachments_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'voucher-attachments'
    and (storage.foldername(name))[1] = 'vouchers'
    and (
      public.is_admin()
      or public.has_permission('vouchers.edit')
    )
  );

drop policy if exists "voucher_attachments_update" on storage.objects;
create policy "voucher_attachments_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'voucher-attachments'
    and (storage.foldername(name))[1] = 'vouchers'
    and (
      public.is_admin()
      or public.has_permission('vouchers.edit')
    )
  );

drop policy if exists "voucher_attachments_delete" on storage.objects;
create policy "voucher_attachments_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'voucher-attachments'
    and (storage.foldername(name))[1] = 'vouchers'
    and (
      public.is_admin()
      or public.has_permission('vouchers.edit')
    )
  );
