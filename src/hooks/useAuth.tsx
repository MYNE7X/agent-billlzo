import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "agent";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  must_change_password: boolean;
  is_approved: boolean;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isAgentOnly: boolean;
  mustChangePassword: boolean;
  isApproved: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMeta = async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setRoles([]);
      return;
    }
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, phone, must_change_password, is_approved")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(
      p
        ? {
            id: p.id,
            full_name: p.full_name,
            email: p.email,
            avatar_url: p.avatar_url,
            phone: p.phone,
            must_change_password: p.must_change_password ?? false,
            is_approved: p.is_approved ?? false,
          }
        : null,
    );
    setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
  };

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      loadMeta(data.session?.user.id).finally(() => active && setLoading(false));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      setRoles([]);
      return;
    }
    void loadMeta(session.user.id);
  }, [session?.user?.id]);

  const value = useMemo<AuthState>(() => {
    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = roles.includes("admin");
    return {
      loading,
      session,
      user: session?.user ?? null,
      profile,
      roles,
      isSuperAdmin,
      isAdmin,
      isStaff: isSuperAdmin || isAdmin,
      isAgentOnly: !isSuperAdmin && !isAdmin,
      mustChangePassword: profile?.must_change_password ?? false,
      isApproved: profile?.is_approved ?? false,
      refresh: async () => loadMeta(session?.user.id),
      signOut: async () => {
        await supabase.auth.signOut();
        setSession(null);
      },
    };
  }, [loading, session, profile, roles]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
