-- Migration: add English name to accounts (run once in Supabase SQL Editor)

alter table public.accounts
  add column if not exists name_en varchar(200) null;
