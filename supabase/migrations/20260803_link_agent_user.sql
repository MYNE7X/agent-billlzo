-- ============================================================
-- Link Agent User Account
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add index on agents.user_id for fast lookups by linked user
-- (run only once — skip if it already exists)
create index if not exists agents_user_id_idx on public.agents (user_id);

-- ── Optional: helper function to safely link a user to an agent ──────────────
-- Only super_admins can call this. It prevents linking a user already linked
-- to another agent.
create or replace function public.link_agent_to_user(
  p_agent_id uuid,
  p_user_id  uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- only super_admins can execute
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Permission denied';
  end if;

  -- ensure this user_id isn't already linked to a different agent
  if exists (
    select 1 from public.agents
    where user_id = p_user_id and id <> p_agent_id
  ) then
    raise exception 'This user account is already linked to another agent profile';
  end if;

  update public.agents set user_id = p_user_id where id = p_agent_id;
end;
$$;

-- revoke public execute, grant only to authenticated
revoke all on function public.link_agent_to_user(uuid, uuid) from public, anon;
grant execute on function public.link_agent_to_user(uuid, uuid) to authenticated, service_role;

-- ── Optional: unlink helper ───────────────────────────────────────────────────
create or replace function public.unlink_agent_user(p_agent_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'Permission denied';
  end if;
  update public.agents set user_id = null where id = p_agent_id;
end;
$$;

revoke all on function public.unlink_agent_user(uuid) from public, anon;
grant execute on function public.unlink_agent_user(uuid) to authenticated, service_role;
