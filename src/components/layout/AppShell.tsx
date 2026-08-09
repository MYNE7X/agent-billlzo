import { useState, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  ShieldCheck,
  UserCircle,
  LogOut,
  Menu,
  X,
  Building2,
  UserCog,
  Zap,
  Receipt,
  Wifi,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, labelize } from "@/lib/billzo";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Users;
  staffOnly?: boolean;
  superOnly?: boolean;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agents", label: "Agents", icon: Users, staffOnly: true },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck, staffOnly: true },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/expenses", label: "Expenses", icon: Receipt, staffOnly: true },
  { to: "/pending-approvals", label: "Pending", icon: UserCog, staffOnly: true },
  { to: "/network-settings", label: "Network", icon: Wifi, staffOnly: true },
  { to: "/admins", label: "Admins", icon: ShieldCheck, superOnly: true },
  { to: "/my-profile", label: "Profile", icon: UserCircle },
];

/** Premium "Created by" signature badge */
function CreatorBadge() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-4 py-3"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--primary)/0.08) 0%, hsl(var(--primary)/0.04) 100%)",
        boxShadow: "inset 0 0 0 1px hsl(var(--primary)/0.15), 0 0 20px hsl(var(--primary)/0.06)",
      }}
    >
      {/* top gradient line */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--primary)/0.6) 35%, hsl(160 70% 55%/0.6) 65%, transparent 100%)",
        }}
      />
      {/* bottom gradient line */}
      <div
        className="absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--primary)/0.2) 50%, transparent 100%)",
        }}
      />
      {/* corner glow */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 size-16 rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary)/0.4) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex items-center gap-3">
        {/* icon mark */}
        <div className="relative shrink-0">
          <div
            className="absolute inset-0 rounded-xl blur-md opacity-60"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(160 70% 50%))" }}
          />
          <div
            className="relative grid size-9 place-items-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)/0.9), hsl(160 70% 45%/0.9))",
            }}
          >
            <Zap className="size-4 text-background fill-background" />
          </div>
        </div>

        {/* text block */}
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
            Crafted by
          </p>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-sm font-bold leading-tight"
              style={{
                background: "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(160 70% 60%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Aziz
            </span>
            <span className="font-mono text-[11px] font-semibold tracking-tight text-muted-foreground/50">
              · Myne7x
            </span>
          </div>
        </div>

        {/* decorative dots */}
        <div className="flex shrink-0 flex-col gap-1">
          {[1, 0.5, 0.25].map((o, i) => (
            <span
              key={i}
              className="block size-1 rounded-full"
              style={{ background: `hsl(var(--primary)/${o * 0.5})` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, roles, isSuperAdmin, isStaff, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((i) => (!i.staffOnly || isStaff) && (!i.superOnly || isSuperAdmin));
  const primaryRole = roles.includes("super_admin")
    ? "super_admin"
    : roles.includes("admin")
      ? "admin"
      : "agent";

  // Mobile bottom tab bar — always: Dashboard first, Profile last, fill middle with the
  // next 3 most relevant items for the role. Everything else goes in "More".
  const profileItem = items.find((i) => i.to === "/my-profile");
  const dashboardItem = items.find((i) => i.to === "/dashboard");
  const middleItems = items.filter((i) => i.to !== "/my-profile" && i.to !== "/dashboard");
  const bottomItems = [dashboardItem, ...middleItems.slice(0, 3), profileItem].filter(
    (x): x is NavItem => Boolean(x),
  );
  const extraItems = middleItems.slice(3);

  const sidebar = (
    <div className="flex h-full flex-col gap-4 p-5">
      {/* Logo */}
      <Link to="/dashboard" className="flex items-center gap-3" onClick={() => setOpen(false)}>
        <span className="grid size-10 place-items-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
          <Building2 className="size-5 text-primary" />
        </span>
        <span>
          <span className="font-display block text-lg font-semibold leading-tight text-gradient">
            Billzo
          </span>
          <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
            Office System
          </span>
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            activeProps={{ className: "bg-primary/15 text-primary ring-1 ring-primary/25" }}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-secondary/70 hover:text-foreground"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary/60 transition-colors group-hover:bg-primary/15">
              <item.icon className="size-4 transition-transform duration-200 group-hover:scale-110" />
            </span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Creator badge */}
      <CreatorBadge />

      {/* Profile card */}
      <div className="glass rounded-xl p-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-9 ring-2 ring-primary/20 ring-offset-1 ring-offset-background">
            <AvatarFallback className="bg-primary/20 text-xs text-primary">
              {initials(profile?.full_name ?? profile?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profile?.full_name ?? "User"}</p>
            <p className="truncate text-[11px] text-muted-foreground">{labelize(primaryRole)}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={async () => {
            await signOut();
            void router.navigate({ to: "/" });
          }}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="glass fixed inset-y-0 left-0 z-40 hidden w-64 rounded-none border-y-0 border-l-0 lg:block">
        {sidebar}
      </aside>

      {/* Mobile slide-in drawer */}
      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          />
          <aside className="glass animate-rise fixed inset-y-0 left-0 z-50 w-72 rounded-none lg:hidden">
            {sidebar}
          </aside>
        </>
      ) : null}

      {/* Main content */}
      <div className="lg:pl-64">
        <header className="glass sticky top-0 z-30 flex items-center gap-3 rounded-none border-x-0 border-t-0 px-4 py-3 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <div className="flex items-center gap-2 lg:hidden">
            <span className="grid size-7 place-items-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <Building2 className="size-3.5 text-primary" />
            </span>
            <span className="font-display text-sm font-semibold text-gradient">Billzo</span>
          </div>
          <div className="flex-1" />
          <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {labelize(primaryRole)}
          </span>
        </header>

        <main className="surface-grid min-h-[calc(100vh-57px)] px-4 py-6 pb-24 lg:px-8 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="glass fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border/50 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {bottomItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            activeProps={{
              className:
                "text-primary after:absolute after:top-0 after:inset-x-2 after:h-0.5 after:rounded-full after:bg-primary",
            }}
            className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-muted-foreground transition-colors duration-150 hover:text-foreground active:scale-95"
          >
            <span className="grid size-8 place-items-center rounded-xl transition-all duration-150 hover:bg-primary/10">
              <item.icon className="size-5" />
            </span>
            <span className="text-[9px] font-medium leading-none tracking-wide">{item.label}</span>
          </Link>
        ))}
        {extraItems.length > 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <span className="grid size-8 place-items-center rounded-xl transition-all duration-150 hover:bg-primary/10">
              <Menu className="size-5" />
            </span>
            <span className="text-[9px] font-medium leading-none tracking-wide">More</span>
          </button>
        )}
      </nav>
    </div>
  );
}
