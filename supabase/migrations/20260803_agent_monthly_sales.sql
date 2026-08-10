-- ============================================================
-- Agent Monthly Sales
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_monthly_sales (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id    uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  month       date NOT NULL,                    -- always first day of month, e.g. 2026-08-01
  amount      numeric(14,2) NOT NULL DEFAULT 0,
  notes       text,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (agent_id, month)
);

-- Explicit grants (matches pattern used by other tables in this project)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_monthly_sales TO authenticated;
GRANT ALL ON public.agent_monthly_sales TO service_role;

ALTER TABLE public.agent_monthly_sales ENABLE ROW LEVEL SECURITY;

-- Staff (admin / super_admin) can manage all records
CREATE POLICY "Staff can manage agent_monthly_sales"
  ON public.agent_monthly_sales
  FOR ALL
  TO authenticated
  USING  (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Agents can view only their own records
CREATE POLICY "Agent can view own monthly sales"
  ON public.agent_monthly_sales
  FOR SELECT
  TO authenticated
  USING (
    agent_id IN (
      SELECT id FROM public.agents WHERE user_id = auth.uid()
    )
  );
