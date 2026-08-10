import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { ForceChangePassword } from "@/components/auth/ForceChangePassword";
import { PendingApproval } from "@/components/auth/PendingApproval";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { mustChangePassword, isApproved, loading, refresh } = useAuth();

  if (loading) return null;

  // Force password change screen — overlays everything
  if (mustChangePassword) {
    return (
      <>
        <AppShell>
          <Outlet />
        </AppShell>
        <ForceChangePassword onDone={() => void refresh()} />
      </>
    );
  }

  // Account not yet approved
  if (!isApproved) {
    return <PendingApproval />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
