-- ============================================================
-- Billzo: Temporary Password + Account Approval System
-- Run this entire script in your Supabase SQL Editor
-- ============================================================

-- ── 1. Add columns ─────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- ── 2. Security field protection trigger on profiles ───────
-- The existing "own profile update" policy is USING (id = auth.uid() OR is_super_admin).
-- This trigger enforces column-level restrictions WITHIN that policy window:
--   · is_approved  — only super_admin / admin may change it
--   · must_change_password — only super_admin / admin may SET it to true;
--                            any authenticated user may CLEAR their OWN flag
--                            (happens after a successful Auth password change)
CREATE OR REPLACE FUNCTION public.protect_profile_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  caller_is_staff boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
  ) INTO caller_is_staff;

  -- is_approved: only staff may flip this column
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    IF NOT caller_is_staff THEN
      NEW.is_approved := OLD.is_approved;   -- silently revert
    END IF;
  END IF;

  -- must_change_password: staff may set or clear;
  -- non-staff may only CLEAR their own (post-password-change)
  IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    IF NOT caller_is_staff THEN
      IF NEW.must_change_password = true THEN
        NEW.must_change_password := OLD.must_change_password;
      ELSIF NEW.must_change_password = false AND NEW.id IS DISTINCT FROM auth.uid() THEN
        NEW.must_change_password := OLD.must_change_password;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_security ON public.profiles;
CREATE TRIGGER trg_protect_profile_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_security_fields();

-- ── 3. RLS: staff can update ANY profile row ────────────────
-- The existing "own profile update" policy is:
--   using (id = auth.uid() OR has_role(auth.uid(),'super_admin'))
-- We broaden to include admins so the Pending Approvals page works
-- for both super_admin and admin. The trigger above keeps the
-- security columns protected regardless of who runs the UPDATE.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'staff_can_update_any_profile'
  ) THEN
    CREATE POLICY staff_can_update_any_profile
      ON public.profiles
      FOR UPDATE
      USING (
        auth.uid() = id
        OR EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
        )
      )
      WITH CHECK (
        auth.uid() = id
        OR EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
        )
      );
  END IF;
END$$;

-- Drop stale broad policy from previous migration attempt, if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'users_can_clear_must_change_password'
  ) THEN
    DROP POLICY users_can_clear_must_change_password ON public.profiles;
  END IF;
END$$;

-- ── 4. Auto-approve on STAFF role assignment only ──────────
-- CRITICAL: handle_new_user() assigns 'agent' to every self-signup.
-- If we auto-approve on 'agent' role, all self-signups bypass the
-- pending-approval gate immediately. We therefore ONLY auto-approve
-- when a super_admin or admin role is assigned.
-- Agents are approved via the account-link trigger (step 5) or
-- manually by staff on the Pending Approvals page.
CREATE OR REPLACE FUNCTION public.auto_approve_on_role_assign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('super_admin', 'admin') THEN
    UPDATE public.profiles SET is_approved = true WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_approve_on_role ON public.user_roles;
CREATE TRIGGER trg_auto_approve_on_role
  AFTER INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_on_role_assign();

-- ── 5. Auto-approve when an agent account is linked ────────
-- Fires when agents.user_id is set by staff.
-- The existing agents UPDATE RLS already restricts:
--   super_admin  → any row
--   admin        → rows where assigned_admin_id matches
--   agent / anon → cannot UPDATE agents at all
-- The SECURITY DEFINER trigger therefore only runs as a result
-- of a staff-authorised UPDATE.
CREATE OR REPLACE FUNCTION public.auto_approve_on_agent_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fires when user_id is being SET (not cleared)
  IF NEW.user_id IS NOT NULL
     AND (OLD.user_id IS NULL OR NEW.user_id IS DISTINCT FROM OLD.user_id)
  THEN
    UPDATE public.profiles SET is_approved = true WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_approve_on_agent_link ON public.agents;
CREATE TRIGGER trg_auto_approve_on_agent_link
  AFTER UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_on_agent_link();

-- ── 6. Belt-and-suspenders: protect agents.user_id from non-staff ──
-- Although the existing agents UPDATE RLS prevents non-staff from
-- touching agent rows at all, this trigger adds an explicit guard
-- so that even if the RLS policy is ever relaxed, a non-staff caller
-- cannot change user_id (which would then trigger auto-approval).
CREATE OR REPLACE FUNCTION public.protect_agent_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
    ) THEN
      NEW.user_id := OLD.user_id;   -- silently revert
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_agent_user_id ON public.agents;
CREATE TRIGGER trg_protect_agent_user_id
  BEFORE UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_agent_user_id();

-- ── 7. Back-fill approvals ─────────────────────────────────
-- Approve all existing users who already have a role or linked agent
-- (preserves access for users created before this migration).
UPDATE public.profiles
SET is_approved = true
WHERE id IN (
  -- staff (super_admin / admin)
  SELECT user_id FROM public.user_roles WHERE role IN ('super_admin', 'admin')
  UNION
  -- agents who are already linked to an agent record
  SELECT user_id FROM public.agents WHERE user_id IS NOT NULL
);

-- ============================================================
-- DONE. Security model summary:
--
-- profiles.is_approved
--   false  = pending (self-registered, awaiting staff action)
--   true   = approved
--   Who sets it true:
--     • trg_auto_approve_on_role (SECURITY DEFINER) — only for
--       super_admin / admin role assignments (NOT agent role, which
--       is assigned to every self-signup by handle_new_user).
--     • trg_auto_approve_on_agent_link (SECURITY DEFINER) — when
--       agents.user_id is set; protected upstream by agents UPDATE
--       RLS (staff only) + trg_protect_agent_user_id trigger.
--     • Staff direct UPDATE via Pending Approvals page — protected
--       by trg_protect_profile_security (reverts if not staff).
--
-- profiles.must_change_password
--   true  = agent must change password on next login
--   false = normal login
--   Who sets/clears it:
--     • Staff SET it via SetPasswordPanel → protected by trigger
--     • Agent CLEARS their own flag after Auth password change
--       → trigger allows self-clear-only
--
-- agents.user_id
--   Protected by: agents UPDATE RLS (staff only) +
--                 trg_protect_agent_user_id (belt-and-suspenders)
-- ============================================================
