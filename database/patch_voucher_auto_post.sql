-- =============================================================================
-- patch_voucher_auto_post.sql — ترحيل تلقائي لكل نوع سند
-- =============================================================================

alter table public.voucher_type_defaults
  add column if not exists auto_post_enabled boolean not null default false;
