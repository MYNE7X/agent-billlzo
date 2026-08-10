-- ============================================================================
-- Edit History / Audit Log for Profile + Attendance Request Reviewer Names
-- ----------------------------------------------------------------------------
-- 1. public.edit_history — generic audit table for tracking who edited what
-- 2. public.get_user_display_name(uid) — helper to resolve reviewer/editor name
-- ============================================================================

-- ── 1. EDIT HISTORY TABLE ────────────────────────────────────────────────────
-- Tracks who edited an agent's profile, when, and what section changed.
-- Used by the "edited by" bubble on the agent profile.
create table if not exists public.edit_history (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null,  -- 'agent_profile', 'attendance', 'attendance_request', etc.
  entity_id       uuid not null,  -- the agent_id / attendance_id / request_id
  section         text,           -- e.g. 'personal', 'contact', 'employment', 'bank'
  field_name      text,           -- specific field that changed (optional)
  old_value       text,
  new_value       text,
  edited_by       uuid references auth.users(id) on delete set null,
  edited_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- Indexes
create index if not exists edit_history_entity_idx on public.edit_history(entity_type, entity_id);
create index if not exists edit_history_edited_by_idx on public.edit_history(edited_by);
create index if not exists edit_history_edited_at_idx on public.edit_history(edited_at desc);

-- Grants + RLS
grant select on public.edit_history to authenticated;
grant all on public.edit_history to service_role;
alter table public.edit_history enable row level security;

-- Staff can read all edit history; agents can read their own
drop policy if exists "edit_history read" on public.edit_history;
create policy "edit_history read" on public.edit_history
  for select to authenticated
  using (
    public.is_staff(auth.uid())
    or (
      entity_type = 'agent_profile'
      and exists (select 1 from public.agents a where a.id = entity_id and a.user_id = auth.uid())
    )
  );

-- Staff + agents (for their own profile) can insert
drop policy if exists "edit_history insert" on public.edit_history;
create policy "edit_history insert" on public.edit_history
  for insert to authenticated
  with check (
    public.is_staff(auth.uid())
    or (
      entity_type = 'agent_profile'
      and exists (select 1 from public.agents a where a.id = entity_id and a.user_id = auth.uid())
    )
  );

-- ── 2. HELPER: get_user_display_name(uid) ────────────────────────────────────
-- Returns the display name + email for a user. Used by the frontend to show
-- "Reviewed by Aziz Ullah (myne7x@gmail.com)" in the reviewer bubble.
-- SECURITY DEFINER so it can read auth.users.email (normally restricted).
create or replace function public.get_user_display_name(_user_id uuid)
returns table (
  full_name text,
  email text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.full_name,
    u.email,
    p.avatar_url
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = _user_id
$$;

revoke all on function public.get_user_display_name(uuid) from public, anon;
grant execute on function public.get_user_display_name(uuid) to authenticated, service_role;

-- ── Done ─────────────────────────────────────────────────────────────────────
-- Verification:
--   select * from public.get_user_display_name('<user-uuid>');
--   select * from public.edit_history where entity_type = 'agent_profile' order by edited_at desc limit 10;
