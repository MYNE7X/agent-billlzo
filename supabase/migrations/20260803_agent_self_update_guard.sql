-- ============================================================
-- Agent self-update guard
-- Enforces two rules at the DB level for non-staff agents:
--   1. Only profile_picture_url, cnic_front_url, cnic_back_url
--      may be changed via agent self-service (all other fields
--      are silently protected by resetting to OLD values).
--   2. Those three upload fields are one-time: once set (NOT NULL)
--      they cannot be overwritten via the agent path.
-- Staff (admin / super_admin) bypass this trigger entirely.
-- ============================================================

CREATE OR REPLACE FUNCTION public.agent_self_update_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Staff bypass: admins and super_admins may change anything
  IF public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- ── Non-staff path: lock every field except the three upload URLs ──

  -- Identity / personal
  NEW.employee_id           := OLD.employee_id;
  NEW.reference_id          := OLD.reference_id;
  NEW.full_name             := OLD.full_name;
  NEW.father_name           := OLD.father_name;
  NEW.date_of_birth         := OLD.date_of_birth;
  NEW.gender                := OLD.gender;
  NEW.blood_group           := OLD.blood_group;
  NEW.marital_status        := OLD.marital_status;
  NEW.cnic_number           := OLD.cnic_number;
  NEW.passport_number       := OLD.passport_number;
  NEW.passport_url          := OLD.passport_url;

  -- Contact
  NEW.phone_number          := OLD.phone_number;
  NEW.whatsapp_number       := OLD.whatsapp_number;
  NEW.email                 := OLD.email;
  NEW.emergency_contact_name   := OLD.emergency_contact_name;
  NEW.emergency_contact_number := OLD.emergency_contact_number;
  NEW.home_address          := OLD.home_address;
  NEW.city                  := OLD.city;
  NEW.province              := OLD.province;
  NEW.country               := OLD.country;

  -- Employment
  NEW.department_id         := OLD.department_id;
  NEW.designation_id        := OLD.designation_id;
  NEW.joining_date          := OLD.joining_date;
  NEW.employee_type         := OLD.employee_type;
  NEW.shift_timing          := OLD.shift_timing;
  NEW.status                := OLD.status;
  NEW.assigned_admin_id     := OLD.assigned_admin_id;
  NEW.user_id               := OLD.user_id;

  -- Salary / banking
  NEW.salary                := OLD.salary;
  NEW.bank_name             := OLD.bank_name;
  NEW.account_title         := OLD.account_title;
  NEW.account_number        := OLD.account_number;
  NEW.iban                  := OLD.iban;

  -- Education / skills
  NEW.highest_qualification := OLD.highest_qualification;
  NEW.degree                := OLD.degree;
  NEW.institute_name        := OLD.institute_name;
  NEW.certifications        := OLD.certifications;
  NEW.languages             := OLD.languages;
  NEW.skills                := OLD.skills;
  NEW.previous_company      := OLD.previous_company;
  NEW.previous_experience   := OLD.previous_experience;

  -- Admin fields
  NEW.notes                 := OLD.notes;
  NEW.created_by            := OLD.created_by;
  NEW.created_at            := OLD.created_at;

  -- ── One-time upload enforcement ──
  -- Once an upload URL is set it cannot be replaced via the agent path.
  -- Staff can still overwrite it (they hit RETURN NEW above).

  IF OLD.profile_picture_url IS NOT NULL THEN
    NEW.profile_picture_url := OLD.profile_picture_url;
  END IF;

  IF OLD.cnic_front_url IS NOT NULL THEN
    NEW.cnic_front_url := OLD.cnic_front_url;
  END IF;

  IF OLD.cnic_back_url IS NOT NULL THEN
    NEW.cnic_back_url := OLD.cnic_back_url;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach the trigger (replace if it already exists from a previous run)
DROP TRIGGER IF EXISTS agent_self_update_guard ON public.agents;

CREATE TRIGGER agent_self_update_guard
  BEFORE UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.agent_self_update_guard();
