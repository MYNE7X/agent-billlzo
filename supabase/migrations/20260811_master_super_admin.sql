-- ============================================================================
-- Master Super Admin Protection
-- ----------------------------------------------------------------------------
-- Only myne7x@gmail.com can change user roles (promote/demote/admin/etc).
-- Other super_admins keep their dashboard access + attendance-approval rights
-- but CANNOT touch user_roles.
--
-- Enforcement is at 3 layers:
--   1. is_master_super_admin() SQL function (the source of truth)
--   2. REPLACE existing set_user_role() / remove_user_role() SECURITY DEFINER
--      functions so they raise an exception unless the caller is the master
--   3. RLS INSERT/UPDATE/DELETE policies on user_roles so direct API writes
--      are also blocked (belt-and-suspenders — even if someone bypasses RPC)
--
-- The master account itself can never be demoted/removed by anyone else.
-- ============================================================================

-- ── 1. Master email constant + helper function ──────────────────────────────
-- We store the master email in a dedicated function so it's easy to audit
-- and change in exactly one place. SECURITY DEFINER so it can be called from
-- RLS policies + other functions without needing table access.

CREATE OR REPLACE FUNCTION public.master_super_admin_email()
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'myne7x@gmail.com'::text
$$;

REVOKE ALL ON FUNCTION public.master_super_admin_email() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.master_super_admin_email() TO authenticated, service_role;

-- ── 2. is_master_super_admin(uid) — does this user own the master email? ────
-- Checks auth.users.email for the given uid. Returns false if the user doesn't
-- exist or doesn't match. SECURITY DEFINER so RLS policies can call it without
-- needing direct read access to auth.users.

CREATE OR REPLACE FUNCTION public.is_master_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
      AND lower(email) = lower(public.master_super_admin_email())
  )
$$;

REVOKE ALL ON FUNCTION public.is_master_super_admin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_master_super_admin(uuid) TO authenticated, service_role;

-- Convenience overload: is_master_super_admin() with no args → checks the
-- CURRENT caller. Useful inside RLS policies + triggers.
CREATE OR REPLACE FUNCTION public.is_master_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_master_super_admin(auth.uid())
$$;

REVOKE ALL ON FUNCTION public.is_master_super_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_master_super_admin() TO authenticated, service_role;

-- ── 3. REPLACE set_user_role() — enforce master-only ────────────────────────
-- The existing set_user_role(p_user_id, p_role) function (created elsewhere via
-- SQL Editor) is replaced here with a version that raises an exception unless
-- the caller is the master super admin.
--
-- Behaviour:
--   · Master caller → role is inserted (existing behaviour preserved)
--   · Anyone else   → RAISE EXCEPTION 'Only the Master Super Admin can change roles'
--   · Targeting the master's own row → still allowed for the master themselves

CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_master_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied: only the Master Super Admin (%) can change user roles',
      public.master_super_admin_email()
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  -- Insert the role (idempotent — UNIQUE(user_id, role) handles dups)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- The existing trg_auto_approve_on_role trigger will auto-approve staff
  -- roles (super_admin/admin) — no need to duplicate that logic here.
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO authenticated, service_role;

-- ── 4. REPLACE remove_user_role() — enforce master-only + protect master ────
CREATE OR REPLACE FUNCTION public.remove_user_role(p_user_id uuid, p_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_master_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied: only the Master Super Admin (%) can change user roles',
      public.master_super_admin_email()
      USING ERRCODE = '42501';
  END IF;

  -- Extra guard: never allow removing the super_admin role FROM the master
  -- account itself ( belt-and-suspenders — the master can still remove OTHER
  -- super_admins, just not lock themselves out).
  IF p_role = 'super_admin' AND public.is_master_super_admin(p_user_id) THEN
    RAISE EXCEPTION 'Cannot remove Super Admin role from the Master Super Admin account'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role = p_role;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_user_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_user_role(uuid, public.app_role) TO authenticated, service_role;

-- ── 5. RLS on user_roles — belt-and-suspenders ──────────────────────────────
-- Even if someone bypasses the RPC functions and tries a direct
-- INSERT/UPDATE/DELETE on user_roles via the Postgres API, these policies
-- block them. Only the master super admin can write.

-- Drop any existing write policies (the original migration only had a SELECT
-- policy, but we clean up defensively in case later migrations added more).
DROP POLICY IF EXISTS "user_roles insert master only" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles update master only" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles delete master only" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles write master only" ON public.user_roles;

CREATE POLICY "user_roles insert master only"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_master_super_admin(auth.uid()));

CREATE POLICY "user_roles update master only"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_master_super_admin(auth.uid()))
  WITH CHECK (public.is_master_super_admin(auth.uid()));

CREATE POLICY "user_roles delete master only"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_master_super_admin(auth.uid()));

-- The existing "roles read" policy (user can read own roles, staff can read
-- all) is preserved — we're only locking down writes.

-- ── 6. Trigger to protect the master account's own roles ────────────────────
-- Even if somehow a write slipped through (e.g. service_role key misuse),
-- this trigger prevents deleting or downgrading the master's super_admin row.

CREATE OR REPLACE FUNCTION public.protect_master_super_admin_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Block any DELETE of the master's super_admin role
  IF (TG_OP = 'DELETE') THEN
    IF OLD.role = 'super_admin' AND public.is_master_super_admin(OLD.user_id) THEN
      RAISE EXCEPTION 'Cannot remove Super Admin role from the Master Super Admin account (%)',
        public.master_super_admin_email()
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  -- Block any UPDATE that would strip super_admin from the master
  IF (TG_OP = 'UPDATE') THEN
    IF OLD.role = 'super_admin'
       AND public.is_master_super_admin(OLD.user_id)
       AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
      RAISE EXCEPTION 'Cannot modify the Master Super Admin role row (%)',
        public.master_super_admin_email()
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_master_roles ON public.user_roles;
CREATE TRIGGER trg_protect_master_roles
  BEFORE DELETE OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_master_super_admin_roles();

-- ── 7. Ensure the master account is + stays super_admin ────────────────────
-- Idempotent: if the master user exists, make sure they have the super_admin
-- role. Safe to re-run. Does NOT create the auth.users account (the master
-- must already exist — this just guarantees the role is present).

DO $$
DECLARE
  v_master_id uuid;
BEGIN
  SELECT id INTO v_master_id FROM auth.users WHERE lower(email) = lower(public.master_super_admin_email());
  IF v_master_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_master_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- ── 8. Verification queries (run manually to confirm) ──────────────────────
-- SELECT public.master_super_admin_email();           -- → myne7x@gmail.com
-- SELECT public.is_master_super_admin(auth.uid());    -- → true only for master
-- SELECT * FROM public.user_roles WHERE user_id = (
--   SELECT id FROM auth.users WHERE lower(email) = lower('myne7x@gmail.com')
-- );  -- should always contain super_admin

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Layer 1: is_master_super_admin() — SQL function, source of truth
-- Layer 2: set_user_role() / remove_user_role() — RAISE EXCEPTION if not master
-- Layer 3: RLS INSERT/UPDATE/DELETE on user_roles — block direct API writes
-- Layer 4: trg_protect_master_roles — prevents demoting the master account
-- Layer 5: DO block — ensures master always has super_admin role
--
-- Other super_admins KEEP all their existing access:
--   ✓ Super Admin dashboard
--   ✓ View all agents/attendance/reports
--   ✓ Approve attendance requests
--   ✓ Manage offices, expenses, network settings
--   ✗ CANNOT change user roles (promote/demote/assign)
-- ============================================================================
